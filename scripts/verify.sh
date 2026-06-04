#!/usr/bin/env bash

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "== Frontend unit tests =="
npm run test:frontend

echo ""
echo "== Frontend build =="
npm run build

echo ""
echo "== Backend Python compile =="
python3 -m py_compile server/main.py server/docx_engine.py

echo ""
echo "== Backend pytest =="
cd "$ROOT_DIR/server"
.venv/bin/pytest

echo ""
echo "== All checks passed =="
