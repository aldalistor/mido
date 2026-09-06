const oracledb = require('oracledb');

let pool;

function config() {
  return {
    user: process.env.ONYX_DB_USER || 'ONYX_APP',
    password: process.env.ONYX_DB_PASSWORD,
    connectString: process.env.ONYX_DB_CONNECT_STRING || '127.0.0.1:1521/XEPDB1',
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1,
    stmtCacheSize: 30,
  };
}

function ensurePassword() {
  if (!config().password) throw new Error('لم يتم ضبط ONYX_DB_PASSWORD في بيئة التشغيل.');
}

async function getPool() {
  ensurePassword();
  if (!pool) pool = await oracledb.createPool(config());
  return pool;
}

async function query(sql, binds = {}, options = {}) {
  const connection = await (await getPool()).getConnection();
  try {
    return await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, ...options });
  } finally {
    await connection.close();
  }
}

async function test() {
  const result = await query(`select user as DB_USER, sys_context('USERENV','SERVICE_NAME') as SERVICE_NAME, sys_context('USERENV','DB_NAME') as DB_NAME from dual`);
  return result.rows[0];
}

async function dashboard() {
  const [accounts, customers, journals] = await Promise.all([
    query(`select count(*) as COUNT from ACCOUNT`),
    query(`select count(*) as COUNT from CUSTOMER`),
    query(`select count(*) as COUNT from MASTER_JOURNAL_V`),
  ]);
  return { accounts: accounts.rows[0].COUNT, customers: customers.rows[0].COUNT, journals: journals.rows[0].COUNT };
}

async function accounts(search = '') {
  return (await query(`select A_CODE, A_NAME, A_NAME_ENG, A_LEVEL, A_PARENT, DR, INACTIVE_RES from ACCOUNT where (:search is null or upper(A_CODE) like upper(:likeSearch) or upper(A_NAME) like upper(:likeSearch)) order by A_CODE fetch first 250 rows only`, { search: search || null, likeSearch: `%${search}%` })).rows;
}

async function customers(search = '') {
  return (await query(`select C_CODE, C_A_NAME, C_E_NAME, C_PHONE, C_MOBILE, C_E_MAIL, INACTIVE from CUSTOMER where (:search is null or upper(C_CODE) like upper(:likeSearch) or upper(C_A_NAME) like upper(:likeSearch)) order by C_CODE fetch first 250 rows only`, { search: search || null, likeSearch: `%${search}%` })).rows;
}

async function journal(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 250);
  return (await query(`select * from (select * from MASTER_JOURNAL_V order by AD_DATE desc nulls last) where rownum <= :limit`, { limit: safeLimit })).rows;
}

async function close() {
  if (pool) { await pool.close(10); pool = undefined; }
}

module.exports = { test, dashboard, accounts, customers, journal, close };
