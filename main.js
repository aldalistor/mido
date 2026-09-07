const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');
const dbSetup = require('./db-setup');
const sessionContext = require('./session-context');
const { validateLicense } = require('./license-core');

let currentSession = null;

function currentLicense() {
  const token = process.env.MIDO_LICENSE_TOKEN;
  if (!token) return { valid: true, mode: 'DEVELOPMENT', readOnly: false, reason: 'NO_LICENSE_CONFIGURED' };
  const result = validateLicense(token, { publicKey: process.env.MIDO_LICENSE_PUBLIC_KEY, now: new Date() });
  return { ...result, readOnly: !result.valid };
}
function requirePermission(permission) {
  if (!currentSession) throw new Error('يجب تسجيل الدخول أولاً.');
  const granted = new Set((currentSession.permissions || []).map(value => String(value).toUpperCase()));
  if (!granted.has(String(permission).toUpperCase()) && !granted.has('MANAGE_USERS') && !granted.has('ALL')) throw new Error('لا تملك صلاحية تنفيذ هذه العملية.');
}
function requireWritable() {
  if (currentSession?.license?.readOnly) throw new Error('انتهى الترخيص أو أصبح غير صالح. النظام في وضع القراءة فقط.');
}
function registerDatabaseHandlers() {
  ipcMain.handle('db:setup-test', (_event, payload = {}) => { requirePermission('MANAGE_DATABASE'); requireWritable(); return dbSetup.testConnection(payload); });
  ipcMain.handle('db:setup-inspect', (_event, payload = {}) => { requirePermission('MANAGE_DATABASE'); return dbSetup.inspectOracleSchema(payload); });
  ipcMain.handle('db:setup-initialize', (_event, payload = {}) => { requirePermission('MANAGE_DATABASE'); requireWritable(); return dbSetup.initializeSchema(payload); });
  ipcMain.handle('db:test', () => { requirePermission('VIEW_DASHBOARD'); return db.test(); });
  ipcMain.handle('db:dashboard', () => { requirePermission('VIEW_DASHBOARD'); return db.dashboard(); });
  ipcMain.handle('db:accounts', (_event, payload = {}) => { requirePermission('VIEW_ACCOUNTS'); return db.accounts(payload.search || ''); });
  ipcMain.handle('db:modern-accounts', (_event, payload = {}) => { requirePermission('VIEW_ACCOUNTS'); return db.modernAccounts(payload.search || ''); });
  ipcMain.handle('db:create-account', async (_event, payload = {}) => { requirePermission('MANAGE_ACCOUNTS'); requireWritable(); const result = await db.createModernAccount({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_ACCOUNT', entityType: 'ACCOUNT', entityId: result.accountId, afterValue: result }); return result; });
  ipcMain.handle('db:modern-contacts', (_event, payload = {}) => { requirePermission('VIEW_CONTACTS'); return db.modernContacts(payload.search || ''); });
  ipcMain.handle('db:create-contact', async (_event, payload = {}) => { requirePermission('MANAGE_CONTACTS'); requireWritable(); const result = await db.createModernContact({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_CONTACT', entityType: 'CONTACT', entityId: result.contactId || result.code, afterValue: result }); return result; });
  ipcMain.handle('db:modern-items', (_event, payload = {}) => { requirePermission('VIEW_INVENTORY'); return db.modernItems(payload.search || ''); });
  ipcMain.handle('db:create-item', async (_event, payload = {}) => { requirePermission('MANAGE_INVENTORY'); requireWritable(); const result = await db.createModernItem({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_ITEM', entityType: 'ITEM', entityId: result.itemId || result.code, afterValue: result }); return result; });
  ipcMain.handle('db:create-invoice', async (_event, payload = {}) => { requirePermission('CREATE_INVOICES'); requireWritable(); const result = await db.createInvoiceDraft({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_INVOICE_DRAFT', entityType: 'INVOICE', entityId: result.invoiceId, afterValue: result }); return result; });
  ipcMain.handle('db:approve-invoice', async (_event, payload = {}) => { requirePermission('APPROVE_INVOICES'); requirePermission('POST_JOURNALS'); requireWritable(); const result = await db.approveModernInvoice({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'APPROVE_POST_INVOICE', entityType: 'INVOICE', entityId: result.invoiceId, afterValue: result }); return result; });
  ipcMain.handle('db:record-payment', async (_event, payload = {}) => { requirePermission('RECORD_PAYMENTS'); requireWritable(); const result = await db.recordInvoicePayment({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'RECORD_INVOICE_PAYMENT', entityType: 'INVOICE_PAYMENT', entityId: result.paymentId, afterValue: result }); return result; });
  ipcMain.handle('db:create-return', async (_event, payload = {}) => { requirePermission('CREATE_RETURNS'); requireWritable(); const result = await db.createInvoiceReturn({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_INVOICE_RETURN', entityType: 'INVOICE_RETURN', entityId: result.returnInvoiceId, afterValue: result }); return result; });
  ipcMain.handle('documents:create', async (_event, payload = {}) => { requirePermission(payload.documentType?.includes('ORDER') ? 'CREATE_ORDERS' : 'CREATE_INVOICES'); requireWritable(); const result = await db.createTradeDocument({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_TRADE_DOCUMENT', entityType: payload.documentType || 'TRADE_DOCUMENT', entityId: result.documentId, afterValue: result }); return result; });
  ipcMain.handle('documents:list', (_event, payload = {}) => { requirePermission('VIEW_REPORTS'); return db.listTradeDocuments(payload); });
  ipcMain.handle('documents:transition', async (_event, payload = {}) => { requirePermission(payload.nextStatus === 'POSTED' ? 'POST_JOURNALS' : 'CREATE_ORDERS'); if (payload.nextStatus === 'POSTED') requirePermission('APPROVE_INVOICES'); requireWritable(); return db.transitionTradeDocument({ ...payload, userId: currentSession.userId }); });
  ipcMain.handle('db:customers', (_event, payload = {}) => { requirePermission('VIEW_CONTACTS'); return db.customers(payload.search || ''); });
  ipcMain.handle('db:journal', (_event, payload = {}) => { requirePermission('VIEW_REPORTS'); return db.journal(payload.limit || 50); });
  ipcMain.handle('reports:financial', (_event, payload = {}) => { requirePermission('VIEW_REPORTS'); return db.financialReports(payload); });
  ipcMain.handle('db:create-journal', async (_event, payload = {}) => { requirePermission('POST_JOURNALS'); requireWritable(); const result = await db.createModernJournal({ ...payload, userId: currentSession.userId }); await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'CREATE_JOURNAL', entityType: 'JOURNAL_ENTRY', entityId: result.entryId, afterValue: result }); return result; });
  ipcMain.handle('auth:current', () => currentSession);
  ipcMain.handle('auth:license', () => currentLicense());
  ipcMain.handle('auth:contexts', () => { if (!currentSession) throw new Error('يجب تسجيل الدخول أولاً.'); return db.listSessionContexts(currentSession.userId); });
  ipcMain.handle('auth:set-context', async (_event, payload = {}) => { if (!currentSession) throw new Error('يجب تسجيل الدخول أولاً.'); const selected = await db.setSessionContext(currentSession.userId, payload); currentSession = { ...currentSession, context: sessionContext.normalizeContext({ ...payload, languageCode: currentSession.languageCode, terminal: 'Electron' }), company: selected }; await db.recordAudit({ ...currentSession.context, userId: currentSession.userId, actionCode: 'SET_SESSION_CONTEXT', entityType: 'SESSION', entityId: currentSession.userId, afterValue: selected }); return currentSession; });
  ipcMain.handle('auth:login', async (_event, payload = {}) => { currentSession = await db.authenticate(payload.username, payload.password, { languageCode: 'ar', terminal: 'Electron' }); currentSession.license = currentLicense(); return currentSession; });
  ipcMain.handle('auth:logout', async () => { if (currentSession) { await db.recordAudit({ ...(currentSession.context || {}), userId: currentSession.userId, actionCode: 'LOGOUT', entityType: 'SESSION', entityId: currentSession.userId }); } currentSession = null; return true; });
  ipcMain.handle('admin:list-audit', (_event, payload = {}) => { requirePermission('VIEW_AUDIT_LOG'); return db.listAudit({ ...(currentSession.context || {}), ...payload }); });
  ipcMain.handle('admin:has-users', async () => (await db.listUsers()).length > 0);
  ipcMain.handle('admin:list-users', () => { requirePermission('MANAGE_USERS'); return db.listUsers(); });
  ipcMain.handle('admin:list-roles', () => { requirePermission('MANAGE_ROLES'); return db.listRoles(); });
  ipcMain.handle('admin:create-user', async (_event, payload = {}) => { requireWritable(); const users = await db.listUsers(); if (users.length > 0) requirePermission('MANAGE_USERS'); const user = await db.createUser({ ...payload, actorUserId: currentSession?.userId }); if (users.length === 0) await db.assignRole(user.userId, 'ADMIN'); return user; });
  ipcMain.handle('admin:assign-role', (_event, payload = {}) => { requirePermission('MANAGE_USERS'); requireWritable(); return db.assignRole(payload.userId, payload.roleCode, currentSession.userId); });
}
function createWindow() { const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1120, minHeight: 720, backgroundColor: '#f6f8fb', title: 'أونكس المحاسبي', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } }); window.loadFile(path.join(__dirname, 'index.html')); }
app.whenReady().then(() => { registerDatabaseHandlers(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('before-quit', async () => { await db.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
