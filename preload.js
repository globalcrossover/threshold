// Threshold — Preload Script v0.3
// Exposes safe APIs to the renderer

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('threshold', {
  platform:        process.platform,
  openExternal:    (url)    => ipcRenderer.send('open-external', url),
  minimize:        ()       => ipcRenderer.send('window-minimize'),
  maximize:        ()       => ipcRenderer.send('window-maximize'),
  close:           ()       => ipcRenderer.send('window-close'),
  getSearchConfig: ()       => ipcRenderer.invoke('get-search-config'),

  // Threshold Search — calls Brave API via main process (key stays secure)
  search: (query) => ipcRenderer.invoke('brave-search', query),

  // VAULTit — encrypted credential storage
  vault: {
    list:   ()     => ipcRenderer.invoke('vault-list'),
    save:   (cred) => ipcRenderer.invoke('vault-save', cred),
    delete: (id)   => ipcRenderer.invoke('vault-delete', id),
  },

  // Right-click context menu — renderer sends params, main shows native menu
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),

  // Listen for messages from main process (tray, context menu actions)
  onMessage: (channel, fn) => {
    var safe = ['tray-new-tab', 'ctx-open-tab', 'ctx-search', 'ctx-inspect']
    if (safe.includes(channel)) {
      ipcRenderer.on(channel, function(_, ...args) { fn(...args) })
    }
  }
})
