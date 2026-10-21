#!/bin/zsh
set -e
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22 이상 설치가 필요합니다. README를 확인하세요."
  read "?Enter를 누르면 닫힙니다."
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run build
npm run play
echo "브라우저에서 http://127.0.0.1:5173/ 를 여세요."
