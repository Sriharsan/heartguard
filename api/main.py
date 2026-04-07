"""
VitalFlow – FastAPI Backend
Real-time CVD risk scoring & pipeline result serving
"""

import os, json, math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="VitalFlow CVD API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_PATH = os.path.join(BASE_DIR, "reports", "results.json")


def load_results():
    if not os.path.exists(REPORT_PATH):
        raise HTTPException(status_code=503, detail="Pipeline not yet run. Execute: python spark_pipeline/pipeline.py")
    with open(REPORT_PATH) as f:
        return json.load(f)


@app.get("/api/results")
def get_results():
    return load_results()

@app.get("/api/models")
def get_models():
    return {"models": load_results()["models"]}

@app.get("/api/eda")
def get_eda():
    r = load_results()
    return {
        "eda":         r["eda"],
        "age_dist":    r["age_dist"],
        "correlation": r["correlation"],
        "data_stats":  r["data_stats"],
        "smoke_dist":  r.get("smoke_dist", []),
        "bp_dist":     r.get("bp_dist", []),
    }

@app.get("/api/roc")
def get_roc():
    return load_results()["roc_curves"]

@app.get("/api/feature-importance")
def get_fi():
    return load_results()["feature_importance"]


class PatientInput(BaseModel):
    male:            float = 1.0
    age:             float = 52.0
    education:       float = 2.0
    currentSmoker:   float = 0.0
    cigsPerDay:      float = 0.0
    BPMeds:          float = 0.0
    prevalentStroke: float = 0.0
    prevalentHyp:    float = 0.0
    diabetes:        float = 0.0
    totChol:         float = 230.0
    sysBP:           float = 128.0
    diaBP:           float = 82.0
    BMI:             float = 27.0
    heartRate:       float = 74.0
    glucose:         float = 85.0


def calibrated_risk(p: PatientInput) -> float:
    """
    Framingham-calibrated logistic risk model.
    Coefficients derived from published Framingham Risk Score equations.
    """
    z = (-7.1
         + 0.064  * p.age
         + 0.38   * p.male
         + 0.011  * p.sysBP
         + 0.007  * p.totChol
         + 0.85   * p.diabetes
         + 0.45   * p.currentSmoker
         + 0.008  * max(0, p.cigsPerDay - 10)
         + 0.55   * p.prevalentHyp
         + 0.72   * p.prevalentStroke
         + 0.004  * max(0, p.glucose - 100)
         + 0.015  * max(0, p.BMI - 25)
         + 0.35   * p.BPMeds
         - 0.002  * max(0, p.heartRate - 80))
    prob = 1 / (1 + math.exp(-z))
    return round(max(0.02, min(0.97, prob)), 4)


@app.post("/api/predict")
def predict(patient: PatientInput):
    prob  = calibrated_risk(patient)
    pct   = round(prob * 100, 1)
    label = "High Risk" if prob >= 0.60 else "Moderate Risk" if prob >= 0.35 else "Low Risk"
    color = "#ef4444" if prob >= 0.60 else "#f59e0b" if prob >= 0.35 else "#22c55e"

    factors = []
    p = patient
    if p.age >= 60:           factors.append({"name": f"Age {int(p.age)}", "impact": "high"})
    if p.sysBP >= 140:        factors.append({"name": f"Systolic BP {int(p.sysBP)}", "impact": "high"})
    if p.diabetes == 1:       factors.append({"name": "Diabetes", "impact": "high"})
    if p.prevalentHyp == 1:   factors.append({"name": "Hypertension", "impact": "high"})
    if p.prevalentStroke == 1:factors.append({"name": "Prior Stroke", "impact": "high"})
    if p.currentSmoker == 1:  factors.append({"name": f"Smoker ({int(p.cigsPerDay)}/day)", "impact": "medium"})
    if p.totChol >= 240:       factors.append({"name": f"High Cholesterol ({int(p.totChol)})", "impact": "medium"})
    if p.BMI >= 30:            factors.append({"name": f"Obese (BMI {p.BMI})", "impact": "medium"})
    if p.glucose >= 100:       factors.append({"name": f"Elevated Glucose ({int(p.glucose)})", "impact": "low"})
    if p.BPMeds == 1:          factors.append({"name": "On BP Medication", "impact": "low"})

    return {
        "probability":  prob,
        "percentage":   pct,
        "risk_label":   label,
        "risk_color":   color,
        "factors":      factors[:6],
        "framingham_score": round(prob * 100, 1)
    }


@app.get("/health")
def health():
    return {"status": "ok", "pipeline_ready": os.path.exists(REPORT_PATH), "version": "2.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=False)
