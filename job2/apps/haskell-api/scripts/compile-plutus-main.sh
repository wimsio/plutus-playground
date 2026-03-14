#!/usr/bin/env bash
set -euo pipefail

SRC_FILE="${1:?missing source file}"
TEMPLATE_ROOT="${2:?missing template root}"
JOB_ROOT="${3:?missing job root}"
ARTIFACT_OUT="${4:?missing artifact output}"
CABAL_HOME_DIR="${5:-/opt/cardano-ide/cabal-home}"

export CABAL_DIR="${CABAL_HOME_DIR}"

echo "[wrapper] source file: ${SRC_FILE}"
echo "[wrapper] template root: ${TEMPLATE_ROOT}"
echo "[wrapper] job root: ${JOB_ROOT}"
echo "[wrapper] artifact output: ${ARTIFACT_OUT}"
echo "[wrapper] CABAL_DIR: ${CABAL_DIR}"

if [ ! -f "${SRC_FILE}" ]; then
  echo "[wrapper] source file does not exist"
  exit 1
fi

if [ ! -d "${TEMPLATE_ROOT}" ]; then
  echo "[wrapper] template root does not exist"
  exit 1
fi

if [ ! -f "${TEMPLATE_ROOT}/cabal.project" ]; then
  echo "[wrapper] template cabal.project missing"
  exit 1
fi

if [ ! -d "${TEMPLATE_ROOT}/wspace" ]; then
  echo "[wrapper] template wspace directory missing"
  exit 1
fi

rm -rf "${JOB_ROOT}"
mkdir -p "${JOB_ROOT}"

cp "${TEMPLATE_ROOT}/cabal.project" "${JOB_ROOT}/cabal.project"
cp -R "${TEMPLATE_ROOT}/wspace" "${JOB_ROOT}/wspace"
cp -R "${TEMPLATE_ROOT}/Utilities" "${JOB_ROOT}/Utilities"

TARGET_MAIN="${JOB_ROOT}/wspace/app/Main.hs"
cp "${SRC_FILE}" "${TARGET_MAIN}"

if grep -Eq '^module[[:space:]]+[A-Za-z0-9_.]+[[:space:]]+where' "${TARGET_MAIN}"; then
  sed -E -i '0,/^module[[:space:]]+[A-Za-z0-9_.]+[[:space:]]+where/s//module Main where/' "${TARGET_MAIN}"
fi

echo "[wrapper] selected contract copied to ${TARGET_MAIN}"

cd "${JOB_ROOT}"

echo "[wrapper] building contract-exe"
cabal build contract-exe -j

echo "[wrapper] running contract-exe"
cabal run contract-exe

rm -rf "${ARTIFACT_OUT}"
mkdir -p "${ARTIFACT_OUT}"

FOUND=0

while IFS= read -r -d '' file; do
  FOUND=1
  base="$(basename "$file")"
  cp "$file" "${ARTIFACT_OUT}/${base}"
  echo "[wrapper] artifact copied: ${base}"
done < <(
  find "${JOB_ROOT}" -type f \
    ! -path "${JOB_ROOT}/dist-newstyle/*" \
    ! -path "${JOB_ROOT}/wspace/app/Main.hs" \
    \( \
      -name '*.plutus' -o \
      -name '*.cbor' -o \
      -name '*.json' -o \
      -name '*.script' -o \
      -name '*.addr' -o \
      -name '*.uplc' \
    \) -print0
)

if [ "${FOUND}" -eq 0 ]; then
  echo "[wrapper] no artifacts were generated"
  exit 1
fi

echo "[wrapper] artifacts stored in ${ARTIFACT_OUT}"
echo "[wrapper] done"