import sys
import os
import time
import uuid
from typing import List, Dict, Any, Union
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

# Ensure core and cv are in path if running directly for dev
sys.path.append(os.path.join(os.path.dirname(__file__), "../../core"))

# Try to import the local model for the ML check
try:
    from oa_core import assess, Assessment
    MODEL_AVAILABLE = True
except ImportError:
    MODEL_AVAILABLE = False
    print("Warning: oa_core not found. ML checks will be skipped.")

from .models import IngestReq, Screening, Referral, ReferralUpdate
from .store import FileStore

app = FastAPI(title="OA Early Detection API", version="0.4.0")

# CORS middleware equivalent to the Go server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["content-type"],
)

# Initialize store
store = FileStore("sandhi.log")
started = datetime.now(timezone.utc)

def new_id() -> str:
    return f"SRV-{int(time.time())}-{str(uuid.uuid4())[:8]}"

@app.get("/healthz")
def handle_health():
    uptime = datetime.now(timezone.utc) - started
    return {
        "ok": True,
        "service": "sandhi-sync",
        "version": "0.4.0",
        "records": store.count(),
        "uptime": str(uptime).split(".")[0],
    }

@app.post("/v1/screenings")
def handle_ingest(req_data: Union[IngestReq, List[IngestReq]]):
    # Accepts one screening or a batch
    if not isinstance(req_data, list):
        batch = [req_data]
    else:
        batch = req_data

    created = 0
    duplicate = 0
    
    for req in batch:
        if not req.client_id:
            raise HTTPException(status_code=400, detail="client_id is required — it is the idempotency key")
        if req.band not in ["low", "watch", "refer"]:
            raise HTTPException(status_code=400, detail="band must be low, watch or refer")
        if not (0 <= req.risk <= 1):
            raise HTTPException(status_code=400, detail="risk must be within [0,1]")
            
        captured_at = req.captured_at or datetime.now(timezone.utc)
        
        # --- Local ML Model Check ---
        server_risk = None
        server_band = None
        
        if MODEL_AVAILABLE:
            try:
                # Perform the local assessment check using oa_core
                # We map the incoming features to an Assessment object
                local_assessment = Assessment(
                    id=req.client_id,
                    patient_id=req.patient,
                    features=req.features
                )
                result = assess(local_assessment)
                server_risk = result.score_0_100 / 100.0  # Normalize to [0,1]
                server_band = result.band.lower()
            except Exception as e:
                print(f"Local ML model check failed: {e}")
        # ----------------------------

        rec = Screening(
            client_id=req.client_id,
            server_id=new_id(),
            patient=req.patient,
            district=req.district,
            risk=req.risk,
            band=req.band,
            features=req.features,
            captured_at=captured_at,
            received_at=datetime.now(timezone.utc),
            server_risk_check=server_risk,
            server_band_check=server_band
        )
        
        if req.band == "refer":
            rec.referral = Referral(status="issued", updated_at=datetime.now(timezone.utc))
            
        ok, err = store.put(rec)
        if err:
            raise HTTPException(status_code=500, detail=f"store: {str(err)}")
            
        if ok:
            created += 1
        else:
            duplicate += 1

    return {
        "accepted": len(batch),
        "created": created,
        "duplicate": duplicate,
        "total": store.count(),
    }

@app.get("/v1/screenings")
def handle_list(district: str = "", band: str = "", since: str = "", limit: int = 200):
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            pass # ignore invalid dates

    rows = store.list_records(district=district, band=band, since=since_dt, limit=limit)
    
    # Return as dicts instead of models so they match exactly the JSON structure
    return {
        "count": len(rows),
        "screenings": [r.model_dump(exclude_none=True) for r in rows]
    }

@app.post("/v1/screenings/{client_id}/referral")
def handle_referral(client_id: str, update: ReferralUpdate):
    if update.status not in ["issued", "seen", "declined"]:
        raise HTTPException(status_code=400, detail="status must be issued, seen or declined")
        
    ref = Referral(
        status=update.status,
        phc=update.phc,
        updated_at=datetime.now(timezone.utc)
    )
    
    if update.status == "seen":
        ref.seen_at = datetime.now(timezone.utc)
        
    if not store.set_referral(client_id, ref):
        raise HTTPException(status_code=404, detail="no screening with that client_id")
        
    return {
        "ok": True,
        "client_id": client_id,
        "referral": ref.model_dump(exclude_none=True)
    }

@app.get("/v1/stats")
def handle_stats():
    rows = store.list_records(limit=0) # get all
    by_band = {"low": 0, "watch": 0, "refer": 0}
    by_district = {}
    referrals = 0
    seen = 0
    
    for s in rows:
        by_band[s.band] = by_band.get(s.band, 0) + 1
        by_district[s.district] = by_district.get(s.district, 0) + 1
        
        if s.referral:
            referrals += 1
            if s.referral.status == "seen":
                seen += 1
                
    return {
        "total": len(rows),
        "by_band": by_band,
        "by_district": by_district,
        "referrals": referrals,
        "referrals_seen": seen,
    }
