#!/bin/bash
# ResumeTailor — one-command startup

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "▶ Stopping DOCX server..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚡ ResumeTailor — ChatGPT Edition"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Python server ──────────────────────────────
echo ""
echo "▶ Starting DOCX server..."
cd "$SCRIPT_DIR/server"
if [ ! -d ".venv" ]; then
  echo "  Creating Python virtual environment..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
python main.py &
SERVER_PID=$!

for _ in {1..30}; do
  if curl -fsS http://localhost:7842/health >/dev/null 2>&1; then
    echo "  ✓ Server running on http://localhost:7842"
    break
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  ✗ Server failed to start."
    wait "$SERVER_PID"
    exit 1
  fi

  sleep 0.5
done

if ! curl -fsS http://localhost:7842/health >/dev/null 2>&1; then
  echo "  ✗ Server did not become ready at http://localhost:7842"
  exit 1
fi

# ── Web app ────────────────────────────────────
echo ""
echo "▶ Starting web app..."
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages..."
  npm install --silent
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐  Open →  http://localhost:3001"
echo "  🔧  Server → http://localhost:7842"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
