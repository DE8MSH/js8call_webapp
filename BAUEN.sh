#!/usr/bin/env bash
# JS8Web LAB – standalone WebAssembly build, no Docker/venv.
set -euo pipefail
cd "$(dirname "$0")"
EXPORTS=(js8_input_ptr js8_decoded_ptr js8_tones_ptr js8_llr_ptr js8_type js8_encode js8_decode)
LINK_FLAGS=()
for s in "${EXPORTS[@]}"; do LINK_FLAGS+=("-Wl,--export=$s"); done
if command -v emcc >/dev/null 2>&1; then
  echo '[INFO] Emscripten gefunden – erstelle WASM mit emcc.'
  emcc js8-core.c -O3 -s STANDALONE_WASM=1 -Wl,--no-entry -Wl,--export-memory \
    "${LINK_FLAGS[@]}" -o js8-core.wasm
elif command -v clang >/dev/null 2>&1 && command -v wasm-ld >/dev/null 2>&1; then
  echo '[INFO] Baue freestanding WASM-Modul mit clang und wasm-ld.'
  clang --target=wasm32 -O3 -ffreestanding -fno-builtin -nostdlib \
    -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=524288 \
    -Wl,-z,stack-size=65536 "${LINK_FLAGS[@]}" \
    -o js8-core.wasm js8-core.c
else
  echo '[FEHLER] Weder emcc noch clang + wasm-ld verfügbar.' >&2
  exit 1
fi
ls -lh js8-core.wasm
if command -v node >/dev/null 2>&1; then node tests/test.mjs; fi
