const fs = require('fs');
const path = require('path');

const migrations = [
  'oracle/001_security_and_fiscal_schema.sql',
  'oracle/migrations/004_core_accounting_schema.sql',
  'oracle/migrations/005_operations_schema.sql',
  'oracle/migrations/006_security_roles_permissions.sql'
];

function normalize(config = {}) {
  return {
    engine: String(config.engine || 'oracle').toLowerCase(),
    host: String(config.host || '127.0.0.1'),
    port: Number(config.port || 1521),
    service: String(config.service || config.database || 'XEPDB1'),
    database: String(config.database || config.service || ''),
    username: String(config.username || ''),
    password: String(config.password || ''),
    filePath: String(config.filePath || '')
  };
}

function oracleConnectString(config) {
  return config.connectString || `${config.host}:${config.port}/${config.service}`;
}

async function oracleConnection(config) {
  let oracledb;
  try { oracledb = require('oracledb'); } catch (_) { throw new Error('موصل Oracle غير مثبت. نفّذ npm install ثم أعد تشغيل التطبيق.'); }
  if (!config.username || !config.password) throw new Error('اسم مستخدم Oracle وكلمة المرور مطلوبان.');
  return oracledb.getConnection({ user: config.username, password: config.password, connectString: oracleConnectString(config) });
}

function statementsFromFile(filePath) {
  const source = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  const statements = [];
  let current = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*\/\s*$/.test(line)) {
      if (current.join('\n').trim()) statements.push(current.join('\n').trim());
      current = [];
      continue;
    }
    current.push(line);
    if (/;\s*$/.test(line) && !/^\s*(BEGIN|DECLARE|IF|FOR|LOOP)\b/i.test(line)) {
      const statement = current.join('\n').trim().replace(/;\s*$/, '');
      if (statement) statements.push(statement);
      current = [];
    }
  }
  if (current.join('\n').trim()) statements.push(current.join('\n').trim());
  return statements.filter(sql => !/^\s*(PROMPT|--)/i.test(sql));
}

async function testConnection(input = {}) {
  const config = normalize(input);
  if (config.engine === 'oracle') {
    const connection = await oracleConnection(config);
    try {
      const result = await connection.execute(`select user as DB_USER, sys_context('USERENV','SERVICE_NAME') as SERVICE_NAME from dual`, {}, { outFormat: 4002 });
      return { engine: 'oracle', connected: true, ...result.rows[0], schemaReady: false };
    } finally { await connection.close(); }
  }
  if (config.engine === 'sqlserver') {
    try { require.resolve('mssql'); } catch (_) { throw new Error('موصل SQL Server غير مثبت. نفّذ npm install mssql ثم أعد تشغيل التطبيق.'); }
    throw new Error('موصل SQL Server موجود، ويحتاج طبقة SQL Server Adapter قبل تنفيذ الاستعلامات المحاسبية.');
  }
  if (config.engine === 'access') {
    try { require.resolve('odbc'); } catch (_) { throw new Error('موصل Access/ODBC غير مثبت. نفّذ npm install odbc وثبّت تعريف Access ODBC على Windows.'); }
    throw new Error('موصل Access موجود، ويحتاج تعريف Microsoft Access ODBC على الجهاز.');
  }
  throw new Error(`محرك قاعدة البيانات غير مدعوم: ${config.engine}`);
}

async function initializeSchema(input = {}) {
  const config = normalize(input);
  if (config.engine !== 'oracle') throw new Error('تهيئة المخطط الفعلية متاحة حاليًا لـ Oracle؛ موصلا SQL Server وAccess يحتاجان حزم التشغيل وتعريفات النظام.');
  const connection = await oracleConnection(config);
  const results = [];
  try {
    for (const migration of migrations) {
      const statements = statementsFromFile(migration);
      let applied = 0; let skipped = 0;
      for (const sql of statements) {
        try { await connection.execute(sql); applied += 1; }
        catch (error) {
          if (error.errorNum === 955 || error.errorNum === 1430 || error.errorNum === 2261) skipped += 1;
          else throw new Error(`${migration}: ${error.message}`);
        }
      }
      results.push({ migration, applied, skipped, status: 'completed' });
    }
    await connection.commit();
    return { engine: 'oracle', initialized: true, version: '006', migrations: results };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally { await connection.close(); }
}

module.exports = { testConnection, initializeSchema };
