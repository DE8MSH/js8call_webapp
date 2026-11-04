#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo '=== JS8Web LAB: Linux Mint 22 – Umgebung ==='
for name in python3 node emcc clang wasm-ld; do
  if command -v "$name" >/dev/null 2>&1; then
    printf '[ OK ] %-10s %s\n' "$name" "$(command -v "$name")"
  else
    printf '[ -- ] %-10s nicht installiert\n' "$name"
  fi
done
for f in index.html app.css desktop-extra.css app.js desktop-extra.js jsc-tx.js rx-worker.js js8-core.c js8-core.wasm LICENSE; do
  test -s "$f" && echo "[ OK ] Datei $f" || { echo "[FEHLER] $f fehlt"; exit 1; }
done
if command -v node >/dev/null 2>&1; then node --check app.js && node --check desktop-extra.js && node --check jsc-tx.js && node --check rx-worker.js && node tests/test.mjs && node tests/jsc-tx.mjs; fi
echo '=== Start (HTTP zum Test): python3 -m http.server 8765 ==='
