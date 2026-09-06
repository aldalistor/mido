const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('onyxAPI', {
  dbTest: () => ipcRenderer.invoke('db:test'),
  dashboard: () => ipcRenderer.invoke('db:dashboard'),
  accounts: (search = '') => ipcRenderer.invoke('db:accounts', { search }),
  modernAccounts: (search = '') => ipcRenderer.invoke('db:modern-accounts', { search }),
  createAccount: (payload) => ipcRenderer.invoke('db:create-account', payload),
  customers: (search = '') => ipcRenderer.invoke('db:customers', { search }),
  journal: (limit = 50) => ipcRenderer.invoke('db:journal', { limit }),
  createJournal: (payload) => ipcRenderer.invoke('db:create-journal', payload),
});
