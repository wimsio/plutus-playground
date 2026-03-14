#!/usr/bin/env bash
set -euo pipefail

BUILD_ROOT="${1:-}"
SELECTED_PATH="${2:-}"

if [ -z "$BUILD_ROOT" ]; then
  echo "[compile] missing build root"
  exit 1
fi

if [ ! -d "$BUILD_ROOT" ]; then
  echo "[compile] build root does not exist: $BUILD_ROOT"
  exit 1
fi

cd "$BUILD_ROOT"

echo "[compile] running in $BUILD_ROOT"
if [ -n "$SELECTED_PATH" ]; then
  echo "[compile] selected file: $SELECTED_PATH"
fi

if [ ! -f "cabal.project" ] && ! ls ./*.cabal >/dev/null 2>&1; then
  echo "[compile] no cabal.project or .cabal file found in build root"
  exit 1
fi

mkdir -p artifacts

echo "[compile] cabal build"
cabal build

if [ ! -d "app" ]; then
  echo "[compile] no app directory found, skipping export executables"
  echo "[compile] finished"
  exit 0
fi

EXPORTS=()
while IFS= read -r file; do
  base="$(basename "$file" .hs)"
  EXPORTS+=("$base")
done < <(find app -maxdepth 1 -type f -name 'export*.hs' | sort)

if [ "${#EXPORTS[@]}" -eq 0 ]; then
  echo "[compile] no export executables found in app/"
  echo "[compile] finished"
  exit 0
fi

for exe in "${EXPORTS[@]}"; do
  echo "[export] running $exe"
  cabal run "$exe"
  echo "[export] $exe succeeded"
done

echo "[artifacts] generated files:"
if [ -d "artifacts" ]; then
  find artifacts -maxdepth 5 -type f | sort | sed 's#^#- #'
else
  echo "- none"
fi

echo "[compile] finished"