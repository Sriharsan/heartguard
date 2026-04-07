# VitalFlow – Cardiovascular Risk Analytics Platform

**Apache Spark · Framingham Heart Study · LR + RF + GBT Ensemble**  
*EXL Analytics · ML Engineering Division*

## Quick Start

```bash
# 1. Install dependencies (requires Java 11+, Python 3.10+)
pip install pyspark fastapi uvicorn pydantic --break-system-packages

# 2. Full stack (data setup → pipeline → API → dashboard)
bash run.sh all

# Individual steps
bash run.sh setup     # Generate Framingham dataset
bash run.sh pipeline  # Train Spark ML models
bash run.sh api       # Start FastAPI :8000
bash run.sh frontend  # Start React :3000
```

## Project Structure

```
vitalflow/
├── spark_pipeline/pipeline.py   # Core Spark ML pipeline (LR + RF + GBT)
├── api/main.py                  # FastAPI backend with Framingham scoring
├── frontend/src/                # React dashboard (4 pages)
├── data/
│   ├── download_data.py         # Dataset setup script
│   └── framingham.csv           # Generated after setup
├── models/gbt_cvd_v1/           # Serialized Spark GBT model (after pipeline)
├── reports/results.json         # Pipeline results (auto-generated)
├── requirements.txt
└── run.sh                       # One-command launcher
```

## Requirements

- Java 11+ (for Apache Spark)
- Python 3.10+
- Node.js 18+ (for React dashboard)
- 4 GB RAM minimum (8 GB recommended for Spark)
- Ubuntu 20.04+ / macOS / Windows (WSL2)

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/results` | GET | Full pipeline results |
| `/api/models` | GET | Model metrics |
| `/api/eda` | GET | EDA statistics |
| `/api/predict` | POST | Live CHD risk score |
| `/health` | GET | System health |
