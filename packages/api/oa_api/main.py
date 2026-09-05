import sys
import os
import time
import uuid
import json
from typing import List, Dict, Any, Union
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

# Ensure core and cv are in path if running directly for dev
sys.path.append(os.path.join(os.path.dirname(__file__), "../../core"))

# The phone and the web ship the SAME 27-feature GBM that ml/train.py writes.
# Resolve it from this repo so the server can re-score every inbound record
# against the artifact the clients carry — the tamper check.
_ML_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml"))
sys.path.append(_ML_ROOT)

try:
    import numpy as np
    from gbm import GBM
    from features import FEATURE_NAMES, to_vector
    _CHECK_MODEL = None
    _check_model_path = os.path.join(_ML_ROOT, "out", "model.json")
    if os.path.exists(_check_model_path):
        with open(_check_model_path) as f:
            _check_doc = json.load(f)
            _CHECK_MODEL = GBM.from_json(_check_doc)
            _b = _check_doc.get("bands", {"low": 0.1, "refer": 0.185})
            _CHECK_MODEL_BAND_LOW = float(_b.get("low", 0.1))
            _CHECK_MODEL_BAND_REFER = float(_b.get("refer", 0.185))
    MODEL_AVAILABLE = _CHECK_MODEL is not None
except Exception as e:  # noqa: BLE001
    MODEL_AVAILABLE = False
    _CHECK_MODEL = None
    print(f"Warning: oa_core/GBM not found. ML checks will be skipped. ({e})")

# The ^NER- patient_id pattern lives on oa_core.schema.Patient, which the ingest
# path no longer constructs: the client's `patient` is a display name and
# `client_id` is the idempotency key. oa_core remains importable for the rule
# engine but the GBM cross-check above is the substantive server-side check.

from .models import IngestReq, Screening, Referral, ReferralUpdate
from .store import FileStore

app = FastAPI(title="OA Early Detection API", version="0.4.0")

# CORS is locked down, not open by default. A browser tab on an arbitrary site
# must not be able to POST screenings into this server (classic localhost-service
# attack). Dev host is allowed on any local port; production origins are set via
# SANDHI_CORS_ORIGINS (comma-separated). No cookies/tokens are involved in the
# browser flow, so allow_credentials stays False.
_cors_origins = [o.strip() for o in os.environ.get("SANDHI_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["http://localhost:4321", "http://127.0.0.1:4321"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$" if not _cors_origins else None,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["content-type", "authorization"],
)

# Optional write gate for deployments that hold real patient records:
#   SANDHI_SYNC_TOKEN=<secret>   -> /v1/screenings and referral updates demand
#                                   "Authorization: Bearer <secret>".
# Unset for the local demo; set it the moment the log holds real PHI.
SYNC_TOKEN = os.environ.get("SANDHI_SYNC_TOKEN", "")

def _check_auth(authorization: str | None) -> None:
    if SYNC_TOKEN:
        if not authorization or authorization != f"Bearer {SYNC_TOKEN}":
            raise HTTPException(status_code=401, detail="missing or invalid sync token")

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
def handle_ingest(req_data: Union[IngestReq, List[IngestReq]], request: Request):
    _check_auth(request.headers.get("authorization"))
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
        # Score the inbound 27-feature vector with the same artifact the phone
        # ships. If the client compressed or edited its features/risk, the
        # server-side probability will not agree with the reported band.
        server_risk = None
        server_band = None

        if MODEL_AVAILABLE and _CHECK_MODEL is not None:
            try:
                vec = np.zeros(len(FEATURE_NAMES))
                for i, n in enumerate(FEATURE_NAMES):
                    if n in req.features:
                        vec[i] = float(req.features[n])
                p = float(_CHECK_MODEL.predict_proba(vec.reshape(1, -1))[0])
                server_risk = p
                server_band = "refer" if p >= _CHECK_MODEL_BAND_REFER \
                    else "low" if p < _CHECK_MODEL_BAND_LOW else "watch"
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
def handle_referral(client_id: str, update: ReferralUpdate, request: Request):
    _check_auth(request.headers.get("authorization"))
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
