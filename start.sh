#!/bin/bash
# ResumeTailor — one-command startup

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
echo "  ✓ Server running on http://localhost:7842"

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

# Cleanup
kill $SERVER_PID 2>/dev/null
