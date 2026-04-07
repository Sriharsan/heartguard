#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  VitalFlow – Cardiovascular Risk Analytics Platform
#  Usage:  bash run.sh [setup|pipeline|api|frontend|all]
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

R='\033[0;31m'; G='\033[0;32m'; B='\033[0;34m'
Y='\033[1;33m'; C='\033[0;36m'; W='\033[1m'; N='\033[0m'

banner() {
printf "${C}${W}
  ╔═══════════════════════════════════════════════╗
  ║   ██╗   ██╗██╗████████╗ █████╗ ██╗            ║
  ║   ██║   ██║██║╚══██╔══╝██╔══██╗██║            ║
  ║   ██║   ██║██║   ██║   ███████║██║            ║
  ║   ╚██╗ ██╔╝██║   ██║   ██╔══██║██║            ║
  ║    ╚████╔╝ ██║   ██║   ██║  ██║███████╗       ║
  ║     ╚═══╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝       ║
  ║        F L O W                                 ║
  ╠═══════════════════════════════════════════════╣
  ║  Cardiovascular Risk Analytics · Apache Spark ║
  ║  Framingham Study · LR + RF + GBT Ensemble   ║
  ╚═══════════════════════════════════════════════╝
${N}"
}

check_deps() {
  echo -e "${B}[CHECK]${N} Verifying dependencies..."
  command -v python3 >/dev/null || { echo -e "${R}✗ python3 required${N}"; exit 1; }
  command -v java    >/dev/null || { echo -e "${R}✗ Java required for Apache Spark${N}"; exit 1; }
  python3 -c "import pyspark" 2>/dev/null || {
    echo -e "${Y}  Installing Python dependencies...${N}"
    pip install pyspark fastapi uvicorn pydantic --break-system-packages -q
  }
  echo -e "  ${G}✓ Dependencies verified${N}"
}

setup_data() {
  echo -e "${B}[DATA]${N} Setting up Framingham dataset..."
  python3 data/download_data.py
  echo -e "  ${G}✓ Dataset ready${N}"
}

run_pipeline() {
  echo -e "${B}[SPARK]${N} ${W}Launching Apache Spark ML Pipeline...${N}"
  echo -e "  Dataset : Framingham Heart Study"
  echo -e "  Models  : Logistic Regression · Random Forest · GBT"
  echo ""
  python3 spark_pipeline/pipeline.py
  echo -e "\n  ${G}✓ Pipeline complete → reports/results.json${N}"
}

run_api() {
  echo -e "${B}[API]${N} ${W}Starting FastAPI server on :8000${N}"
  python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
}

run_frontend() {
  echo -e "${B}[UI]${N} ${W}Starting React dashboard on :3000${N}"
  cd frontend
  [ ! -d node_modules ] && npm install --silent
  npm start
}

run_all() {
  banner
  check_deps
  setup_data

  [ ! -f reports/results.json ] && run_pipeline || \
    echo -e "${G}[SKIP]${N} Pipeline results cached. Delete reports/results.json to re-run."

  echo -e "\n${B}[API]${N} Starting backend..."
  python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 &
  API_PID=$!
  sleep 2
  echo -e "  ${G}✓ API live → http://localhost:8000/docs  (PID $API_PID)${N}"

  cd frontend
  [ ! -d node_modules ] && npm install --silent
  echo -e "\n${C}${W}══════════════════════════════════════════${N}"
  echo -e "${G}  ✅  VitalFlow  →  http://localhost:3000${N}"
  echo -e "${C}${W}══════════════════════════════════════════${N}\n"
  npm start

  kill "$API_PID" 2>/dev/null || true
}

case "${1:-all}" in
  setup)    banner; check_deps; setup_data ;;
  pipeline) banner; check_deps; run_pipeline ;;
  api)      banner; check_deps; run_api ;;
  frontend) run_frontend ;;
  all)      run_all ;;
  *)
    echo "Usage: bash run.sh [setup|pipeline|api|frontend|all]"
    echo "  setup    – Download/generate Framingham dataset"
    echo "  pipeline – Run Spark ML training"
    echo "  api      – Start FastAPI backend"
    echo "  frontend – Start React dashboard"
    echo "  all      – Full stack (default)"
    ;;
esac
