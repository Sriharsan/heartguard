#!/bin/bash
# ============================================================
# HeartGuard - Full Stack Launch Script
# Usage: bash run.sh [pipeline|api|frontend|all]
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

banner() {
  echo ""
  echo -e "${RED}${BOLD}"
  echo "  ██╗  ██╗███████╗ █████╗ ██████╗ ████████╗"
  echo "  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚══██╔══╝"
  echo "  ███████║█████╗  ███████║██████╔╝   ██║   "
  echo "  ██╔══██║██╔══╝  ██╔══██║██╔══██╗   ██║   "
  echo "  ██║  ██║███████╗██║  ██║██║  ██║   ██║   "
  echo "  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝  "
  echo -e "${CYAN}  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗"
  echo "  ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗"
  echo "  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║"
  echo "  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║"
  echo "  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝"
  echo "   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ "
  echo -e "${NC}"
  echo -e "  ${BOLD}Big Data Analytics · Apache Spark · Heart Disease Prediction${NC}"
  echo -e "  ${YELLOW}IEEE Project | Full ML Pipeline | LR + RF + GBT Ensemble${NC}"
  echo ""
}

check_deps() {
  echo -e "${BLUE}[CHECK]${NC} Verifying dependencies..."
  command -v python3 >/dev/null || { echo -e "${RED}✗ python3 not found${NC}"; exit 1; }
  command -v java    >/dev/null || { echo -e "${RED}✗ Java not found (required for Spark)${NC}"; exit 1; }
  python3 -c "import pyspark" 2>/dev/null || { 
    echo -e "${YELLOW}Installing PySpark...${NC}"
    pip install pyspark fastapi uvicorn --break-system-packages -q
  }
  echo -e "  ${GREEN}✓ Python, Java, PySpark ready${NC}"
}

run_pipeline() {
  echo ""
  echo -e "${BLUE}[SPARK]${NC} ${BOLD}Running ML Pipeline...${NC}"
  echo -e "  Models: Logistic Regression · Random Forest · GBT"
  echo -e "  Data:   UCI Heart Disease (1,025 patients)"
  echo ""
  python3 spark_pipeline/pipeline.py
  echo -e "\n  ${GREEN}✓ Pipeline complete → reports/results.json${NC}"
}

run_api() {
  echo ""
  echo -e "${BLUE}[API]${NC} ${BOLD}Starting FastAPI server...${NC}"
  echo -e "  URL: ${CYAN}http://localhost:8000${NC}"
  echo -e "  Docs: ${CYAN}http://localhost:8000/docs${NC}"
  echo ""
  python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000
}

run_frontend() {
  echo ""
  echo -e "${BLUE}[UI]${NC} ${BOLD}Starting React dashboard...${NC}"
  echo -e "  URL: ${CYAN}http://localhost:3000${NC}"
  echo ""
  cd frontend
  if [ ! -d "node_modules" ]; then
    echo -e "  ${YELLOW}Installing npm packages...${NC}"
    npm install --silent
  fi
  npm start
}

run_all() {
  banner
  check_deps

  # Step 1: Pipeline
  if [ ! -f "reports/results.json" ]; then
    run_pipeline
  else
    echo -e "${GREEN}[SKIP]${NC} Pipeline results already exist (delete reports/results.json to re-run)"
  fi

  # Step 2: API in background
  echo ""
  echo -e "${BLUE}[API]${NC} Starting FastAPI in background..."
  python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 &
  API_PID=$!
  sleep 2
  echo -e "  ${GREEN}✓ API running (PID $API_PID) → http://localhost:8000${NC}"

  # Step 3: Frontend
  cd frontend
  if [ ! -d "node_modules" ]; then
    echo -e "\n${BLUE}[NPM]${NC} Installing packages..."
    npm install --silent
  fi
  echo ""
  echo -e "${BLUE}[UI]${NC} Starting React dashboard → ${CYAN}http://localhost:3000${NC}"
  echo ""
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ HeartGuard is live at http://localhost:3000${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════${NC}"
  echo ""
  npm start

  # Cleanup
  kill $API_PID 2>/dev/null
}

# ── Entry point ───────────────────────────────────────────────────────────────
case "${1:-all}" in
  pipeline)  banner; check_deps; run_pipeline ;;
  api)       banner; check_deps; run_api ;;
  frontend)  run_frontend ;;
  all)       run_all ;;
  *)
    echo "Usage: bash run.sh [pipeline|api|frontend|all]"
    echo "  pipeline  — Run Spark ML training only"
    echo "  api       — Start FastAPI backend only"
    echo "  frontend  — Start React dashboard only"
    echo "  all       — Run everything (default)"
    ;;
esac
