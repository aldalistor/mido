#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="${BASE_DIR:-/opt/onyx-server}"
BACKUP_DIR="${BACKUP_DIR:-${BASE_DIR}/backups}"
DUMP="${1:-}"

if [[ -z "${DUMP}" || "${DUMP}" == */* || "${DUMP}" != *.dmp ]]; then
  echo "الاستخدام: restore.sh اسم_النسخة.dmp" >&2
  exit 2
fi
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "الاستعادة عملية مدمرة. أعد التشغيل بعد ضبط CONFIRM_RESTORE=YES." >&2
  exit 3
fi
if [[ ! -f "${BASE_DIR}/.env" ]]; then
  echo "ملف .env غير موجود في ${BASE_DIR}" >&2
  exit 1
fi
if [[ ! -f "${BACKUP_DIR}/${DUMP}" || ! -f "${BACKUP_DIR}/${DUMP}.sha256" ]]; then
  echo "ملف النسخة أو بصمته غير موجود: ${DUMP}" >&2
  exit 1
fi
(cd "${BACKUP_DIR}" && sha256sum --check "${DUMP}.sha256")

set -a
. "${BASE_DIR}/.env"
set +a

docker cp "${BACKUP_DIR}/${DUMP}" onyx-oracle:/tmp/"${DUMP}"
docker exec onyx-oracle bash -lc \
  "impdp system/\"\$ORACLE_PASSWORD\"@XEPDB1 full=y directory=DATA_PUMP_DIR dumpfile=${DUMP} table_exists_action=replace logfile=onyx_restore_${DUMP%.dmp}.log"

echo "تمت استعادة النسخة: ${BACKUP_DIR}/${DUMP}"
