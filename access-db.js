'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const odbc = require('odbc');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.resolve(process.env.ONYX_DB_PATH || path.join(appData, 'Onyx Accounting', 'onyx-local.mdb'));
const connectionString = () => `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${dbPath};`;
let initialized = false;
let initializationOptions = {};
const schema = [
  `CREATE TABLE ONYX_COMPANY (COMPANY_ID COUNTER PRIMARY KEY, COMPANY_CODE TEXT(30) NOT NULL, COMPANY_NAME_AR TEXT(200) NOT NULL, BASE_CURRENCY TEXT(3), ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_BRANCH (BRANCH_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, BRANCH_CODE TEXT(30) NOT NULL, BRANCH_NAME_AR TEXT(200) NOT NULL, ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_FISCAL_YEAR (FISCAL_YEAR_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, FISCAL_YEAR LONG NOT NULL, START_DATE DATETIME NOT NULL, END_DATE DATETIME NOT NULL, STATUS_CODE TEXT(20) NOT NULL)`,
  `CREATE TABLE ONYX_USER (USER_ID COUNTER PRIMARY KEY, USERNAME TEXT(80) NOT NULL, DISPLAY_NAME_AR TEXT(200) NOT NULL, PASSWORD_HASH TEXT(255) NOT NULL, LANGUAGE_CODE TEXT(10), ACTIVE_FLAG BIT, FAILED_ATTEMPTS LONG, LOCKED_UNTIL DATETIME, LAST_LOGIN_AT DATETIME)`,
  `CREATE TABLE ONYX_ROLE (ROLE_ID COUNTER PRIMARY KEY, ROLE_CODE TEXT(50) NOT NULL, ROLE_NAME_AR TEXT(150) NOT NULL, ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_USER_ROLE (USER_ID LONG NOT NULL, ROLE_ID LONG NOT NULL)`,
  `CREATE TABLE ONYX_ACCOUNT (ACCOUNT_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, ACCOUNT_CODE TEXT(40) NOT NULL, ACCOUNT_NAME_AR TEXT(200) NOT NULL, ACCOUNT_TYPE TEXT(30) NOT NULL, PARENT_CODE TEXT(40), OPENING_BALANCE DOUBLE, ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_CONTACT (CONTACT_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, CONTACT_TYPE TEXT(20) NOT NULL, CODE TEXT(40) NOT NULL, NAME_AR TEXT(200) NOT NULL, PHONE TEXT(50), EMAIL TEXT(200), ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_ITEM (ITEM_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, ITEM_CODE TEXT(40) NOT NULL, ITEM_NAME_AR TEXT(200) NOT NULL, UNIT_NAME TEXT(40), COST_PRICE DOUBLE, SALE_PRICE DOUBLE, QUANTITY DOUBLE, REORDER_LEVEL DOUBLE, ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_WAREHOUSE (WAREHOUSE_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, BRANCH_ID LONG NOT NULL, WAREHOUSE_CODE TEXT(40) NOT NULL, WAREHOUSE_NAME_AR TEXT(200) NOT NULL, ACTIVE_FLAG BIT)`,
  `CREATE TABLE ONYX_JOURNAL_ENTRY (ENTRY_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, BRANCH_ID LONG NOT NULL, FISCAL_YEAR_ID LONG NOT NULL, ENTRY_NO TEXT(40) NOT NULL, ENTRY_DATE DATETIME NOT NULL, DESCRIPTION_AR TEXT(500), STATUS_CODE TEXT(20) NOT NULL, SOURCE_CODE TEXT(30))`,
  `CREATE TABLE ONYX_JOURNAL_LINE (LINE_ID COUNTER PRIMARY KEY, ENTRY_ID LONG NOT NULL, ACCOUNT_ID LONG NOT NULL, LINE_DESCRIPTION_AR TEXT(500), DEBIT DOUBLE, CREDIT DOUBLE)`,
  `CREATE TABLE ONYX_INVOICE (INVOICE_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, BRANCH_ID LONG NOT NULL, FISCAL_YEAR_ID LONG NOT NULL, INVOICE_TYPE TEXT(20) NOT NULL, INVOICE_NO TEXT(40) NOT NULL, CONTACT_ID LONG, INVOICE_DATE DATETIME NOT NULL, SUBTOTAL DOUBLE, DISCOUNT_AMOUNT DOUBLE, TAX_AMOUNT DOUBLE, TOTAL_AMOUNT DOUBLE, PAYMENT_METHOD TEXT(20), PAID_AMOUNT DOUBLE, OUTSTANDING_AMOUNT DOUBLE, DUE_DATE DATETIME, STATUS_CODE TEXT(20) NOT NULL, CURRENCY_CODE TEXT(3), EXCHANGE_RATE DOUBLE)`,
  `CREATE TABLE ONYX_INVOICE_LINE (LINE_ID COUNTER PRIMARY KEY, INVOICE_ID LONG NOT NULL, ITEM_ID LONG NOT NULL, QUANTITY DOUBLE, UNIT_PRICE DOUBLE, UNIT_COST DOUBLE, DISCOUNT_AMOUNT DOUBLE, LINE_TOTAL DOUBLE)`,
  `CREATE TABLE ONYX_STOCK_MOVEMENT (MOVEMENT_ID COUNTER PRIMARY KEY, COMPANY_ID LONG NOT NULL, BRANCH_ID LONG NOT NULL, WAREHOUSE_ID LONG NOT NULL, ITEM_ID LONG NOT NULL, INVOICE_ID LONG, MOVEMENT_TYPE TEXT(30) NOT NULL, QUANTITY DOUBLE, UNIT_COST DOUBLE, MOVEMENT_DATE DATETIME NOT NULL)`,
  `CREATE TABLE ONYX_AUDIT_LOG (AUDIT_ID COUNTER PRIMARY KEY, USER_ID LONG, COMPANY_ID LONG, BRANCH_ID LONG, FISCAL_YEAR_ID LONG, ACTION_CODE TEXT(80), ENTITY_TYPE TEXT(80), ENTITY_ID TEXT(80), AFTER_VALUE MEMO, CREATED_AT DATETIME)`,
  `CREATE TABLE ONYX_CASH_VOUCHER (VOUCHER_ID COUNTER PRIMARY KEY, COMPANY_ID LONG, BRANCH_ID LONG, FISCAL_YEAR_ID LONG, VOUCHER_TYPE TEXT(20), VOUCHER_NO TEXT(40), VOUCHER_DATE DATETIME, CASH_ACCOUNT_CODE TEXT(40), TOTAL_AMOUNT DOUBLE, STATUS_CODE TEXT(20), DESCRIPTION_AR TEXT(500))`,
  `CREATE TABLE ONYX_EXPENSE_INCOME (OPERATION_ID COUNTER PRIMARY KEY, COMPANY_ID LONG, BRANCH_ID LONG, FISCAL_YEAR_ID LONG, OPERATION_TYPE TEXT(20), OPERATION_NO TEXT(40), OPERATION_DATE DATETIME, DESCRIPTION_AR TEXT(500), AMOUNT DOUBLE, CASH_ACCOUNT_CODE TEXT(40), CATEGORY_ACCOUNT_CODE TEXT(40), STATUS_CODE TEXT(20))`,
  `CREATE TABLE ONYX_AR_PAYMENT (PAYMENT_ID COUNTER PRIMARY KEY, COMPANY_ID LONG, BRANCH_ID LONG, FISCAL_YEAR_ID LONG, CONTACT_CODE TEXT(40), PAYMENT_TYPE TEXT(20), PAYMENT_NO TEXT(40), PAYMENT_DATE DATETIME, CASH_ACCOUNT_CODE TEXT(40), AMOUNT DOUBLE, ALLOCATED_AMOUNT DOUBLE, UNAPPLIED_AMOUNT DOUBLE, DESCRIPTION_AR TEXT(500), STATUS_CODE TEXT(20))`,
  `CREATE TABLE ONYX_SEED_INFO (SEED_CODE TEXT(50) PRIMARY KEY, APPLIED_AT DATETIME)`
];

const chartOfAccounts = [
  ['1000', 'الأصول', 'ASSET'], ['1100', 'الأصول المتداولة', 'ASSET'],
  ['1101', 'الصندوق الرئيسي', 'ASSET'], ['1102', 'البنك الرئيسي', 'ASSET'],
  ['1200', 'الذمم المدينة', 'ASSET'], ['1201', 'العملاء', 'ASSET'],
  ['1300', 'المخزون', 'ASSET'], ['1301', 'مخزون البضائع', 'ASSET'],
  ['1400', 'الأصول الثابتة', 'ASSET'], ['1401', 'الأثاث والتجهيزات', 'ASSET'],
  ['1402', 'أجهزة الحاسب والمعدات', 'ASSET'], ['1490', 'مجمع الإهلاك', 'ASSET'],
  ['2000', 'الخصوم', 'LIABILITY'], ['2100', 'الخصوم المتداولة', 'LIABILITY'],
  ['2101', 'الموردون', 'LIABILITY'], ['2102', 'مصروفات مستحقة', 'LIABILITY'],
  ['2200', 'الضرائب المستحقة', 'LIABILITY'], ['2201', 'ضريبة القيمة المضافة', 'LIABILITY'],
  ['3000', 'حقوق الملكية', 'EQUITY'], ['3101', 'رأس المال', 'EQUITY'],
  ['3201', 'الأرباح المحتجزة', 'EQUITY'], ['3301', 'صافي ربح السنة', 'EQUITY'],
  ['4000', 'الإيرادات', 'REVENUE'], ['4101', 'إيرادات المبيعات', 'REVENUE'],
  ['4102', 'إيرادات الخدمات', 'REVENUE'], ['4201', 'إيرادات أخرى', 'REVENUE'],
  ['5000', 'تكلفة المبيعات والمصروفات', 'EXPENSE'], ['5101', 'تكلفة المبيعات', 'COGS'],
  ['5102', 'تكلفة المشتريات', 'COGS'], ['5201', 'مصروف الرواتب والأجور', 'EXPENSE'],
  ['5202', 'مصروف الإيجار', 'EXPENSE'], ['5203', 'مصروف الكهرباء والمياه', 'EXPENSE'],
  ['5204', 'مصروف الاتصالات والإنترنت', 'EXPENSE'], ['5205', 'مصروف النقل والشحن', 'EXPENSE'],
  ['5206', 'مصروف التسويق والإعلان', 'EXPENSE'], ['5207', 'مصروف الصيانة', 'EXPENSE'],
  ['5208', 'مصروف الإهلاك', 'EXPENSE'], ['5299', 'مصروفات إدارية متنوعة', 'EXPENSE']
];

async function seedDemoData(connection) {
  const marker = rows(await connection.query('SELECT SEED_CODE FROM ONYX_SEED_INFO WHERE SEED_CODE=?', ['DEMO-2026-001']));
  if (marker.length) return { inserted: false, seedCode: 'DEMO-2026-001' };
  const contactData = [
    ['CUST-001', 'عميل تجريبي - مؤسسة النور', 'CUSTOMER', '0500000001'],
    ['CUST-002', 'عميل تجريبي - شركة الريادة', 'CUSTOMER', '0500000002'],
    ['VEND-001', 'مورد تجريبي - مؤسسة الإمداد', 'VENDOR', '0500000010']
  ];
  const contacts = {};
  for (const [code, name, type, phone] of contactData) {
    let found = rows(await connection.query('SELECT CONTACT_ID FROM ONYX_CONTACT WHERE COMPANY_ID=1 AND CODE=?', [code]));
    if (!found.length) {
      const id = await nextId(connection, 'ONYX_CONTACT', 'CONTACT_ID');
      await connection.query('INSERT INTO ONYX_CONTACT (CONTACT_ID,COMPANY_ID,CONTACT_TYPE,CODE,NAME_AR,PHONE,ACTIVE_FLAG) VALUES (?,1,?,?,?,?,1)', [id, type, code, name, phone]);
      found = [{ CONTACT_ID: id }];
    }
    contacts[code] = Number(val(found[0], 'CONTACT_ID'));
  }
  const itemData = [
    ['ITEM-001', 'حاسب محمول تجريبي', 'قطعة', 1800, 2500, 25, 5],
    ['ITEM-002', 'طابعة مكتبية تجريبية', 'قطعة', 650, 950, 15, 3],
    ['ITEM-003', 'ورق طباعة A4 تجريبي', 'كرتون', 80, 120, 40, 10],
    ['ITEM-004', 'حبر طابعة أسود تجريبي', 'عبوة', 90, 150, 30, 5]
  ];
  const items = {};
  for (const [code, name, unit, cost, sale, quantity, reorder] of itemData) {
    let found = rows(await connection.query('SELECT ITEM_ID FROM ONYX_ITEM WHERE COMPANY_ID=1 AND ITEM_CODE=?', [code]));
    if (!found.length) {
      const id = await nextId(connection, 'ONYX_ITEM', 'ITEM_ID');
      await connection.query('INSERT INTO ONYX_ITEM (ITEM_ID,COMPANY_ID,ITEM_CODE,ITEM_NAME_AR,UNIT_NAME,COST_PRICE,SALE_PRICE,QUANTITY,REORDER_LEVEL,ACTIVE_FLAG) VALUES (?,1,?,?,?,?,?,?,?,1)', [id, code, name, unit, cost, sale, quantity, reorder]);
      found = [{ ITEM_ID: id }];
    }
    items[code] = Number(val(found[0], 'ITEM_ID'));
  }
  const addInvoice = async ({ type, no, contactCode, date, lines, paymentMethod, paid }) => {
    let existing = rows(await connection.query('SELECT INVOICE_ID FROM ONYX_INVOICE WHERE COMPANY_ID=1 AND INVOICE_NO=?', [no]));
    if (existing.length) return Number(val(existing[0], 'INVOICE_ID'));
    const invoiceId = await nextId(connection, 'ONYX_INVOICE', 'INVOICE_ID');
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const tax = Math.round(subtotal * 0.15 * 100) / 100;
    const total = subtotal + tax;
    const outstanding = Math.max(0, total - paid);
    await connection.query('INSERT INTO ONYX_INVOICE (INVOICE_ID,COMPANY_ID,BRANCH_ID,FISCAL_YEAR_ID,INVOICE_TYPE,INVOICE_NO,CONTACT_ID,INVOICE_DATE,SUBTOTAL,DISCOUNT_AMOUNT,TAX_AMOUNT,TOTAL_AMOUNT,PAYMENT_METHOD,PAID_AMOUNT,OUTSTANDING_AMOUNT,STATUS_CODE,CURRENCY_CODE,EXCHANGE_RATE) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [invoiceId, 1, 1, 1, type, no, contacts[contactCode], dateValue(date), subtotal, 0, tax, total, paymentMethod, paid, outstanding, 'POSTED', 'SAR', 1]);
    for (const line of lines) {
      const lineId = await nextId(connection, 'ONYX_INVOICE_LINE', 'LINE_ID');
      const item = rows(await connection.query('SELECT COST_PRICE FROM ONYX_ITEM WHERE ITEM_ID=?', [items[line.itemCode]]));
      await connection.query('INSERT INTO ONYX_INVOICE_LINE (LINE_ID,INVOICE_ID,ITEM_ID,QUANTITY,UNIT_PRICE,UNIT_COST,DISCOUNT_AMOUNT,LINE_TOTAL) VALUES (?,?,?,?,?,?,?,?)', [lineId, invoiceId, items[line.itemCode], line.quantity, line.unitPrice, Number(val(item[0], 'COST_PRICE', 0)), 0, line.quantity * line.unitPrice]);
      const movementId = await nextId(connection, 'ONYX_STOCK_MOVEMENT', 'MOVEMENT_ID');
      const movementQuantity = type === 'SALE' ? -line.quantity : line.quantity;
      await connection.query('INSERT INTO ONYX_STOCK_MOVEMENT (MOVEMENT_ID,COMPANY_ID,BRANCH_ID,WAREHOUSE_ID,ITEM_ID,INVOICE_ID,MOVEMENT_TYPE,QUANTITY,UNIT_COST,MOVEMENT_DATE) VALUES (?,1,1,1,?,?,?,?,?,?,?)', [movementId, items[line.itemCode], invoiceId, type, movementQuantity, Number(val(item[0], 'COST_PRICE', 0)), dateValue(date)]);
      await connection.query('UPDATE ONYX_ITEM SET QUANTITY=QUANTITY+? WHERE ITEM_ID=?', [movementQuantity, items[line.itemCode]]);
    }
    return invoiceId;
  };
  await addInvoice({ type: 'SALE', no: 'DEMO-S-0001', contactCode: 'CUST-001', date: '2026-01-15', paymentMethod: 'CASH', paid: 1828.5, lines: [{ itemCode: 'ITEM-001', quantity: 3, unitPrice: 2500 }, { itemCode: 'ITEM-002', quantity: 2, unitPrice: 950 }] });
  await addInvoice({ type: 'SALE', no: 'DEMO-S-0002', contactCode: 'CUST-002', date: '2026-02-10', paymentMethod: 'CREDIT', paid: 0, lines: [{ itemCode: 'ITEM-003', quantity: 5, unitPrice: 120 }, { itemCode: 'ITEM-004', quantity: 4, unitPrice: 150 }] });
  await addInvoice({ type: 'PURCHASE', no: 'DEMO-P-0001', contactCode: 'VEND-001', date: '2026-01-05', paymentMethod: 'TRANSFER', paid: 5290, lines: [{ itemCode: 'ITEM-001', quantity: 10, unitPrice: 1800 }, { itemCode: 'ITEM-003', quantity: 20, unitPrice: 80 }] });
  const journalId = await nextId(connection, 'ONYX_JOURNAL_ENTRY', 'ENTRY_ID');
  await connection.query('INSERT INTO ONYX_JOURNAL_ENTRY (ENTRY_ID,COMPANY_ID,BRANCH_ID,FISCAL_YEAR_ID,ENTRY_NO,ENTRY_DATE,DESCRIPTION_AR,STATUS_CODE,SOURCE_CODE) VALUES (?,1,1,1,?, ?, ?,\'POSTED\',\'DEMO\')', [journalId, 'DEMO-JV-0001', dateValue('2026-01-01'), 'قيد افتتاحي تجريبي']);
  const openingLines = [['1101', 50000, 0], ['1102', 25000, 0], ['3101', 0, 75000]];
  for (const [accountCode, debit, credit] of openingLines) {
    const account = rows(await connection.query('SELECT ACCOUNT_ID FROM ONYX_ACCOUNT WHERE ACCOUNT_CODE=?', [accountCode]));
    const lineId = await nextId(connection, 'ONYX_JOURNAL_LINE', 'LINE_ID');
    await connection.query('INSERT INTO ONYX_JOURNAL_LINE (LINE_ID,ENTRY_ID,ACCOUNT_ID,LINE_DESCRIPTION_AR,DEBIT,CREDIT) VALUES (?,?,?,?,?,?)', [lineId, journalId, Number(val(account[0], 'ACCOUNT_ID')), 'رصيد افتتاحي تجريبي', debit, credit]);
  }
  await connection.query('INSERT INTO ONYX_SEED_INFO (SEED_CODE,APPLIED_AT) VALUES (?,?)', ['DEMO-2026-001', new Date()]);
  return { inserted: true, seedCode: 'DEMO-2026-001', contacts: 3, items: 4, invoices: 3, journalEntries: 1 };
}

function dateValue(value) { return value ? new Date(String(value).slice(0, 10) + 'T12:00:00') : new Date(); }
function today() { return new Date().toISOString().slice(0, 10); }
function rows(result) { return Array.isArray(result) ? result : []; }
function val(row, name, fallback = null) { if (!row) return fallback; const key = Object.keys(row).find(k => k.toUpperCase() === name.toUpperCase()); return key ? row[key] : fallback; }
function currentContext() { return { companyId: 1, branchId: 1, fiscalYearId: 1 }; }
function hashPassword(password) { const salt = crypto.randomBytes(16).toString('base64url'); const iterations = 210000; const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, 'sha256').toString('base64url'); return `pbkdf2$${iterations}$${salt}$${hash}`; }
function verifyPassword(password, stored) { const [algorithm, iterations, salt, expected] = String(stored || '').split('$'); if (algorithm !== 'pbkdf2') return false; const actual = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 32, 'sha256').toString('base64url'); return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }

async function createMdbIfNeeded() {
  if (fs.existsSync(dbPath)) return;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (process.platform !== 'win32') throw new Error(`ملف MDB غير موجود. سيُنشأ تلقائيًا على Windows، والمسار المتوقع: ${dbPath}`);
  const packagedScript = process.resourcesPath ? path.join(process.resourcesPath, 'create-mdb.ps1') : '';
  const script = packagedScript && fs.existsSync(packagedScript) ? packagedScript : path.join(__dirname, 'create-mdb.ps1');
  const { execFileSync } = require('child_process');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Path', dbPath], { stdio: 'pipe' });
}

async function connect() { await createMdbIfNeeded(); return odbc.connect(connectionString()); }
async function query(sql, params = []) { const connection = await connect(); try { return await connection.query(sql, params); } finally { await connection.close(); } }
async function setup() {
  if (initialized) return;
  const connection = await connect();
  try {
    for (const statement of schema) { try { await connection.query(statement); } catch (error) { if (!/already exists|exists|duplicate/i.test(error.message)) throw error; } }
    const company = rows(await connection.query('SELECT COMPANY_ID FROM ONYX_COMPANY WHERE COMPANY_ID=1'));
    if (!company.length) {
      const options = initializationOptions;
      const companyCode = options.companyCode || 'LOCAL';
      const companyName = options.companyName || 'الشركة الرئيسية';
      const branchCode = options.branchCode || 'MAIN';
      const branchName = options.branchName || 'الفرع الرئيسي';
      const fiscalYear = Number(options.fiscalYear) || new Date().getFullYear();
      const adminUsername = String(options.adminUsername || 'ADMIN').trim().toUpperCase();
      const adminName = options.adminName || 'مدير النظام';
      await connection.query(`INSERT INTO ONYX_COMPANY (COMPANY_ID,COMPANY_CODE,COMPANY_NAME_AR,BASE_CURRENCY,ACTIVE_FLAG) VALUES (1,?,?,?,1)`, [companyCode, companyName, options.currency || 'SAR']);
      await connection.query(`INSERT INTO ONYX_BRANCH (BRANCH_ID,COMPANY_ID,BRANCH_CODE,BRANCH_NAME_AR,ACTIVE_FLAG) VALUES (1,1,?,?,1)`, [branchCode, branchName]);
      await connection.query(`INSERT INTO ONYX_FISCAL_YEAR (FISCAL_YEAR_ID,COMPANY_ID,FISCAL_YEAR,START_DATE,END_DATE,STATUS_CODE) VALUES (1,1,?, ?, ?, 'OPEN')`, [fiscalYear, dateValue(`${fiscalYear}-01-01`), dateValue(`${fiscalYear}-12-31`)]);
      await connection.query(`INSERT INTO ONYX_WAREHOUSE (WAREHOUSE_ID,COMPANY_ID,BRANCH_ID,WAREHOUSE_CODE,WAREHOUSE_NAME_AR,ACTIVE_FLAG) VALUES (1,1,1,?,?,1)`, ['MAIN', branchName]);
      await connection.query(`INSERT INTO ONYX_ROLE (ROLE_ID,ROLE_CODE,ROLE_NAME_AR,ACTIVE_FLAG) VALUES (1,'ADMIN','مدير النظام',1)`);
      await connection.query(`INSERT INTO ONYX_USER (USER_ID,USERNAME,DISPLAY_NAME_AR,PASSWORD_HASH,LANGUAGE_CODE,ACTIVE_FLAG,FAILED_ATTEMPTS) VALUES (1,?,?,?,'ar',1,0)`, [adminUsername, adminName, hashPassword(String(options.adminPassword || 'ChangeMe123!'))]);
      await connection.query(`INSERT INTO ONYX_USER_ROLE (USER_ID,ROLE_ID) VALUES (1,1)`);
    }
    for (const account of chartOfAccounts) {
      const existing = rows(await connection.query('SELECT ACCOUNT_ID FROM ONYX_ACCOUNT WHERE COMPANY_ID=1 AND ACCOUNT_CODE=?', [account[0]]));
      if (!existing.length) await connection.query('INSERT INTO ONYX_ACCOUNT (COMPANY_ID,ACCOUNT_CODE,ACCOUNT_NAME_AR,ACCOUNT_TYPE,OPENING_BALANCE,ACTIVE_FLAG) VALUES (1,?,?,?,?,1)', account);
    }
    if (initializationOptions.includeDemoData) await seedDemoData(connection);
    initialized = true;
  } finally { await connection.close(); }
}
async function withTransaction(work) { await setup(); const connection = await connect(); try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; } catch (error) { try { await connection.rollback(); } catch (_) {} throw error; } finally { await connection.close(); } }
async function nextId(connection, table, field) { const result = rows(await connection.query(`SELECT MAX(${field}) AS LAST_ID FROM ${table}`)); return Number(val(result[0], 'LAST_ID', 0) || 0) + 1; }

async function initialize(options = {}) { initializationOptions = { ...options }; await setup(); initializationOptions = {}; return { engine: 'access', initialized: true, version: 'mdb-003-production-bootstrap', path: dbPath, tables: schema.length, demoData: options.includeDemoData ? { seedCode: 'DEMO-2026-001', contacts: 3, items: 4, invoices: 3, journalEntries: 1 } : null }; }
async function test() { await setup(); return { DB_USER: 'LOCAL', SERVICE_NAME: path.basename(dbPath), ENGINE: 'ACCESS_MDB', DB_PATH: dbPath, engine: 'access' }; }
async function bootstrapStatus() { return { initialized: fs.existsSync(dbPath), path: dbPath, platform: process.platform }; }
async function dashboard() { await setup(); const [a,c,j] = await Promise.all([query('SELECT COUNT(*) AS N FROM ONYX_ACCOUNT'), query('SELECT COUNT(*) AS N FROM ONYX_CONTACT'), query("SELECT COUNT(*) AS N FROM ONYX_JOURNAL_ENTRY WHERE STATUS_CODE='POSTED'")]); return { mode: 'access', accounts: Number(val(a[0],'N',0)), customers: Number(val(c[0],'N',0)), journals: Number(val(j[0],'N',0)) }; }
async function modernAccounts(search = '') { await setup(); const q = `%${String(search).toUpperCase()}%`; const result = await query('SELECT ACCOUNT_ID,ACCOUNT_CODE,ACCOUNT_NAME_AR,ACCOUNT_TYPE,OPENING_BALANCE,ACTIVE_FLAG FROM ONYX_ACCOUNT WHERE COMPANY_ID=1 AND (UCASE(ACCOUNT_CODE) LIKE ? OR UCASE(ACCOUNT_NAME_AR) LIKE ?) ORDER BY ACCOUNT_CODE', [q,q]); return rows(result); }
async function accounts(search='') { return modernAccounts(search); }
async function createModernAccount(p={}) { return withTransaction(async c => { const id=await nextId(c,'ONYX_ACCOUNT','ACCOUNT_ID'); await c.query('INSERT INTO ONYX_ACCOUNT (ACCOUNT_ID,COMPANY_ID,ACCOUNT_CODE,ACCOUNT_NAME_AR,ACCOUNT_TYPE,OPENING_BALANCE,ACTIVE_FLAG) VALUES (?,1,?,?,?,?,1)',[id,p.code,p.name,p.type||'GENERAL',Number(p.openingBalance||0)]); return {accountId:id,code:p.code,name:p.name}; }); }
async function modernContacts(search='') { await setup(); const q=`%${String(search).toUpperCase()}%`; return rows(await query('SELECT CONTACT_ID,CODE,NAME_AR,CONTACT_TYPE,PHONE,EMAIL,ACTIVE_FLAG FROM ONYX_CONTACT WHERE COMPANY_ID=1 AND (UCASE(CODE) LIKE ? OR UCASE(NAME_AR) LIKE ?) ORDER BY CODE',[q,q])); }
async function customers(search='') { return modernContacts(search); }
async function createModernContact(p={}) { return withTransaction(async c=>{const id=await nextId(c,'ONYX_CONTACT','CONTACT_ID'); await c.query('INSERT INTO ONYX_CONTACT (CONTACT_ID,COMPANY_ID,CONTACT_TYPE,CODE,NAME_AR,PHONE,EMAIL,ACTIVE_FLAG) VALUES (?,1,?,?,?,?,?,1)',[id,p.type==='VENDOR'?'VENDOR':'CUSTOMER',p.code,p.name,p.phone||null,p.email||null]); return {contactId:id,code:p.code,name:p.name};}); }
async function modernItems(search='') { await setup(); const q=`%${String(search).toUpperCase()}%`; return rows(await query('SELECT ITEM_ID,ITEM_CODE,ITEM_NAME_AR,UNIT_NAME,COST_PRICE,SALE_PRICE,QUANTITY,REORDER_LEVEL,ACTIVE_FLAG FROM ONYX_ITEM WHERE COMPANY_ID=1 AND (UCASE(ITEM_CODE) LIKE ? OR UCASE(ITEM_NAME_AR) LIKE ?) ORDER BY ITEM_CODE',[q,q])); }
async function createModernItem(p={}) { return withTransaction(async c=>{const id=await nextId(c,'ONYX_ITEM','ITEM_ID'); await c.query('INSERT INTO ONYX_ITEM (ITEM_ID,COMPANY_ID,ITEM_CODE,ITEM_NAME_AR,UNIT_NAME,COST_PRICE,SALE_PRICE,QUANTITY,REORDER_LEVEL,ACTIVE_FLAG) VALUES (?,1,?,?,?,?,?,?,?,1)',[id,p.code,p.name,p.unit||'قطعة',Number(p.cost||0),Number(p.sale||0),Number(p.quantity||0),Number(p.reorder||0)]); return {itemId:id,code:p.code,name:p.name};}); }
async function createModernJournal(p={}) { return withTransaction(async c=>{const id=await nextId(c,'ONYX_JOURNAL_ENTRY','ENTRY_ID');const no=p.entryNo||`JV-${Date.now()}`;await c.query('INSERT INTO ONYX_JOURNAL_ENTRY (ENTRY_ID,COMPANY_ID,BRANCH_ID,FISCAL_YEAR_ID,ENTRY_NO,ENTRY_DATE,DESCRIPTION_AR,STATUS_CODE,SOURCE_CODE) VALUES (?,1,1,1,?,? ,?,\'POSTED\',\'MANUAL\')',[id,no,dateValue(p.date||today()),p.description||'قيد يدوي']);for(const l of (p.lines||[])){const lid=await nextId(c,'ONYX_JOURNAL_LINE','LINE_ID');const account=rows(await c.query('SELECT ACCOUNT_ID FROM ONYX_ACCOUNT WHERE ACCOUNT_CODE=?',[l.accountCode||'']));if(!account.length)throw new Error(`الحساب غير موجود: ${l.accountCode||''}`);await c.query('INSERT INTO ONYX_JOURNAL_LINE (LINE_ID,ENTRY_ID,ACCOUNT_ID,LINE_DESCRIPTION_AR,DEBIT,CREDIT) VALUES (?,?,?,?,?,?)',[lid,id,Number(val(account[0],'ACCOUNT_ID')),l.description||p.description||'',Number(l.debit||0),Number(l.credit||0)]);}return {entryId:id,entryNo:no,status:'POSTED'};});}
async function journal(limit=50){await setup();const result=rows(await query('SELECT ENTRY_NO AS JV_NO,ENTRY_DATE AS AD_DATE,DESCRIPTION_AR AS DESCRIPTION,STATUS_CODE,0 AS DEBIT,0 AS CREDIT FROM ONYX_JOURNAL_ENTRY ORDER BY ENTRY_DATE DESC'));return result.slice(0,Math.min(Number(limit)||50,250));}

async function createModernInvoice(p={}) { return withTransaction(async c=>{ const type=p.type==='PURCHASE'?'PURCHASE':'SALE'; const lines=Array.isArray(p.lines)?p.lines:[];if(!lines.length)throw new Error('الفاتورة تحتاج إلى صنف واحد على الأقل.'); const contact=rows(await c.query('SELECT CONTACT_ID,CONTACT_TYPE FROM ONYX_CONTACT WHERE CODE=? AND COMPANY_ID=1',[p.contactCode||p.partyCode||p.party])); if(!contact.length)throw new Error('العميل أو المورد غير موجود.'); const expected=type==='SALE'?'CUSTOMER':'VENDOR';if(String(val(contact[0],'CONTACT_TYPE'))!==expected)throw new Error('نوع الجهة لا يتوافق مع الفاتورة.'); const invoiceId=await nextId(c,'ONYX_INVOICE','INVOICE_ID');const no=`${type==='SALE'?'INV':'PUR'}-${Date.now()}`;let subtotal=0;for(const line of lines){const item=rows(await c.query('SELECT ITEM_ID,COST_PRICE,QUANTITY FROM ONYX_ITEM WHERE ITEM_CODE=? AND COMPANY_ID=1',[line.itemCode]));if(!item.length)throw new Error(`الصنف غير موجود: ${line.itemCode}`);const qty=Number(line.quantity||0),price=Number(line.unitPrice||0);const stock=Number(val(item[0],'QUANTITY',0));if(type==='SALE'&&stock<qty)throw new Error(`الرصيد المخزني غير كافٍ للصنف: ${line.itemCode}`);subtotal+=qty*price;}const tax=Number(p.taxAmount||0),total=subtotal+tax;const method=p.paymentMethod||'CREDIT';const paid=method==='CASH'?total:(Number(p.paidAmount)||0);const outstanding=total-paid;await c.query('INSERT INTO ONYX_INVOICE (INVOICE_ID,COMPANY_ID,BRANCH_ID,FISCAL_YEAR_ID,INVOICE_TYPE,INVOICE_NO,CONTACT_ID,INVOICE_DATE,SUBTOTAL,DISCOUNT_AMOUNT,TAX_AMOUNT,TOTAL_AMOUNT,PAYMENT_METHOD,PAID_AMOUNT,OUTSTANDING_AMOUNT,STATUS_CODE,CURRENCY_CODE,EXCHANGE_RATE) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[invoiceId,1,1,1,type,no,Number(val(contact[0],'CONTACT_ID')),dateValue(p.invoiceDate||today()),subtotal,0,tax,total,method,paid,outstanding,'POSTED',p.currency||'SAR',Number(p.exchangeRate||1)]);for(const line of lines){const item=rows(await c.query('SELECT ITEM_ID,COST_PRICE,QUANTITY FROM ONYX_ITEM WHERE ITEM_CODE=? AND COMPANY_ID=1',[line.itemCode]));const itemId=Number(val(item[0],'ITEM_ID'));const delta=type==='SALE'?-Number(line.quantity):Number(line.quantity);const lid=await nextId(c,'ONYX_INVOICE_LINE','LINE_ID');await c.query('INSERT INTO ONYX_INVOICE_LINE (LINE_ID,INVOICE_ID,ITEM_ID,QUANTITY,UNIT_PRICE,UNIT_COST,DISCOUNT_AMOUNT,LINE_TOTAL) VALUES (?,?,?,?,?,?,?,?)',[lid,invoiceId, itemId,Number(line.quantity),Number(line.unitPrice),Number(val(item[0],'COST_PRICE',0)),0,Number(line.quantity)*Number(line.unitPrice)]);await c.query('UPDATE ONYX_ITEM SET QUANTITY=QUANTITY+? WHERE ITEM_ID=?',[delta,itemId]);const mid=await nextId(c,'ONYX_STOCK_MOVEMENT','MOVEMENT_ID');await c.query('INSERT INTO ONYX_STOCK_MOVEMENT (MOVEMENT_ID,COMPANY_ID,BRANCH_ID,WAREHOUSE_ID,ITEM_ID,INVOICE_ID,MOVEMENT_TYPE,QUANTITY,UNIT_COST,MOVEMENT_DATE) VALUES (?,1,1,1,?,?,?, ?,?,?)',[mid,itemId,invoiceId,type,delta,Number(val(item[0],'COST_PRICE',0)),dateValue(p.invoiceDate||today())]);}return {invoiceId,invoiceNo:no,entryId:null,type,total,status:'POSTED'};}); }
async function listInvoices(p={}){await setup();let sql='SELECT i.INVOICE_ID,i.INVOICE_NO,i.INVOICE_TYPE,i.INVOICE_DATE,i.SUBTOTAL,i.TAX_AMOUNT,i.TOTAL_AMOUNT,i.PAID_AMOUNT,i.OUTSTANDING_AMOUNT,i.STATUS_CODE,i.CURRENCY_CODE,c.CODE AS CONTACT_CODE,c.NAME_AR AS CONTACT_NAME FROM ONYX_INVOICE i LEFT JOIN ONYX_CONTACT c ON c.CONTACT_ID=i.CONTACT_ID WHERE i.COMPANY_ID=1';const params=[];if(p.invoiceType){sql+=' AND i.INVOICE_TYPE=?';params.push(p.invoiceType);}sql+=' ORDER BY i.INVOICE_DATE DESC';return rows(await query(sql,params));}
async function getInvoice(invoiceId) { await setup(); const header = rows(await query('SELECT i.*,c.CODE AS CONTACT_CODE FROM ONYX_INVOICE i LEFT JOIN ONYX_CONTACT c ON c.CONTACT_ID=i.CONTACT_ID WHERE i.INVOICE_ID=? AND i.COMPANY_ID=1', [Number(invoiceId)])); if (!header.length) throw new Error('الفاتورة غير موجودة.'); const lines = rows(await query('SELECT l.*,i.ITEM_CODE FROM ONYX_INVOICE_LINE l JOIN ONYX_ITEM i ON i.ITEM_ID=l.ITEM_ID WHERE l.INVOICE_ID=? ORDER BY l.LINE_ID', [Number(invoiceId)])); return { ...header[0], lines: lines.map(line => ({ itemCode: val(line, 'ITEM_CODE'), description: val(line, 'LINE_DESCRIPTION_AR', ''), quantity: Number(val(line, 'QUANTITY', 0)), unitPrice: Number(val(line, 'UNIT_PRICE', 0)) })) }; }
async function voidInvoice(invoiceId) { return withTransaction(async c => { const invoice = rows(await c.query('SELECT INVOICE_ID,STATUS_CODE FROM ONYX_INVOICE WHERE INVOICE_ID=? AND COMPANY_ID=1', [Number(invoiceId)])); if (!invoice.length) throw new Error('الفاتورة غير موجودة.'); if (String(val(invoice[0], 'STATUS_CODE')) === 'VOID') return { invoiceId: Number(invoiceId), status: 'VOID' }; const movements = rows(await c.query('SELECT ITEM_ID,QUANTITY FROM ONYX_STOCK_MOVEMENT WHERE INVOICE_ID=?', [Number(invoiceId)])); for (const movement of movements) await c.query('UPDATE ONYX_ITEM SET QUANTITY=QUANTITY-? WHERE ITEM_ID=?', [Number(val(movement, 'QUANTITY', 0)), Number(val(movement, 'ITEM_ID'))]); await c.query("UPDATE ONYX_INVOICE SET STATUS_CODE='VOID' WHERE INVOICE_ID=?", [Number(invoiceId)]); return { invoiceId: Number(invoiceId), status: 'VOID' }; }); }
async function updateInvoice(p={}) { const old = await getInvoice(p.invoiceId); await voidInvoice(p.invoiceId); try { return await createModernInvoice({ ...p, type: String(val(old, 'INVOICE_TYPE')) }); } catch (error) { throw new Error(`تم إلغاء الفاتورة القديمة لكن تعذر إنشاء النسخة المعدلة: ${error.message}`); } }
async function listWarehouses(){await setup();return rows(await query('SELECT WAREHOUSE_ID,WAREHOUSE_CODE,WAREHOUSE_NAME_AR,ACTIVE_FLAG FROM ONYX_WAREHOUSE WHERE COMPANY_ID=1'))}
async function listStockMovements(){await setup();return rows(await query('SELECT * FROM ONYX_STOCK_MOVEMENT ORDER BY MOVEMENT_DATE DESC'))}
async function financialReports(p={}){await setup();const inv=await listInvoices({});const sales=inv.filter(x=>val(x,'INVOICE_TYPE')==='SALE').reduce((s,x)=>s+Number(val(x,'TOTAL_AMOUNT',0)),0);const purchases=inv.filter(x=>val(x,'INVOICE_TYPE')==='PURCHASE').reduce((s,x)=>s+Number(val(x,'TOTAL_AMOUNT',0)),0);return {period:{startDate:p.startDate||`${new Date().getFullYear()}-01-01`,endDate:p.endDate||today()},kpis:{revenue:sales,expenses:purchases,profit:sales-purchases,assets:0,liabilities:0,equity:0,cash:0},trialBalance:[]};}
async function trialBalanceReport(p={}){return {period:{startDate:p.startDate||'1900-01-01',endDate:p.endDate||today()},rows:[],totals:{debit:0,credit:0}};}
async function generalLedgerReport(p={}){return {period:{startDate:p.startDate||'1900-01-01',endDate:p.endDate||today()},accountCode:p.accountCode||null,rows:[]};}
async function incomeStatementReport(p={}){const r=await financialReports(p);return {period:r.period,rows:[],totals:{revenue:r.kpis.revenue,expenses:r.kpis.expenses,profit:r.kpis.profit}};}
async function balanceSheetReport(p={}){return {period:{startDate:p.startDate||'1900-01-01',endDate:p.endDate||today()},rows:[],totals:{assets:0,liabilities:0,equity:0,balancedDifference:0}};}
async function salesPurchaseReport(p={}){return {period:{startDate:p.startDate||'1900-01-01',endDate:p.endDate||today()},rows:[]};}
async function inventoryValuationReport(p={}){const items=await modernItems('');return {period:{startDate:p.startDate||'1900-01-01',endDate:p.endDate||today()},rows:items,totalValue:items.reduce((s,x)=>s+Number(val(x,'QUANTITY',0))*Number(val(x,'COST_PRICE',0)),0)};}

async function organizationSettings(){await setup();const company=rows(await query('SELECT COMPANY_ID,COMPANY_CODE,COMPANY_NAME_AR,BASE_CURRENCY FROM ONYX_COMPANY WHERE COMPANY_ID=1'))[0];const branch=rows(await query('SELECT BRANCH_ID,BRANCH_CODE,BRANCH_NAME_AR FROM ONYX_BRANCH WHERE BRANCH_ID=1'))[0];const fiscalYear=rows(await query('SELECT FISCAL_YEAR_ID,FISCAL_YEAR,START_DATE,END_DATE,STATUS_CODE FROM ONYX_FISCAL_YEAR WHERE FISCAL_YEAR_ID=1'))[0];return {company,branch,fiscalYear};}
async function updateOrganizationSettings(p={}){return withTransaction(async c=>{const companyName=String(p.companyName||'').trim();const companyCode=String(p.companyCode||'').trim().toUpperCase();const branchName=String(p.branchName||'').trim();const branchCode=String(p.branchCode||'').trim().toUpperCase();const fiscalYear=Number(p.fiscalYear);if(!companyName||!companyCode||!branchName||!branchCode||!Number.isInteger(fiscalYear)||fiscalYear<2000||fiscalYear>2200)throw new Error('بيانات الشركة والفرع والسنة المالية غير صالحة.');await c.query('UPDATE ONYX_COMPANY SET COMPANY_CODE=?,COMPANY_NAME_AR=?,BASE_CURRENCY=? WHERE COMPANY_ID=1',[companyCode,companyName,p.currency||'SAR']);await c.query('UPDATE ONYX_BRANCH SET BRANCH_CODE=?,BRANCH_NAME_AR=? WHERE BRANCH_ID=1',[branchCode,branchName]);await c.query('UPDATE ONYX_FISCAL_YEAR SET FISCAL_YEAR=?,START_DATE=?,END_DATE=? WHERE FISCAL_YEAR_ID=1',[fiscalYear,dateValue(`${fiscalYear}-01-01`),dateValue(`${fiscalYear}-12-31`)]);await c.query('UPDATE ONYX_WAREHOUSE SET WAREHOUSE_CODE=?,WAREHOUSE_NAME_AR=? WHERE WAREHOUSE_ID=1',[branchCode,branchName]);return {companyName,companyCode,branchName,branchCode,fiscalYear};});}
async function authenticate(username,password){await setup();const result=rows(await query('SELECT * FROM ONYX_USER WHERE UCASE(USERNAME)=?',[String(username||'').toUpperCase()]));const user=result[0];if(!user||!verifyPassword(password,val(user,'PASSWORD_HASH')))throw new Error('بيانات الدخول غير صحيحة.');const settings=await organizationSettings();return {userId:Number(val(user,'USER_ID')),username:val(user,'USERNAME'),displayNameAr:val(user,'DISPLAY_NAME_AR'),languageCode:'ar',permissions:['ALL'],roles:[{ROLE_NAME_AR:'مدير النظام'}],context:{companyId:1,branchId:1,fiscalYearId:1},company:{COMPANY_NAME_AR:val(settings.company,'COMPANY_NAME_AR'),BRANCH_NAME_AR:val(settings.branch,'BRANCH_NAME_AR'),FISCAL_YEAR:Number(val(settings.fiscalYear,'FISCAL_YEAR'))}};}
async function listUsers(){await setup();return rows(await query('SELECT USER_ID,USERNAME,DISPLAY_NAME_AR,LANGUAGE_CODE,ACTIVE_FLAG FROM ONYX_USER'));}
async function createUser(p={}){return withTransaction(async c=>{const id=await nextId(c,'ONYX_USER','USER_ID');await c.query('INSERT INTO ONYX_USER (USER_ID,USERNAME,DISPLAY_NAME_AR,PASSWORD_HASH,LANGUAGE_CODE,ACTIVE_FLAG,FAILED_ATTEMPTS) VALUES (?,?,?,?,\'ar\',1,0)',[id,String(p.username).toUpperCase(),p.displayNameAr,hashPassword(p.password)]);return {userId:id,username:p.username,displayNameAr:p.displayNameAr};});}
async function listRoles(){await setup();return rows(await query('SELECT * FROM ONYX_ROLE'));}
async function assignRole(){return true;}
async function listSessionContexts(){const settings=await organizationSettings();return [{COMPANY_ID:1,COMPANY_CODE:val(settings.company,'COMPANY_CODE'),COMPANY_NAME_AR:val(settings.company,'COMPANY_NAME_AR'),BRANCH_ID:1,BRANCH_CODE:val(settings.branch,'BRANCH_CODE'),BRANCH_NAME_AR:val(settings.branch,'BRANCH_NAME_AR'),FISCAL_YEAR_ID:1,FISCAL_YEAR:Number(val(settings.fiscalYear,'FISCAL_YEAR'))}];}
async function setSessionContext(userId,p={}){return {companyId:p.companyId||1,branchId:p.branchId||1,fiscalYearId:p.fiscalYearId||1};}
async function recordAudit(p={}){await setup();await query('INSERT INTO ONYX_AUDIT_LOG (USER_ID,COMPANY_ID,BRANCH_ID,FISCAL_YEAR_ID,ACTION_CODE,ENTITY_TYPE,ENTITY_ID,AFTER_VALUE,CREATED_AT) VALUES (?,?,?,?,?,?,?,?,?)',[p.userId||1,p.companyId||1,p.branchId||1,p.fiscalYearId||1,p.actionCode||'',p.entityType||'',String(p.entityId||''),JSON.stringify(p.afterValue||{}),new Date()]);return true;}
async function listAudit(){await setup();return rows(await query('SELECT * FROM ONYX_AUDIT_LOG ORDER BY CREATED_AT DESC'));}
async function createCashVoucher(){throw new Error('سندات الخزينة ستضاف في إصدار Access التالي.');}
async function listCashVouchers(){return [];}
async function updateCashVoucher(){throw new Error('غير مدعوم بعد.');}
async function voidCashVoucher(){throw new Error('غير مدعوم بعد.');}
async function createExpenseIncome(){throw new Error('المصروفات والإيرادات ستضاف في إصدار Access التالي.');}
async function listExpenseIncome(){return [];}
async function updateExpenseIncome(){throw new Error('غير مدعوم بعد.');}
async function voidExpenseIncome(){throw new Error('غير مدعوم بعد.');}
async function createReceivablePayment(){throw new Error('التحصيلات ستضاف في إصدار Access التالي.');}
async function postReceivablePayment(){throw new Error('غير مدعوم بعد.');}
async function listReceivablePayments(){return [];}
async function receivablesAgingReport(){return {rows:[],totals:{}};}
async function listFiscalPeriods(){return [{PERIOD_ID:1,PERIOD_CODE:'CURRENT',PERIOD_NAME_AR:'الفترة الحالية',STATUS_CODE:'OPEN'}];}
async function precheckFiscalPeriodClose(){return {canClose:false,checks:[],summary:{canClose:false}};}
async function closeFiscalPeriod(){throw new Error('إقفال الفترات سيضاف بعد اكتمال وحدة Access.');}
async function reopenFiscalPeriod(){throw new Error('غير مدعوم بعد.');}
async function listPeriodCloseHistory(){return [];}
async function createTradeDocument(){throw new Error('المستندات التجارية ستضاف في إصدار Access التالي.');}
async function listTradeDocuments(){return [];}
async function transitionTradeDocument(){throw new Error('غير مدعوم بعد.');}
async function close(){initialized=false;}

module.exports={initialize,bootstrapStatus,test,dashboard,accounts,customers,journal,financialReports,trialBalanceReport,generalLedgerReport,incomeStatementReport,balanceSheetReport,salesPurchaseReport,inventoryValuationReport,modernAccounts,createModernAccount,modernContacts,createModernContact,modernItems,createModernItem,createModernInvoice,getInvoice,updateInvoice,voidInvoice,listInvoices,listWarehouses,listStockMovements,createTradeDocument,listTradeDocuments,transitionTradeDocument,createCashVoucher,listCashVouchers,updateCashVoucher,voidCashVoucher,createExpenseIncome,listExpenseIncome,updateExpenseIncome,voidExpenseIncome,createReceivablePayment,postReceivablePayment,listReceivablePayments,receivablesAgingReport,listFiscalPeriods,precheckFiscalPeriodClose,closeFiscalPeriod,reopenFiscalPeriod,listPeriodCloseHistory,organizationSettings,updateOrganizationSettings,authenticate,createUser,listUsers,listRoles,assignRole,listSessionContexts,setSessionContext,recordAudit,listAudit,close};
