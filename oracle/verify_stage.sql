-- تشغيل هذا الملف داخل Schema ONYX_LEGACY_STAGE بعد impdp.

SET PAGESIZE 200
SET LINESIZE 220
SET FEEDBACK ON

PROMPT === Object counts ===
SELECT object_type, COUNT(*) AS object_count
FROM user_objects
GROUP BY object_type
ORDER BY object_type;

PROMPT === Core table presence ===
SELECT table_name
FROM user_tables
WHERE table_name IN (
  'ACCOUNT', 'ACCOUNT_TYPES', 'CUSTOMER', 'VENDOR',
  'ITEMS', 'ITEM_MOVEMENT', 'WAREHOUSE_DETAILS',
  'S_BRN', 'FORM_DETAIL', 'IAS_PARA_GEN', 'IAS_PARA_GL',
  'IAS_PARA_INV', 'IAS_PARA_AP', 'IAS_PARA_AR',
  'IAS_USR_LGN_HSTRY'
)
ORDER BY table_name;

PROMPT === Row counts for key tables ===
SELECT 'ACCOUNT' table_name, COUNT(*) row_count FROM ACCOUNT
UNION ALL SELECT 'CUSTOMER', COUNT(*) FROM CUSTOMER
UNION ALL SELECT 'VENDOR', COUNT(*) FROM VENDOR
UNION ALL SELECT 'ITEM_MOVEMENT', COUNT(*) FROM ITEM_MOVEMENT;

PROMPT === Invalid objects ===
SELECT object_name, object_type, status
FROM user_objects
WHERE status <> 'VALID'
ORDER BY object_type, object_name;

PROMPT === Foreign key count ===
SELECT COUNT(*) AS foreign_key_count
FROM user_constraints
WHERE constraint_type = 'R';
