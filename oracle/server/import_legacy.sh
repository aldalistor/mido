#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="${BASE_DIR:-/opt/onyx-server}"
DUMP_NAME="${1:-onyx_legacy.dmp}"

if [[ ! -f "${BASE_DIR}/imports/${DUMP_NAME}" ]]; then
  echo "ضع ملف Data Pump داخل ${BASE_DIR}/imports/${DUMP_NAME}" >&2
  exit 1
fi

set -a
. "${BASE_DIR}/.env"
set +a

# ينسخ الملف إلى الحاوية دون تغيير المصدر الأصلي.
docker cp "${BASE_DIR}/imports/${DUMP_NAME}" onyx-oracle:/opt/oracle/admin/XE/dpdump/"${DUMP_NAME}"

# استخراج DDL للمراجعة قبل إنشاء الكائنات.
docker exec onyx-oracle bash -lc \
  "impdp system/\"\$ORACLE_PASSWORD\"@XEPDB1 directory=DATA_PUMP_DIR dumpfile=${DUMP_NAME} schemas=RUSERS sqlfile=/tmp/onyx_metadata.sql logfile=/tmp/onyx_metadata.log"

docker cp onyx-oracle:/tmp/onyx_metadata.sql "${BASE_DIR}/imports/onyx_metadata.sql"
docker cp onyx-oracle:/tmp/onyx_metadata.log "${BASE_DIR}/imports/onyx_metadata.log"

echo "تم استخراج Metadata. راجع ${BASE_DIR}/imports/onyx_metadata.sql قبل الاستيراد."
read -r -p "اكتب IMPORT الآن لتنفيذ الاستيراد إلى ONYX_LEGACY_STAGE: " CONFIRM
if [[ "${CONFIRM}" != "IMPORT" ]]; then
  echo "تم الإلغاء دون استيراد."
  exit 0
fi

docker exec onyx-oracle bash -lc \
  "impdp system/\"\$ORACLE_PASSWORD\"@XEPDB1 directory=DATA_PUMP_DIR dumpfile=${DUMP_NAME} schemas=RUSERS remap_schema=RUSERS:ONYX_LEGACY_STAGE exclude=USER,GRANT logfile=/tmp/onyx_import.log"

docker cp onyx-oracle:/tmp/onyx_import.log "${BASE_DIR}/imports/onyx_import.log"
echo "اكتمل الاستيراد المرحلي. راجع سجل الاستيراد قبل ربط التطبيق."
