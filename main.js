const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

let currentSession = null;
function requirePermission(permission) { if (!currentSession) throw new Error('يجب تسجيل الدخول أولاً.'); if (!currentSession.permissions.includes(permission) && !currentSession.permissions.includes('MANAGE_USERS')) throw new Error('لا تملك صلاحية تنفيذ هذه العملية.'); }
function registerDatabaseHandlers() {
  ipcMain.handle('db:test', () => db.test());
  ipcMain.handle('db:dashboard', () => db.dashboard());
  ipcMain.handle('db:accounts', (_event, payload = {}) => db.accounts(payload.search || ''));
  ipcMain.handle('db:modern-accounts', (_event, payload = {}) => db.modernAccounts(payload.search || ''));
  ipcMain.handle('db:create-account', (_event, payload = {}) => { requirePermission('MANAGE_ACCOUNTS'); return db.createModernAccount(payload); });
  ipcMain.handle('db:modern-contacts', (_event, payload = {}) => db.modernContacts(payload.search || ''));
  ipcMain.handle('db:create-contact', (_event, payload = {}) => { requirePermission('MANAGE_CONTACTS'); return db.createModernContact(payload); });
  ipcMain.handle('db:modern-items', (_event, payload = {}) => db.modernItems(payload.search || ''));
  ipcMain.handle('db:create-item', (_event, payload = {}) => { requirePermission('MANAGE_INVENTORY'); return db.createModernItem(payload); });
  ipcMain.handle('db:create-invoice', (_event, payload = {}) => { requirePermission('CREATE_INVOICES'); return db.createModernInvoice(payload); });
  ipcMain.handle('db:customers', (_event, payload = {}) => db.customers(payload.search || ''));
  ipcMain.handle('db:journal', (_event, payload = {}) => db.journal(payload.limit || 50));
  ipcMain.handle('db:create-journal', (_event, payload = {}) => { requirePermission('POST_JOURNALS'); return db.createModernJournal(payload); });
  ipcMain.handle('auth:current', () => currentSession);
  ipcMain.handle('auth:login', async (_event, payload = {}) => { currentSession = await db.authenticate(payload.username, payload.password, { languageCode: 'ar', terminal: 'Electron' }); return currentSession; });
  ipcMain.handle('auth:logout', async () => { currentSession = null; return true; });
  ipcMain.handle('admin:has-users', async () => (await db.listUsers()).length > 0);
  ipcMain.handle('admin:list-users', () => { requirePermission('MANAGE_USERS'); return db.listUsers(); });
  ipcMain.handle('admin:list-roles', () => { requirePermission('MANAGE_ROLES'); return db.listRoles(); });
  ipcMain.handle('admin:create-user', async (_event, payload = {}) => { const users = await db.listUsers(); if (users.length > 0) requirePermission('MANAGE_USERS'); const user = await db.createUser(payload); if (users.length === 0) await db.assignRole(user.userId, 'ADMIN'); return user; });
  ipcMain.handle('admin:assign-role', (_event, payload = {}) => { requirePermission('MANAGE_USERS'); return db.assignRole(payload.userId, payload.roleCode); });
}
function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1120, minHeight: 720, backgroundColor: '#f6f8fb', title: 'أونكس المحاسبي', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') } });
  window.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => { registerDatabaseHandlers(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('before-quit', async () => { await db.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
