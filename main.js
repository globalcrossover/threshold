// Threshold — Main Process v0.3
// Global Crossover
// Features: Ad Blocker, Email Tracker Blocker, Threshold Search (Brave API),
//           VAULTit Phase 1, System Tray, Right-click Context Menu

'use strict'

const { app, BrowserWindow, ipcMain, shell, session,
        Tray, Menu, nativeImage, safeStorage, clipboard } = require('electron')
const path  = require('path')
const https = require('https')
const zlib  = require('zlib')
const fs    = require('fs')

// ── Brave Search API ──────────────────────────────────
// 1. Sign up free: https://api-dashboard.search.brave.com/register
// 2. Paste your key below replacing the placeholder string
// 3. Rebuild — all Threshold searches will use this key
const BRAVE_API_KEY = 'YOUR_BRAVE_API_KEY_HERE'

// ── Ad Block ──────────────────────────────────────────
const AD_BLOCK_PATTERNS = [
  /doubleclick\.net/, /googlesyndication\.com/, /googleadservices\.com/,
  /googletagservices\.com/, /googletagmanager\.com/, /google-analytics\.com/,
  /adservice\.google\./, /pagead2\.googlesyndication\.com/,
  /amazon-adsystem\.com/, /ads\.amazon\.com/, /advertising\.com/,
  /adtech\.de/, /adblade\.com/, /adcolony\.com/, /adform\.net/, /adnxs\.com/,
  /adsrvr\.org/, /adtechus\.com/, /adzerk\.net/, /bidswitch\.net/,
  /casalemedia\.com/, /contextweb\.com/, /criteo\.com/, /criteo\.net/,
  /demdex\.net/, /districtm\.ca/, /dotomi\.com/, /exelator\.com/,
  /eyeota\.net/, /flashtalking\.com/, /freewheel\.tv/, /gumgum\.com/,
  /id5-sync\.com/, /indexexchange\.com/, /lijit\.com/, /liveintent\.com/,
  /liveramp\.com/, /lotame\.com/, /nexac\.com/, /openx\.net/,
  /outbrain\.com/, /pubmatic\.com/, /quantserve\.com/, /rfihub\.net/,
  /rubiconproject\.com/, /scorecardresearch\.com/, /sharethrough\.com/,
  /smaato\.net/, /spotxchange\.com/, /taboola\.com/, /tapad\.com/,
  /tribalfusion\.com/, /turn\.com/, /undertone\.com/, /yieldbot\.com/,
  /yieldmo\.com/, /zergnet\.com/,
  /agkn\.com/, /bluekai\.com/, /bounceexchange\.com/, /hotjar\.com/,
  /inspectlet\.com/, /mathtag\.com/, /mouseflow\.com/, /parsely\.com/,
  /permutive\.com/, /segment\.com/, /segment\.io/, /statcounter\.com/,
]

// ── Email Tracker Block ───────────────────────────────
const EMAIL_TRACKER_PATTERNS = [
  /sendgrid\.net\/wf\/open/, /sendgrid\.net\/trk/, /mailchimp\.com\/track/,
  /list-manage\.com\/track/, /mandrillapp\.com\/track/, /mailgun\.net\/track/,
  /mailgun\.org\/track/, /hubspot\.com\/track/, /hs-analytics\.net/,
  /marketo\.net\/trk/, /eloqua\.com\/e\/f/, /pardot\.com\/l\/\d/,
  /constantcontact\.com\/track/, /campaignmonitor\.com\/track/,
  /createsend\.com\/track/, /klaviyo\.com\/open/, /drip\.com\/track/,
  /convertkit\.com\/track/, /activecampaign\.com\/track/,
  /mailerlite\.com\/track/, /sendinblue\.com\/track/, /brevo\.com\/track/,
  /aweber\.com\/track/, /getresponse\.com\/track/, /intercom-mail\.com/,
  /intercom\.io\/e\//, /customer\.io\/e\//, /sailthru\.com\/track/,
  /exacttarget\.com\/track/, /mktoresp\.com/, /mktdns\.net/, /trk\.email/,
  /opens\.re/, /t\.dripemail/, /s\.mlsend\.com/, /tracking\.postmark/,
  /beehiiv\.com\/track/, /substack\.com\/track/,
]

const ALL_BLOCKED = [...AD_BLOCK_PATTERNS, ...EMAIL_TRACKER_PATTERNS]

// ── Blocker Setup ─────────────────────────────────────
function setupBlocker(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const url = details.url
    if (url.startsWith('file://') ||
        url.startsWith('http://localhost') ||
        url.startsWith('https://localhost')) {
      return callback({ cancel: false })
    }
    callback({ cancel: ALL_BLOCKED.some(p => p.test(url)) })
  })
}

// ── Threshold Search (Brave API) ──────────────────────
function braveSearch(query) {
  return new Promise(function(resolve, reject) {
    if (!BRAVE_API_KEY || BRAVE_API_KEY === 'YOUR_BRAVE_API_KEY_HERE') {
      return reject(new Error('NO_API_KEY'))
    }
    var reqPath = '/res/v1/web/search?q=' + encodeURIComponent(query) +
                  '&count=10&search_lang=en'
    var options = {
      hostname: 'api.search.brave.com',
      path:     reqPath,
      method:   'GET',
      headers: {
        'X-Subscription-Token': BRAVE_API_KEY,
        'Accept':               'application/json',
        'Accept-Encoding':      'gzip'
      }
    }
    var req = https.get(options, function(res) {
      var chunks = []
      res.on('data', function(c) { chunks.push(c) })
      res.on('end',  function() {
        try {
          var buf = Buffer.concat(chunks)
          var enc = res.headers['content-encoding']
          if (enc === 'gzip') {
            zlib.gunzip(buf, function(err, decoded) {
              if (err) return reject(err)
              try { resolve(JSON.parse(decoded.toString())) }
              catch(e) { reject(e) }
            })
          } else {
            resolve(JSON.parse(buf.toString()))
          }
        } catch(e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ── VAULTit — Secure Credential Storage ──────────────
var VAULT_FILE = null

function getVaultFile() {
  if (!VAULT_FILE) VAULT_FILE = path.join(app.getPath('userData'), 'vault.json')
  return VAULT_FILE
}

function encryptionAvailable() {
  try { return !!(safeStorage && safeStorage.isEncryptionAvailable()) }
  catch(e) { return false }
}

function loadVault() {
  try {
    var vf = getVaultFile()
    if (!fs.existsSync(vf)) return []
    var raw  = JSON.parse(fs.readFileSync(vf, 'utf8'))
    var data = Buffer.from(raw.data, 'base64')
    if (raw.encrypted && encryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(data))
    }
    return JSON.parse(data.toString())
  } catch(e) { return [] }
}

function saveVault(credentials) {
  try {
    var json = JSON.stringify(credentials)
    var enc  = encryptionAvailable()
    var data = enc
      ? safeStorage.encryptString(json).toString('base64')
      : Buffer.from(json).toString('base64')
    fs.writeFileSync(getVaultFile(), JSON.stringify({ data, encrypted: enc }))
  } catch(e) { console.error('VAULTit save error:', e) }
}

// ── Window ────────────────────────────────────────────
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1440,
    height:          960,
    minWidth:        1000,
    minHeight:       700,
    backgroundColor: '#080b12',
    titleBarStyle:   process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 12 },
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
      webviewTag:       true,
      sandbox:          false,
    },
  })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.setMenuBarVisibility(false)
  mainWindow.on('closed', () => { mainWindow = null })
}

// ── System Tray ───────────────────────────────────────
let tray = null

function createTray() {
  try {
    tray = new Tray(nativeImage.createEmpty())
    if (process.platform === 'darwin') tray.setTitle(' \u2141 ')
    tray.setToolTip('Threshold Browser')
    var menu = Menu.buildFromTemplate([
      {
        label: 'Show Threshold',
        click: function() {
          if (mainWindow) { mainWindow.show(); mainWindow.focus() }
          else createWindow()
        }
      },
      { type: 'separator' },
      {
        label: 'New Tab',
        click: function() {
          if (mainWindow) mainWindow.webContents.send('tray-new-tab')
        }
      },
      { type: 'separator' },
      { label: 'Quit Threshold', click: function() { app.quit() } }
    ])
    tray.setContextMenu(menu)
    tray.on('click', function() {
      if (mainWindow) { mainWindow.show(); mainWindow.focus() }
      else createWindow()
    })
  } catch(e) { console.error('Tray error:', e) }
}

// ── App Init ──────────────────────────────────────────
app.whenReady().then(() => {
  setupBlocker(session.defaultSession)
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

// ── IPC — Window Controls ─────────────────────────────
ipcMain.on('open-external',   (_, url) => shell.openExternal(url))
ipcMain.on('window-minimize', ()       => mainWindow?.minimize())
ipcMain.on('window-maximize', ()       => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

ipcMain.handle('get-search-config', () => ({
  engines: { threshold: 'threshold://search?q=' },
  active:  'threshold',
  url:     'threshold://search?q=',
}))

// ── IPC — Threshold Search ────────────────────────────
ipcMain.handle('brave-search', async (_, query) => {
  try {
    var data = await braveSearch(query)
    return { ok: true, results: data.web?.results || [], query }
  } catch(e) {
    return { ok: false, error: e.message, query }
  }
})

// ── IPC — VAULTit ─────────────────────────────────────
ipcMain.handle('vault-list', () => ({
  credentials: loadVault(),
  encrypted:   encryptionAvailable()
}))

ipcMain.handle('vault-save', (_, cred) => {
  var vault = loadVault()
  var idx   = vault.findIndex(function(v) { return v.id === cred.id })
  if (idx >= 0) {
    vault[idx] = cred
  } else {
    vault.push(Object.assign({}, cred, {
      id:      'v_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      savedAt: new Date().toISOString()
    }))
  }
  saveVault(vault)
  return { credentials: vault, encrypted: encryptionAvailable() }
})

ipcMain.handle('vault-delete', (_, id) => {
  var vault = loadVault().filter(function(v) { return v.id !== id })
  saveVault(vault)
  return { credentials: vault, encrypted: encryptionAvailable() }
})

// ── IPC — Right-click Context Menu ───────────────────
var EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/

ipcMain.on('show-context-menu', function(event, params) {
  var items = []

  // Link options
  if (params.linkURL && !params.linkURL.startsWith('javascript:')) {
    items.push({
      label: 'Open Link in New Tab',
      click: function() {
        if (mainWindow) mainWindow.webContents.send('ctx-open-tab', params.linkURL)
      }
    })
    items.push({
      label: 'Copy Link Address',
      click: function() { clipboard.writeText(params.linkURL) }
    })
    items.push({ type: 'separator' })
  }

  // Knock this email
  var emailTarget = null
  if (params.linkURL && params.linkURL.startsWith('mailto:')) {
    emailTarget = decodeURIComponent(params.linkURL.replace('mailto:', '').split('?')[0])
  }
  if (!emailTarget && params.selectionText && EMAIL_RE.test(params.selectionText)) {
    var m = params.selectionText.match(EMAIL_RE)
    if (m) emailTarget = m[0]
  }
  if (emailTarget) {
    var email = emailTarget
    items.push({
      label: '\u2709  Knock this email: ' + email,
      click: function() {
        shell.openExternal('https://knockknock.email/compose?to=' + encodeURIComponent(email))
      }
    })
    items.push({ type: 'separator' })
  }

  // Selection
  if (params.selectionText && params.selectionText.trim()) {
    var sel     = params.selectionText
    var preview = sel.length > 24 ? sel.slice(0, 24) + '\u2026' : sel
    items.push({ label: 'Copy', click: function() { clipboard.writeText(sel) } })
    items.push({
      label: 'Search Threshold: \u201c' + preview + '\u201d',
      click: function() {
        if (mainWindow) mainWindow.webContents.send('ctx-search', sel)
      }
    })
    items.push({ type: 'separator' })
  }

  // Inspect
  items.push({
    label: 'Inspect Element',
    click: function() {
      if (mainWindow) mainWindow.webContents.send('ctx-inspect', params.x, params.y)
    }
  })

  if (items.length) {
    Menu.buildFromTemplate(items).popup({ window: mainWindow })
  }
})
