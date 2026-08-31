// SANDHI sync server.
//
//	go run .                  # listens on :8787, log at ./sandhi.log
//	go build -o sandhid .     # one static binary, no libc, no runtime deps
//
// Cross-compiles to whatever the district has:
//
//	GOOS=linux GOARCH=arm64 go build -o sandhid-arm64 .
//
// The architecture calls for Go with Postgres. This build ships the same API
// over an append-only file store so the whole system runs from a clone with
// nothing installed. See store.go for where Postgres slots in.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var (
	store   Store
	started = time.Now()
)

func main() {
	addr := flag.String("addr", ":8787", "listen address")
	path := flag.String("store", "sandhi.log", "append-only record log")
	flag.Parse()

	fs, err := OpenFileStore(*path)
	if err != nil {
		log.Fatalf("cannot open store %s: %v", *path, err)
	}
	store = fs

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("POST /v1/screenings", handleIngest)
	mux.HandleFunc("GET /v1/screenings", handleList)
	mux.HandleFunc("POST /v1/screenings/{id}/referral", handleReferral)
	mux.HandleFunc("GET /v1/stats", handleStats)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           logging(cors(mux)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       20 * time.Second,
		WriteTimeout:      20 * time.Second,
	}

	go func() {
		log.Printf("sandhi sync server on %s — %d records in %s", *addr, store.Count(), *path)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("shutting down")
}

/* ------------------------------------------------------------ middleware -- */

// The dashboard is served from a different port in development and, in the
// field, from the phone's own file:// origin. Both need to reach this.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "content-type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (w *statusWriter) WriteHeader(c int) { w.code = c; w.ResponseWriter.WriteHeader(c) }

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, code: 200}
		t0 := time.Now()
		next.ServeHTTP(sw, r)
		if r.URL.Path != "/healthz" { // the dashboard polls this every 8 s
			log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.code, time.Since(t0).Round(time.Microsecond))
		}
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

/* -------------------------------------------------------------- handlers -- */

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{
		"ok":      true,
		"service": "sandhi-sync",
		"version": "0.4.0",
		"records": store.Count(),
		"uptime":  time.Since(started).Round(time.Second).String(),
	})
}

type ingestReq struct {
	ClientID   string             `json:"client_id"`
	Patient    string             `json:"patient"`
	District   string             `json:"district"`
	Risk       float64            `json:"risk"`
	Band       string             `json:"band"`
	Features   map[string]float64 `json:"features"`
	CapturedAt time.Time          `json:"captured_at"`
}

// Accepts one screening or a batch. The phone sends a batch when it comes back
// into coverage after a day in the hills.
func handleIngest(w http.ResponseWriter, r *http.Request) {
	body := http.MaxBytesReader(w, r.Body, 8<<20)
	raw, err := io.ReadAll(body)
	if err != nil {
		fail(w, 413, "body too large")
		return
	}

	var batch []ingestReq
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "[") {
		if err := json.Unmarshal(raw, &batch); err != nil {
			fail(w, 400, "malformed batch: "+err.Error())
			return
		}
	} else {
		var one ingestReq
		if err := json.Unmarshal(raw, &one); err != nil {
			fail(w, 400, "malformed body: "+err.Error())
			return
		}
		batch = []ingestReq{one}
	}

	created, duplicate := 0, 0
	for _, in := range batch {
		if in.ClientID == "" {
			fail(w, 400, "client_id is required — it is the idempotency key")
			return
		}
		if in.Band != "low" && in.Band != "watch" && in.Band != "refer" {
			fail(w, 400, "band must be low, watch or refer")
			return
		}
		if in.Risk < 0 || in.Risk > 1 {
			fail(w, 400, "risk must be within [0,1]")
			return
		}
		if in.CapturedAt.IsZero() {
			in.CapturedAt = time.Now().UTC()
		}
		rec := Screening{
			ClientID: in.ClientID, ServerID: newID(), Patient: in.Patient,
			District: in.District, Risk: in.Risk, Band: in.Band,
			Features: in.Features, CapturedAt: in.CapturedAt.UTC(),
			ReceivedAt: time.Now().UTC(),
		}
		// A referral flag is opened automatically; closing it is the district's job.
		if in.Band == "refer" {
			rec.Referral = &Referral{Status: "issued", UpdatedAt: time.Now().UTC()}
		}
		ok, err := store.Put(rec)
		if err != nil {
			fail(w, 500, "store: "+err.Error())
			return
		}
		if ok {
			created++
		} else {
			duplicate++
		}
	}
	writeJSON(w, 200, map[string]any{
		"accepted": len(batch), "created": created, "duplicate": duplicate,
		"total": store.Count(),
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := Filter{District: q.Get("district"), Band: q.Get("band"), Limit: 200}
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 2000 {
			f.Limit = n
		}
	}
	if v := q.Get("since"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.Since = t
		}
	}
	rows := store.List(f)
	writeJSON(w, 200, map[string]any{"count": len(rows), "screenings": rows})
}

func handleReferral(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var in struct {
		Status string `json:"status"`
		PHC    string `json:"phc"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		fail(w, 400, "malformed body")
		return
	}
	if in.Status != "issued" && in.Status != "seen" && in.Status != "declined" {
		fail(w, 400, "status must be issued, seen or declined")
		return
	}
	ref := Referral{Status: in.Status, PHC: in.PHC, UpdatedAt: time.Now().UTC()}
	if in.Status == "seen" {
		now := time.Now().UTC()
		ref.SeenAt = &now
	}
	if !store.SetReferral(id, ref) {
		fail(w, 404, "no screening with that client_id")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "client_id": id, "referral": ref})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	rows := store.List(Filter{})
	byBand := map[string]int{"low": 0, "watch": 0, "refer": 0}
	byDistrict := map[string]int{}
	referrals, seen := 0, 0
	for _, s := range rows {
		byBand[s.Band]++
		byDistrict[s.District]++
		if s.Referral != nil {
			referrals++
			if s.Referral.Status == "seen" {
				seen++
			}
		}
	}
	writeJSON(w, 200, map[string]any{
		"total": len(rows), "by_band": byBand, "by_district": byDistrict,
		"referrals": referrals, "referrals_seen": seen,
	})
}

/* ------------------------------------------------------------------ util -- */

var idSeq uint32

func newID() string {
	idSeq++
	return fmt.Sprintf("SRV-%d-%04d", time.Now().Unix(), idSeq)
}
