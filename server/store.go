package main

// Storage.
//
// An append-only JSON-lines log with an in-memory index. Deliberately not a
// database: this binary has to run on whatever is available at a PHC — a
// second-hand mini PC, a Raspberry Pi, sometimes a laptop that gets carried
// home at night — with no install step, no daemon to keep alive and no backup
// story beyond "copy one file".
//
// The Store interface is the seam. Swapping in PostgreSQL for the district
// deployment means writing a second implementation of these five methods and
// changing one line in main(); nothing else in the server knows the difference.

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"sync"
	"time"
)

type Screening struct {
	// ClientID is generated on the phone and is the idempotency key. A health
	// worker syncing over a flaky 2G link will retry the same batch several
	// times; every retry must be a no-op.
	ClientID   string             `json:"client_id"`
	ServerID   string             `json:"server_id"`
	Patient    string             `json:"patient"`
	District   string             `json:"district"`
	Risk       float64            `json:"risk"`
	Band       string             `json:"band"`
	Features   map[string]float64 `json:"features"`
	CapturedAt time.Time          `json:"captured_at"`
	ReceivedAt time.Time          `json:"received_at"`
	Referral   *Referral          `json:"referral,omitempty"`
}

type Referral struct {
	Status    string     `json:"status"` // issued | seen | declined
	PHC       string     `json:"phc,omitempty"`
	UpdatedAt time.Time  `json:"updated_at"`
	SeenAt    *time.Time `json:"seen_at,omitempty"`
}

type Store interface {
	Put(s Screening) (created bool, err error)
	Get(clientID string) (Screening, bool)
	List(filter Filter) []Screening
	SetReferral(clientID string, r Referral) bool
	Count() int
}

type Filter struct {
	District string
	Band     string
	Since    time.Time
	Limit    int
}

/* ------------------------------------------------------------ file store -- */

type FileStore struct {
	mu   sync.RWMutex
	path string
	f    *os.File
	idx  map[string]*Screening
	ord  []string // insertion order, so List is stable
}

func OpenFileStore(path string) (*FileStore, error) {
	s := &FileStore{path: path, idx: map[string]*Screening{}}
	if err := s.replay(); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	s.f = f
	return s, nil
}

// replay rebuilds the index from the log. A later record for the same
// ClientID wins, which is what makes referral updates work without rewriting
// history.
func (s *FileStore) replay() error {
	f, err := os.Open(s.path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 1<<20), 1<<22)
	line := 0
	for sc.Scan() {
		line++
		b := sc.Bytes()
		if len(b) == 0 {
			continue
		}
		var rec Screening
		if err := json.Unmarshal(b, &rec); err != nil {
			// A torn write at the tail of the log is survivable: skip it and
			// keep the rest rather than refusing to start.
			fmt.Fprintf(os.Stderr, "store: skipping unreadable line %d: %v\n", line, err)
			continue
		}
		if _, seen := s.idx[rec.ClientID]; !seen {
			s.ord = append(s.ord, rec.ClientID)
		}
		cp := rec
		s.idx[rec.ClientID] = &cp
	}
	return sc.Err()
}

func (s *FileStore) append(rec Screening) error {
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	if _, err := s.f.Write(append(b, '\n')); err != nil {
		return err
	}
	return s.f.Sync() // a field device loses power without warning
}

func (s *FileStore) Put(rec Screening) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.idx[rec.ClientID]; exists {
		return false, nil // idempotent: the retry is a no-op
	}
	if err := s.append(rec); err != nil {
		return false, err
	}
	cp := rec
	s.idx[rec.ClientID] = &cp
	s.ord = append(s.ord, rec.ClientID)
	return true, nil
}

func (s *FileStore) Get(id string) (Screening, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.idx[id]
	if !ok {
		return Screening{}, false
	}
	return *r, true
}

func (s *FileStore) List(f Filter) []Screening {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Screening, 0, 64)
	for _, id := range s.ord {
		r := s.idx[id]
		if f.District != "" && r.District != f.District {
			continue
		}
		if f.Band != "" && r.Band != f.Band {
			continue
		}
		if !f.Since.IsZero() && r.CapturedAt.Before(f.Since) {
			continue
		}
		out = append(out, *r)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CapturedAt.After(out[j].CapturedAt) })
	if f.Limit > 0 && len(out) > f.Limit {
		out = out[:f.Limit]
	}
	return out
}

func (s *FileStore) SetReferral(id string, ref Referral) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.idx[id]
	if !ok {
		return false
	}
	updated := *r
	updated.Referral = &ref
	if err := s.append(updated); err != nil {
		return false
	}
	s.idx[id] = &updated
	return true
}

func (s *FileStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.idx)
}
