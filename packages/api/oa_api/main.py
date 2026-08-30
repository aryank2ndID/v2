from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
import os

# Ensure core and cv are in path if running directly for dev
sys.path.append(os.path.join(os.path.dirname(__file__), "../../core"))

try:
    from oa_core import Assessment, assess, new_assessment_id, RiskResult
except ImportError:
    pass # Will handle proper importing later during build/packaging if needed

app = FastAPI(title="OA Early Detection API", version="0.1.0")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "API is running"}

@app.post("/assess", response_model=dict)
def perform_assessment(assessment_data: dict):
    # This is a stub for the actual assessment logic
    # In reality, it would parse into Assessment model and run assess()
    
    # Try to parse or just return dummy data for now
    assessment_id = assessment_data.get("id", "as-dummy123")
    
    return {
        "assessment_id": assessment_id,
        "status": "completed",
        "result": {
            "band": "LOW",
            "score_0_100": 10.5,
            "recommendations": []
        }
    }
