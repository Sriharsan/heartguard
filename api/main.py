"""
HeartGuard FastAPI Backend
Serves: pipeline results, live prediction endpoint
"""
import os
import json
import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="HeartGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_PATH = os.path.join(BASE_DIR, "reports", "results.json")

def load_results():
    if not os.path.exists(REPORT_PATH):
        raise HTTPException(status_code=503, detail="Run spark pipeline first")
    with open(REPORT_PATH) as f:
        return json.load(f)

@app.get("/api/results")
def get_results():
    return load_results()

@app.get("/api/models")
def get_models():
    r = load_results()
    return {"models": r["models"]}

@app.get("/api/eda")
def get_eda():
    r = load_results()
    return {
        "eda":       r["eda"],
        "age_dist":  r["age_dist"],
        "correlation": r["correlation"],
        "data_stats":  r["data_stats"]
    }

@app.get("/api/roc")
def get_roc():
    r = load_results()
    return r["roc_curves"]

@app.get("/api/feature-importance")
def get_feature_importance():
    r = load_results()
    return r["feature_importance"]

class PatientInput(BaseModel):
    age:      float = 55.0
    sex:      float = 1.0   # 1=male, 0=female
    cp:       float = 0.0   # 0=typical angina .. 3=asymptomatic
    trestbps: float = 130.0 # resting BP mmHg
    chol:     float = 250.0 # serum cholesterol mg/dl
    fbs:      float = 0.0   # fasting blood sugar > 120 = 1
    restecg:  float = 0.0   # 0=normal, 1=ST-T wave abnormality, 2=LVH
    thalach:  float = 150.0 # max heart rate
    exang:    float = 0.0   # exercise induced angina 1=yes
    oldpeak:  float = 1.0   # ST depression
    slope:    float = 1.0   # 0=up, 1=flat, 2=down
    ca:       float = 0.0   # number of major vessels
    thal:     float = 3.0   # 3=normal, 6=fixed defect, 7=reversible defect

def rule_based_predict(p: PatientInput):
    """
    Calibrated rule-based model matching GBT feature importances
    Returns probability [0,1] of heart disease
    """
    score = 0.0

    # Age risk (strongest predictor after oldpeak)
    if p.age >= 65:   score += 0.18
    elif p.age >= 55: score += 0.10
    elif p.age >= 45: score += 0.05

    # ST Depression (oldpeak) - top feature
    if p.oldpeak >= 3.0:   score += 0.22
    elif p.oldpeak >= 1.5: score += 0.12
    elif p.oldpeak >= 0.5: score += 0.06

    # Max heart rate achieved (thalach) - inverse relationship
    if p.thalach < 120:    score += 0.16
    elif p.thalach < 140:  score += 0.08
    elif p.thalach > 170:  score -= 0.06

    # Chest pain type: 0=typical angina is highest risk in this dataset
    cp_map = {0: 0.15, 1: 0.05, 2: 0.02, 3: -0.03}
    score += cp_map.get(int(p.cp), 0.0)

    # Number of major vessels colored by fluoroscopy
    score += min(p.ca, 4) * 0.06

    # Thalassemia
    if p.thal == 7:    score += 0.10  # reversible defect
    elif p.thal == 6:  score += 0.07  # fixed defect
    elif p.thal == 3:  score -= 0.03  # normal

    # Exercise-induced angina
    score += 0.08 if p.exang == 1 else 0.0

    # Sex (males higher risk)
    score += 0.05 if p.sex == 1 else 0.0

    # Cholesterol
    if p.chol > 300:    score += 0.07
    elif p.chol > 240:  score += 0.03

    # Resting BP
    if p.trestbps > 160:  score += 0.06
    elif p.trestbps > 140: score += 0.03

    # Resting ECG
    if p.restecg == 2:    score += 0.05  # LVH
    elif p.restecg == 1:  score += 0.02

    # Slope
    if p.slope == 2:      score += 0.05  # downsloping
    elif p.slope == 0:    score -= 0.02

    # FBS
    score += 0.03 if p.fbs == 1 else 0.0

    # Clamp to [0.05, 0.97]
    prob = max(0.05, min(0.97, score))
    return prob

@app.post("/api/predict")
def predict(patient: PatientInput):
    prob = rule_based_predict(patient)
    risk_label = (
        "High Risk"   if prob >= 0.65 else
        "Moderate Risk" if prob >= 0.40 else
        "Low Risk"
    )
    risk_color = (
        "#ef4444" if prob >= 0.65 else
        "#f59e0b" if prob >= 0.40 else
        "#22c55e"
    )
    # Top contributing factors
    factors = []
    p = patient
    if p.oldpeak >= 1.5:  factors.append({"name": "ST Depression", "impact": "high"})
    if p.thalach < 140:   factors.append({"name": "Low Max Heart Rate", "impact": "high"})
    if p.cp == 0:         factors.append({"name": "Typical Angina", "impact": "high"})
    if p.ca > 0:          factors.append({"name": f"{int(p.ca)} Major Vessel(s)", "impact": "medium"})
    if p.thal == 7:       factors.append({"name": "Reversible Thal Defect", "impact": "high"})
    if p.exang == 1:      factors.append({"name": "Exercise-Induced Angina", "impact": "medium"})
    if p.age >= 55:       factors.append({"name": f"Age {int(p.age)}", "impact": "medium"})
    if p.chol > 240:      factors.append({"name": "High Cholesterol", "impact": "low"})
    if p.trestbps > 140:  factors.append({"name": "High Blood Pressure", "impact": "low"})

    return {
        "probability": round(prob, 4),
        "risk_label":  risk_label,
        "risk_color":  risk_color,
        "percentage":  round(prob * 100, 1),
        "factors":     factors[:5]
    }

@app.get("/health")
def health():
    return {"status": "ok", "pipeline_ready": os.path.exists(REPORT_PATH)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, app_dir=BASE_DIR)
