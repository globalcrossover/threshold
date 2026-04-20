// Threshold — Preload v0.4.0
// Secure bridge between main process and renderer
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('threshold', {
  // ── Platform ─────────────────────────────────────────
  platform: process.platform,

  // ── Window Controls ──────────────────────────────────
  minimize: ()     => ipcRenderer.send('window-minimize'),
  maximize: ()     => ipcRenderer.send('window-maximize'),
  close:    ()     => ipcRenderer.send('window-close'),

  // ── JS Window Drag ────────────────────────────────────
  getWindowPos: ()       => ipcRenderer.invoke('get-window-pos'),
  setWindowPos: (x, y)   => ipcRenderer.send('set-window-pos', x, y),

  // ── Search ───────────────────────────────────────────
  search: (query) => ipcRenderer.invoke('brave-search', query),

  // ── VAULTit ──────────────────────────────────────────
  vault: {
    list:   ()     => ipcRenderer.invoke('vault-list'),
    save:   (cred) => ipcRenderer.invoke('vault-save', cred),
    delete: (id)   => ipcRenderer.invoke('vault-delete', id),
  },

  // ── Context Menu ─────────────────────────────────────
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),

  // ── IPC Message Listener ─────────────────────────────
  onMessage: (channel, fn) => {
    const safe = ['tray-new-tab', 'ctx-open-tab', 'ctx-search', 'ctx-inspect']
    if (safe.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => fn(...args))
    }
  },
})
