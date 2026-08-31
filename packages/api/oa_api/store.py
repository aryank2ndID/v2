import json
import os
import threading
from datetime import datetime
from typing import List, Optional, Tuple, Dict
from pydantic import ValidationError

from .models import Screening, Referral

class FileStore:
    def __init__(self, path: str = "sandhi.log"):
        self.path = path
        self.idx: Dict[str, Screening] = {}
        self.ord: List[str] = []
        self.lock = threading.RLock()
        
        self._replay()
        
        # Open in append mode
        self.f = open(self.path, "a", encoding="utf-8")

    def _replay(self):
        if not os.path.exists(self.path):
            return
            
        with open(self.path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    rec = Screening(**data)
                    
                    if rec.client_id not in self.idx:
                        self.ord.append(rec.client_id)
                    self.idx[rec.client_id] = rec
                except (json.JSONDecodeError, ValidationError) as e:
                    print(f"store: skipping unreadable line {line_num}: {e}")

    def _append(self, rec: Screening) -> None:
        # Pydantic v2 model_dump_json handles datetime serialization
        line = rec.model_dump_json() + "\n"
        self.f.write(line)
        self.f.flush()
        os.fsync(self.f.fileno())

    def put(self, rec: Screening) -> Tuple[bool, Exception]:
        with self.lock:
            if rec.client_id in self.idx:
                return False, None # idempotent: retry is a no-op
                
            try:
                self._append(rec)
            except Exception as e:
                return False, e
                
            self.idx[rec.client_id] = rec
            self.ord.append(rec.client_id)
            return True, None

    def get(self, client_id: str) -> Tuple[Optional[Screening], bool]:
        with self.lock:
            rec = self.idx.get(client_id)
            if not rec:
                return None, False
            return rec, True

    def list_records(self, district: str = "", band: str = "", since: Optional[datetime] = None, limit: int = 200) -> List[Screening]:
        with self.lock:
            out = []
            for client_id in self.ord:
                r = self.idx[client_id]
                if district and r.district != district:
                    continue
                if band and r.band != band:
                    continue
                if since and r.captured_at.tzinfo is None and since.tzinfo is not None:
                    # simplistic tz handling, assume UTC
                    if r.captured_at < since.replace(tzinfo=None):
                        continue
                elif since and r.captured_at < since:
                    continue
                    
                out.append(r)
                
            # Sort descending by captured_at
            out.sort(key=lambda x: x.captured_at, reverse=True)
            
            if limit > 0:
                out = out[:limit]
            return out

    def set_referral(self, client_id: str, ref: Referral) -> bool:
        with self.lock:
            rec = self.idx.get(client_id)
            if not rec:
                return False
                
            # Create a copy with the updated referral
            updated_data = rec.model_dump()
            updated_data['referral'] = ref.model_dump()
            updated = Screening(**updated_data)
            
            try:
                self._append(updated)
            except Exception as e:
                print(f"Error appending referral update: {e}")
                return False
                
            self.idx[client_id] = updated
            return True

    def count(self) -> int:
        with self.lock:
            return len(self.idx)
