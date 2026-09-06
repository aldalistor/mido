const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('onyxAPI', {
  dbTest: () => ipcRenderer.invoke('db:test'),
  dashboard: () => ipcRenderer.invoke('db:dashboard'),
  accounts: (search = '') => ipcRenderer.invoke('db:accounts', { search }),
  customers: (search = '') => ipcRenderer.invoke('db:customers', { search }),
  journal: (limit = 50) => ipcRenderer.invoke('db:journal', { limit }),
});
