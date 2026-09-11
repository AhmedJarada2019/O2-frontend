const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  save: (url) => ipcRenderer.send('save-server-url', url),
  onCurrentUrl: (callback) => ipcRenderer.on('current-url', (_event, url) => callback(url)),
});
