const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

let activeConnection = null;
let activeConfig = null;

function normalize(config = {}) {
  return {
    engine: 'access',
    filePath: String(config.filePath || '').trim(),
    connectionString: String(config.connectionString || '').trim(),
  };
}

function connectionString(config) {
  if (config.connectionString) return config.connectionString;
  if (!config.filePath) throw new Error('مسار ملف Access مطلوب.');
  const file = config.filePath.replace(/\\/g, '\\\\');
  return `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${file};`;
}

async function ensureDatabaseFile(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  if (process.platform !== 'win32') throw new Error('إنشاء ملف Access تلقائيًا متاح على Windows فقط.');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const script = "$cat = New-Object -ComObject ADOX.Catalog; $cat.Create('Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + $args[0] + ';Jet OLEDB:Engine Type=5');";
  try { await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, filePath], { windowsHide: true }); }
  catch (error) { throw new Error(`تعذر إنشاء ملف Access تلقائيًا: ${error.message}`); }
  if (!fs.existsSync(filePath)) throw new Error('لم يتم إنشاء ملف Access. ثبّت Microsoft Access Database Engine 2016 64-bit.');
  return filePath;
}

async function open(config = {}) {
  let odbc;
  try { odbc = require('odbc'); } catch (_) { throw new Error('حزمة ODBC غير مثبتة. نفّذ npm install ثم أعد تشغيل التطبيق.'); }
  const normalized = normalize(config);
  if (!normalized.filePath && !normalized.connectionString) throw new Error('اختر ملف .accdb أو أدخل سلسلة اتصال Access.');
  try {
    const connection = await odbc.connect(connectionString(normalized));
    activeConnection = connection;
    activeConfig = normalized;
    return connection;
  } catch (error) {
    throw new Error(`تعذر فتح Access. تأكد من تثبيت Microsoft Access Database Engine 2016 Redistributable وODBC 64-bit: ${error.message}`);
  }
}

async function close() {
  if (activeConnection) {
    try { await activeConnection.close(); } finally { activeConnection = null; activeConfig = null; }
  }
}

async function test(config = {}) {
  const connection = await open(config);
  try {
    const result = await connection.query('SELECT 1 AS CONNECTION_OK');
    return { engine: 'access', connected: true, connectionOk: Boolean(result[0]?.CONNECTION_OK ?? true), filePath: activeConfig.filePath };
  } finally { await close(); }
}

async function initialize(config = {}) {
  const normalized = normalize(config);
  if (normalized.filePath) await ensureDatabaseFile(normalized.filePath);
  const connection = await open(normalized);
  const sqlText = value => `'${String(value ?? '').replace(/'/g, "''")}'`;
  const companyName = config.companyName || 'شركتي';
  const companyCode = config.companyCode || 'MAIN';
  const branchName = config.branchName || 'الفرع الرئيسي';
  const fiscalYear = Number(config.fiscalYear || new Date().getFullYear());
  const statements = [
    'CREATE TABLE ONYX_SCHEMA_VERSION (VERSION_NO VARCHAR(20) NOT NULL, APPLIED_AT DATETIME NOT NULL)',
    'CREATE TABLE ONYX_COMPANY (COMPANY_ID INTEGER NOT NULL, COMPANY_CODE VARCHAR(30) NOT NULL, COMPANY_NAME VARCHAR(200) NOT NULL, ACTIVE_FLAG INTEGER NOT NULL)',
    'CREATE TABLE ONYX_BRANCH (BRANCH_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, BRANCH_CODE VARCHAR(30) NOT NULL, BRANCH_NAME VARCHAR(200) NOT NULL, ACTIVE_FLAG INTEGER NOT NULL)',
    'CREATE TABLE ONYX_FISCAL_YEAR (FISCAL_YEAR_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, YEAR_NO INTEGER NOT NULL, START_DATE DATETIME NOT NULL, END_DATE DATETIME NOT NULL, STATUS_CODE VARCHAR(20) NOT NULL)',
    'CREATE TABLE ONYX_CURRENCY (CURRENCY_ID INTEGER NOT NULL, CURRENCY_CODE VARCHAR(10) NOT NULL, CURRENCY_NAME_AR VARCHAR(80) NOT NULL, SYMBOL VARCHAR(10), IS_BASE INTEGER NOT NULL, ACTIVE_FLAG INTEGER NOT NULL)',
    'CREATE TABLE ONYX_EXCHANGE_RATE (RATE_ID INTEGER NOT NULL, CURRENCY_CODE VARCHAR(10) NOT NULL, RATE_DATE DATETIME NOT NULL, RATE_TO_BASE DOUBLE NOT NULL, SOURCE VARCHAR(40))',
    'CREATE TABLE ONYX_SYSTEM_SETTING (SETTING_KEY VARCHAR(80) NOT NULL, SETTING_VALUE VARCHAR(255), SETTING_GROUP VARCHAR(50), UPDATED_AT DATETIME NOT NULL)',
    'CREATE TABLE ONYX_ACCOUNT (ACCOUNT_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, ACCOUNT_CODE VARCHAR(40) NOT NULL, ACCOUNT_NAME_AR VARCHAR(200) NOT NULL, ACCOUNT_TYPE VARCHAR(30) NOT NULL, PARENT_CODE VARCHAR(40), OPENING_BALANCE DOUBLE NOT NULL, ACTIVE_FLAG INTEGER NOT NULL)',
    'CREATE TABLE ONYX_CONTACT (CONTACT_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, CONTACT_TYPE VARCHAR(20) NOT NULL, CODE VARCHAR(40) NOT NULL, NAME_AR VARCHAR(200) NOT NULL, PHONE VARCHAR(50), EMAIL VARCHAR(200), ACTIVE_FLAG INTEGER NOT NULL)',
    'CREATE TABLE ONYX_ITEM (ITEM_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, ITEM_CODE VARCHAR(40) NOT NULL, ITEM_NAME_AR VARCHAR(200) NOT NULL, UNIT_NAME VARCHAR(40), COST_PRICE DOUBLE NOT NULL, SALE_PRICE DOUBLE NOT NULL, QUANTITY DOUBLE NOT NULL, REORDER_LEVEL DOUBLE NOT NULL, ACTIVE_FLAG INTEGER NOT NULL)',
    'CREATE TABLE ONYX_JOURNAL_ENTRY (ENTRY_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, BRANCH_ID INTEGER NOT NULL, ENTRY_NO VARCHAR(40) NOT NULL, ENTRY_DATE DATETIME NOT NULL, CURRENCY_CODE VARCHAR(10), EXCHANGE_RATE DOUBLE, DESCRIPTION_AR VARCHAR(500), STATUS_CODE VARCHAR(20) NOT NULL)',
    'CREATE TABLE ONYX_JOURNAL_LINE (LINE_ID INTEGER NOT NULL, ENTRY_ID INTEGER NOT NULL, ACCOUNT_ID INTEGER NOT NULL, DEBIT DOUBLE NOT NULL, CREDIT DOUBLE NOT NULL, FOREIGN_DEBIT DOUBLE, FOREIGN_CREDIT DOUBLE)',
    'CREATE TABLE ONYX_INVOICE (INVOICE_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, BRANCH_ID INTEGER NOT NULL, INVOICE_TYPE VARCHAR(20) NOT NULL, INVOICE_NO VARCHAR(40) NOT NULL, CONTACT_ID INTEGER, CURRENCY_CODE VARCHAR(10), EXCHANGE_RATE DOUBLE, TOTAL_AMOUNT DOUBLE NOT NULL, BASE_TOTAL_AMOUNT DOUBLE NOT NULL, STATUS_CODE VARCHAR(20) NOT NULL, VOIDED_AT DATETIME, VOIDED_BY VARCHAR(100), VOID_REASON VARCHAR(500), REVERSAL_ENTRY_ID INTEGER, SOURCE_INVOICE_ID INTEGER)',
    'CREATE TABLE ONYX_INVOICE_LINE (LINE_ID INTEGER NOT NULL, INVOICE_ID INTEGER NOT NULL, ITEM_ID INTEGER NOT NULL, ITEM_CODE VARCHAR(40), DESCRIPTION_AR VARCHAR(200), QUANTITY DOUBLE NOT NULL, UNIT_PRICE DOUBLE NOT NULL, LINE_TOTAL DOUBLE NOT NULL)',
    'CREATE TABLE ONYX_STOCK_MOVEMENT (MOVEMENT_ID INTEGER NOT NULL, ITEM_ID INTEGER NOT NULL, INVOICE_ID INTEGER, MOVEMENT_TYPE VARCHAR(30) NOT NULL, QUANTITY DOUBLE NOT NULL, UNIT_COST DOUBLE NOT NULL, MOVEMENT_DATE DATETIME NOT NULL)',
    'CREATE TABLE ONYX_AUDIT_LOG (AUDIT_ID INTEGER NOT NULL, USERNAME VARCHAR(100), ACTION_CODE VARCHAR(50) NOT NULL, ENTITY_NAME VARCHAR(100), ENTITY_ID VARCHAR(50), CREATED_AT DATETIME NOT NULL)'
  ];
  const results = [];
  try {
    for (const sql of statements) {
      try { await connection.query(sql); results.push({ status: 'created' }); }
      catch (error) { if (/already exists|exist|duplicate/i.test(error.message)) results.push({ status: 'exists' }); else throw error; }
    }
    const upgrades = ['ALTER TABLE ONYX_INVOICE ADD COLUMN VOIDED_AT DATETIME', 'ALTER TABLE ONYX_INVOICE ADD COLUMN VOIDED_BY VARCHAR(100)', 'ALTER TABLE ONYX_INVOICE ADD COLUMN VOID_REASON VARCHAR(500)', 'ALTER TABLE ONYX_INVOICE ADD COLUMN REVERSAL_ENTRY_ID INTEGER', 'ALTER TABLE ONYX_INVOICE ADD COLUMN SOURCE_INVOICE_ID INTEGER'];
    for (const sql of upgrades) { try { await connection.query(sql); } catch (error) { if (!/already exists|duplicate|defined/i.test(error.message)) throw error; } }
    const seed = [
      [`INSERT INTO ONYX_COMPANY (COMPANY_ID, COMPANY_CODE, COMPANY_NAME, ACTIVE_FLAG) VALUES (1, ${sqlText(companyCode)}, ${sqlText(companyName)}, 1)`],
      [`INSERT INTO ONYX_BRANCH (BRANCH_ID, COMPANY_ID, BRANCH_CODE, BRANCH_NAME, ACTIVE_FLAG) VALUES (1, 1, ${sqlText(companyCode)}, ${sqlText(branchName)}, 1)`],
      [`INSERT INTO ONYX_FISCAL_YEAR (FISCAL_YEAR_ID, COMPANY_ID, YEAR_NO, START_DATE, END_DATE, STATUS_CODE) VALUES (1, 1, ${fiscalYear}, DateSerial(${fiscalYear},1,1), DateSerial(${fiscalYear},12,31), 'OPEN')`],
      ['INSERT INTO ONYX_CURRENCY (CURRENCY_ID, CURRENCY_CODE, CURRENCY_NAME_AR, SYMBOL, IS_BASE, ACTIVE_FLAG) VALUES (1, \'SAR\', \'ريال سعودي\', \'ر.س\', 1, 1)'],
      ['INSERT INTO ONYX_CURRENCY (CURRENCY_ID, CURRENCY_CODE, CURRENCY_NAME_AR, SYMBOL, IS_BASE, ACTIVE_FLAG) VALUES (2, \'USD\', \'دولار أمريكي\', \'$\', 0, 1)'],
      ['INSERT INTO ONYX_CURRENCY (CURRENCY_ID, CURRENCY_CODE, CURRENCY_NAME_AR, SYMBOL, IS_BASE, ACTIVE_FLAG) VALUES (3, \'YER\', \'ريال يمني\', \'ر.ي\', 0, 1)']
    ];
    const accounts = [[1100,'1100','الأصول','ASSET',null],[1110,'1110','النقدية والصندوق','ASSET','1100'],[1120,'1120','البنوك','ASSET','1100'],[1200,'1200','العملاء','ASSET','1100'],[2100,'2100','الالتزامات','LIABILITY',null],[2110,'2110','الموردون','LIABILITY','2100'],[3100,'3100','حقوق الملكية','EQUITY',null],[4100,'4100','إيرادات المبيعات','REVENUE',null],[5100,'5100','تكلفة المبيعات','EXPENSE',null],[5200,'5200','المصروفات التشغيلية','EXPENSE',null]];
    for (const [id, code, name, type, parent] of accounts) seed.push([`INSERT INTO ONYX_ACCOUNT (ACCOUNT_ID, COMPANY_ID, ACCOUNT_CODE, ACCOUNT_NAME_AR, ACCOUNT_TYPE, PARENT_CODE, OPENING_BALANCE, ACTIVE_FLAG) VALUES (${id}, 1, ${sqlText(code)}, ${sqlText(name)}, ${sqlText(type)}, ${parent ? sqlText(parent) : 'NULL'}, 0, 1)`]);
    seed.push(["INSERT INTO ONYX_SYSTEM_SETTING (SETTING_KEY, SETTING_VALUE, SETTING_GROUP, UPDATED_AT) VALUES ('BASE_CURRENCY', 'SAR', 'ACCOUNTING', NOW())"]);
    seed.push(["INSERT INTO ONYX_SYSTEM_SETTING (SETTING_KEY, SETTING_VALUE, SETTING_GROUP, UPDATED_AT) VALUES ('INVOICE_PREFIX', 'INV-', 'NUMBERING', NOW())"]);
    seed.push(["INSERT INTO ONYX_SYSTEM_SETTING (SETTING_KEY, SETTING_VALUE, SETTING_GROUP, UPDATED_AT) VALUES ('TAX_RATE', '0', 'TAX', NOW())"]);
    for (const [sql] of seed) { try { await connection.query(sql); } catch (error) { if (!/duplicate|already exists|key/i.test(error.message)) throw error; } }
    try { await connection.query("INSERT INTO ONYX_SCHEMA_VERSION (VERSION_NO, APPLIED_AT) VALUES ('access-001', NOW())"); } catch (_) {}
    return { engine: 'access', initialized: true, version: 'access-001', tables: statements.length, results };
  } finally { await close(); }
}

function backup(config = {}, destination) {
  const source = normalize(config).filePath;
  if (!source || !fs.existsSync(source)) throw new Error('ملف Access المصدر غير موجود.');
  const target = destination || `${source}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(source, target);
  return { source, destination: target, size: fs.statSync(target).size };
}

module.exports = { normalize, connectionString, open, ensureDatabaseFile, test, initialize, backup, close };
