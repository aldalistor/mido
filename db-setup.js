const fs = require('fs');
const path = require('path');

const oracleMigrations = [
  'oracle/001_security_and_fiscal_schema.sql',
  'oracle/migrations/004_core_accounting_schema.sql',
  'oracle/migrations/005_operations_schema.sql',
  'oracle/migrations/006_security_roles_permissions.sql',
  'oracle/migrations/008_accounting_posting_core.sql',
  'oracle/migrations/009_invoice_posting_and_stock.sql',
  'oracle/migrations/010_audit_immutability.sql'
];

function normalize(config = {}) {
  return {
    engine: String(config.engine || 'oracle').toLowerCase(),
    host: String(config.host || '127.0.0.1'),
    port: Number(config.port || (String(config.engine).toLowerCase() === 'sqlserver' ? 1433 : 1521)),
    service: String(config.service || config.database || 'XEPDB1'),
    database: String(config.database || config.service || ''),
    username: String(config.username || ''),
    password: String(config.password || ''),
    filePath: String(config.filePath || ''),
    encrypt: config.encrypt !== false,
    trustServerCertificate: config.trustServerCertificate === true
  };
}

function oracleConnectString(config) { return config.connectString || `${config.host}:${config.port}/${config.service}`; }

async function oracleConnection(config) {
  let oracledb;
  try { oracledb = require('oracledb'); } catch (_) { throw new Error('موصل Oracle غير مثبت. نفّذ npm install ثم أعد تشغيل التطبيق.'); }
  if (!config.username || !config.password) throw new Error('اسم مستخدم Oracle وكلمة المرور مطلوبان.');
  return oracledb.getConnection({ user: config.username, password: config.password, connectString: oracleConnectString(config) });
}

async function sqlServerPool(config) {
  let sql;
  try { sql = require('mssql'); } catch (_) { throw new Error('حزمة mssql غير مثبتة.'); }
  if (!config.host || !config.database || !config.username) throw new Error('خادم وقاعدة بيانات واسم مستخدم SQL Server مطلوبة.');
  return sql.connect({ server: config.host, port: config.port || 1433, database: config.database, user: config.username, password: config.password, options: { encrypt: config.encrypt, trustServerCertificate: config.trustServerCertificate }, pool: { max: 10, min: 0, idleTimeoutMillis: 30000 } });
}

function accessConnectionString(config) {
  if (!config.filePath) throw new Error('مسار ملف Access مطلوب.');
  const escaped = config.filePath.replace(/\\/g, '\\\\');
  return config.connectionString || `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${escaped};`;
}

async function accessConnection(config) {
  let odbc;
  try { odbc = require('odbc'); } catch (_) { throw new Error('حزمة odbc غير مثبتة.'); }
  try { return await odbc.connect(accessConnectionString(config)); }
  catch (error) { throw new Error(`تعذر فتح ملف Access أو تعريف ODBC: ${error.message}`); }
}

function statementsFromFile(filePath) {
  const source = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  const statements = []; let current = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*\/\s*$/.test(line)) { if (current.join('\n').trim()) statements.push(current.join('\n').trim()); current = []; continue; }
    current.push(line);
    if (/;\s*$/.test(line) && !/^\s*(BEGIN|DECLARE|IF|FOR|LOOP)\b/i.test(line)) { const statement = current.join('\n').trim().replace(/;\s*$/, ''); if (statement) statements.push(statement); current = []; }
  }
  if (current.join('\n').trim()) statements.push(current.join('\n').trim());
  return statements.filter(sql => !/^\s*(PROMPT|--)/i.test(sql));
}

const portableSchema = [
  `CREATE TABLE ONYX_SCHEMA_VERSION (VERSION_NO VARCHAR(20) NOT NULL, APPLIED_AT TIMESTAMP NOT NULL)`,
  `CREATE TABLE ONYX_COMPANY (COMPANY_ID INTEGER NOT NULL, COMPANY_CODE VARCHAR(30) NOT NULL, COMPANY_NAME VARCHAR(200) NOT NULL, ACTIVE_FLAG INTEGER NOT NULL DEFAULT 1, CONSTRAINT PK_ONYX_COMPANY PRIMARY KEY (COMPANY_ID))`,
  `CREATE TABLE ONYX_BRANCH (BRANCH_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, BRANCH_CODE VARCHAR(30) NOT NULL, BRANCH_NAME VARCHAR(200) NOT NULL, ACTIVE_FLAG INTEGER NOT NULL DEFAULT 1, CONSTRAINT PK_ONYX_BRANCH PRIMARY KEY (BRANCH_ID))`,
  `CREATE TABLE ONYX_FISCAL_YEAR (FISCAL_YEAR_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, YEAR_NO INTEGER NOT NULL, STATUS_CODE VARCHAR(20) NOT NULL, CONSTRAINT PK_ONYX_FY PRIMARY KEY (FISCAL_YEAR_ID))`,
  `CREATE TABLE ONYX_ACCOUNT (ACCOUNT_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, ACCOUNT_CODE VARCHAR(40) NOT NULL, ACCOUNT_NAME_AR VARCHAR(200) NOT NULL, ACCOUNT_TYPE VARCHAR(30) NOT NULL, PARENT_CODE VARCHAR(40), OPENING_BALANCE DECIMAL(19,4) NOT NULL DEFAULT 0, ACTIVE_FLAG INTEGER NOT NULL DEFAULT 1, CONSTRAINT PK_ONYX_ACCOUNT PRIMARY KEY (ACCOUNT_ID))`,
  `CREATE TABLE ONYX_CONTACT (CONTACT_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, CONTACT_TYPE VARCHAR(20) NOT NULL, CODE VARCHAR(40) NOT NULL, NAME_AR VARCHAR(200) NOT NULL, PHONE VARCHAR(50), EMAIL VARCHAR(200), ACTIVE_FLAG INTEGER NOT NULL DEFAULT 1, CONSTRAINT PK_ONYX_CONTACT PRIMARY KEY (CONTACT_ID))`,
  `CREATE TABLE ONYX_ITEM (ITEM_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, ITEM_CODE VARCHAR(40) NOT NULL, ITEM_NAME_AR VARCHAR(200) NOT NULL, UNIT_NAME VARCHAR(40), COST_PRICE DECIMAL(19,4) NOT NULL DEFAULT 0, SALE_PRICE DECIMAL(19,4) NOT NULL DEFAULT 0, QUANTITY DECIMAL(19,4) NOT NULL DEFAULT 0, REORDER_LEVEL DECIMAL(19,4) NOT NULL DEFAULT 0, ACTIVE_FLAG INTEGER NOT NULL DEFAULT 1, CONSTRAINT PK_ONYX_ITEM PRIMARY KEY (ITEM_ID))`,
  `CREATE TABLE ONYX_JOURNAL_ENTRY (ENTRY_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, BRANCH_ID INTEGER NOT NULL, FISCAL_YEAR_ID INTEGER NOT NULL, ENTRY_NO VARCHAR(40) NOT NULL, ENTRY_DATE TIMESTAMP NOT NULL, DESCRIPTION_AR VARCHAR(500), STATUS_CODE VARCHAR(20) NOT NULL, CONSTRAINT PK_ONYX_JE PRIMARY KEY (ENTRY_ID))`,
  `CREATE TABLE ONYX_JOURNAL_LINE (LINE_ID INTEGER NOT NULL, ENTRY_ID INTEGER NOT NULL, ACCOUNT_ID INTEGER NOT NULL, LINE_DESCRIPTION_AR VARCHAR(500), DEBIT DECIMAL(19,4) NOT NULL DEFAULT 0, CREDIT DECIMAL(19,4) NOT NULL DEFAULT 0, CONSTRAINT PK_ONYX_JL PRIMARY KEY (LINE_ID))`,
  `CREATE TABLE ONYX_INVOICE (INVOICE_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, BRANCH_ID INTEGER NOT NULL, INVOICE_TYPE VARCHAR(20) NOT NULL, INVOICE_NO VARCHAR(40) NOT NULL, CONTACT_ID INTEGER, SUBTOTAL DECIMAL(19,4) NOT NULL DEFAULT 0, TOTAL_AMOUNT DECIMAL(19,4) NOT NULL DEFAULT 0, STATUS_CODE VARCHAR(20) NOT NULL, CONSTRAINT PK_ONYX_INV PRIMARY KEY (INVOICE_ID))`,
  `CREATE TABLE ONYX_INVOICE_LINE (LINE_ID INTEGER NOT NULL, INVOICE_ID INTEGER NOT NULL, ITEM_ID INTEGER NOT NULL, QUANTITY DECIMAL(19,4) NOT NULL, UNIT_PRICE DECIMAL(19,4) NOT NULL, LINE_TOTAL DECIMAL(19,4) NOT NULL, CONSTRAINT PK_ONYX_IL PRIMARY KEY (LINE_ID))`,
  `CREATE TABLE ONYX_WAREHOUSE (WAREHOUSE_ID INTEGER NOT NULL, COMPANY_ID INTEGER NOT NULL, WAREHOUSE_CODE VARCHAR(40) NOT NULL, WAREHOUSE_NAME VARCHAR(200) NOT NULL, CONSTRAINT PK_ONYX_WH PRIMARY KEY (WAREHOUSE_ID))`,
  `CREATE TABLE ONYX_STOCK_MOVEMENT (MOVEMENT_ID INTEGER NOT NULL, ITEM_ID INTEGER NOT NULL, WAREHOUSE_ID INTEGER NOT NULL, MOVEMENT_TYPE VARCHAR(30) NOT NULL, QUANTITY DECIMAL(19,4) NOT NULL, MOVEMENT_DATE TIMESTAMP NOT NULL, SOURCE_NO VARCHAR(40), CONSTRAINT PK_ONYX_SM PRIMARY KEY (MOVEMENT_ID))`,
  `CREATE TABLE ONYX_AUDIT_LOG (AUDIT_ID INTEGER NOT NULL, USERNAME VARCHAR(100), ACTION_CODE VARCHAR(50) NOT NULL, ENTITY_NAME VARCHAR(100), ENTITY_ID VARCHAR(50), CREATED_AT TIMESTAMP NOT NULL, CONSTRAINT PK_ONYX_AUDIT PRIMARY KEY (AUDIT_ID))`
];

async function testConnection(input = {}) {
  const config = normalize(input);
  if (config.engine === 'oracle') {
    const connection = await oracleConnection(config);
    try { const result = await connection.execute(`select user as DB_USER, sys_context('USERENV','SERVICE_NAME') as SERVICE_NAME from dual`, {}, { outFormat: 4002 }); return { engine: 'oracle', connected: true, ...result.rows[0], schemaReady: false }; }
    finally { await connection.close(); }
  }
  if (config.engine === 'sqlserver') {
    const pool = await sqlServerPool(config);
    try { const result = await pool.request().query('SELECT SUSER_SNAME() AS DB_USER, DB_NAME() AS DB_NAME'); return { engine: 'sqlserver', connected: true, ...result.recordset[0], schemaReady: false }; }
    finally { await pool.close(); }
  }
  if (config.engine === 'access') {
    const connection = await accessConnection(config);
    try { const result = await connection.query('SELECT 1 AS CONNECTION_OK'); return { engine: 'access', connected: true, ...result[0], schemaReady: false }; }
    finally { await connection.close(); }
  }
  throw new Error(`محرك قاعدة البيانات غير مدعوم: ${config.engine}`);
}

async function initializeOracle(config) {
  const connection = await oracleConnection(config); const results = [];
  try { for (const migration of oracleMigrations) { let applied = 0; let skipped = 0; for (const sql of statementsFromFile(migration)) { try { await connection.execute(sql); applied += 1; } catch (error) { if ([955, 1430, 2261].includes(error.errorNum)) skipped += 1; else throw new Error(`${migration}: ${error.message}`); } } results.push({ migration, applied, skipped, status: 'completed' }); } await connection.commit(); return { engine: 'oracle', initialized: true, version: '010', migrations: results }; }
  catch (error) { try { await connection.rollback(); } catch (_) {} throw error; } finally { await connection.close(); }
}

async function initializePortable(config) {
  const statements = portableSchema;
  if (config.engine === 'sqlserver') {
    const pool = await sqlServerPool(config); const transaction = require('mssql').Transaction(pool); await transaction.begin(); const results = [];
    try { for (const sql of statements) { try { await transaction.request().query(sql); results.push({ status: 'created' }); } catch (error) { if (error.number === 2714) results.push({ status: 'exists' }); else throw error; } } await transaction.commit(); await pool.close(); return { engine: 'sqlserver', initialized: true, version: 'portable-001', tables: statements.length, results }; }
    catch (error) { try { await transaction.rollback(); } catch (_) {} await pool.close(); throw new Error(`SQL Server schema: ${error.message}`); }
  }
  const connection = await accessConnection(config); const results = [];
  try { for (const sql of statements) { try { await connection.query(sql); results.push({ status: 'created' }); } catch (error) { if (/already exists|exist/i.test(error.message)) results.push({ status: 'exists' }); else throw error; } } return { engine: 'access', initialized: true, version: 'portable-001', tables: statements.length, results }; }
  catch (error) { throw new Error(`Access schema: ${error.message}`); } finally { await connection.close(); }
}

async function initializeSchema(input = {}) { const config = normalize(input); if (config.engine === 'oracle') return initializeOracle(config); if (config.engine === 'sqlserver' || config.engine === 'access') return initializePortable(config); throw new Error(`محرك قاعدة البيانات غير مدعوم: ${config.engine}`); }

module.exports = { testConnection, initializeSchema };
