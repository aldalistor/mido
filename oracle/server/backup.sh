#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="${BASE_DIR:-/opt/onyx-server}"
BACKUP_DIR="${BACKUP_DIR:-${BASE_DIR}/backups}"
mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${BASE_DIR}/.env" ]]; then
  echo "ملف .env غير موجود في ${BASE_DIR}" >&2
  exit 1
fi

set -a
. "${BASE_DIR}/.env"
set +a

STAMP=$(date +%Y%m%d_%H%M%S)
DUMP="onyx_backup_${STAMP}.dmp"
LOG="onyx_backup_${STAMP}.log"

docker exec onyx-oracle bash -lc \
  "expdp system/\"\$ORACLE_PASSWORD\"@XEPDB1 full=y directory=DATA_PUMP_DIR dumpfile=${DUMP} logfile=${LOG} content=ALL"

docker cp "onyx-oracle:/opt/oracle/admin/XE/dpdump/${DUMP}" "${BACKUP_DIR}/${DUMP}" 2>/dev/null || \
docker cp "onyx-oracle:/opt/oracle/admin/XE/dpdump/XEPDB1/${DUMP}" "${BACKUP_DIR}/${DUMP}"

sha256sum "${BACKUP_DIR}/${DUMP}" > "${BACKUP_DIR}/${DUMP}.sha256"
find "${BACKUP_DIR}" -type f -mtime +14 -delete

echo "تم إنشاء النسخة الاحتياطية: ${BACKUP_DIR}/${DUMP}"
