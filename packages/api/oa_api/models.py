from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime

class Referral(BaseModel):
    status: str
    phc: Optional[str] = None
    updated_at: datetime
    seen_at: Optional[datetime] = None

class Screening(BaseModel):
    client_id: str
    server_id: str
    patient: str
    district: str
    risk: float
    band: str
    features: Dict[str, float]
    captured_at: datetime
    received_at: datetime
    referral: Optional[Referral] = None
    
    # Optional field to store the local server's ML model check result
    # We add this since we are replacing the Go server specifically to do ML checks locally.
    server_risk_check: Optional[float] = None
    server_band_check: Optional[str] = None

class IngestReq(BaseModel):
    client_id: str
    patient: str
    district: str
    risk: float
    band: str
    features: Dict[str, float]
    captured_at: Optional[datetime] = None

class ReferralUpdate(BaseModel):
    status: str
    phc: Optional[str] = None
