const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');

function registerDatabaseHandlers() {
  ipcMain.handle('db:test', () => db.test());
  ipcMain.handle('db:dashboard', () => db.dashboard());
  ipcMain.handle('db:accounts', (_event, payload = {}) => db.accounts(payload.search || ''));
  ipcMain.handle('db:modern-accounts', (_event, payload = {}) => db.modernAccounts(payload.search || ''));
  ipcMain.handle('db:create-account', (_event, payload = {}) => db.createModernAccount(payload));
  ipcMain.handle('db:customers', (_event, payload = {}) => db.customers(payload.search || ''));
  ipcMain.handle('db:journal', (_event, payload = {}) => db.journal(payload.limit || 50));
  ipcMain.handle('db:create-journal', (_event, payload = {}) => db.createModernJournal(payload));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#f6f8fb',
    title: 'أونكس المحاسبي',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  registerDatabaseHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async () => { await db.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
