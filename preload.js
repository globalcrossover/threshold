// Threshold — Preload Script
// Exposes safe APIs to the renderer

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('threshold', {
  platform:        process.platform,
  openExternal:    (url) => ipcRenderer.send('open-external', url),
  minimize:        ()    => ipcRenderer.send('window-minimize'),
  maximize:        ()    => ipcRenderer.send('window-maximize'),
  close:           ()    => ipcRenderer.send('window-close'),
  // Fetch active search engine URL from main process config
  getSearchConfig: ()    => ipcRenderer.invoke('get-search-config'),
})
