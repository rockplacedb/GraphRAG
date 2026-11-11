#!/usr/bin/env sh
# 모두몰 지식 그래프 학습 대시보드 — 로컬 실행 스크립트 (macOS/Linux)
# 사용법: ./start.sh [포트]   (기본 4321)
set -e
cd "$(dirname "$0")"
PORT="${1:-4321}"

if command -v node >/dev/null 2>&1; then
  echo "[start] http://127.0.0.1:${PORT}/  (Node.js)"
  exec node scripts/serve.mjs "$PORT"
fi

if command -v python3 >/dev/null 2>&1; then
  echo "[start] http://127.0.0.1:${PORT}/  (Python)"
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
fi

echo "[오류] Node.js 또는 Python 3가 필요합니다."
echo "  - Node.js: https://nodejs.org/"
exit 1
