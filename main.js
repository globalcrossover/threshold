// Threshold — Main Process
// Global Crossover | v0.1
// Features: Ad Blocker, Email Tracker Blocker, Built-in Search

'use strict'

const { app, BrowserWindow, ipcMain, shell, session } = require('electron')
const path = require('path')

// ── Search Engine Config ─────────────────────────────
// Change SEARCH_ENGINE below to switch the default for the whole browser
const SEARCH_ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave:      'https://search.brave.com/search?q=',
  google:     'https://www.google.com/search?q=',
  bing:       'https://www.bing.com/search?q=',
  ecosia:     'https://www.ecosia.org/search?q=',
}
const SEARCH_ENGINE = 'duckduckgo' // ← change to 'google', 'brave' etc.

// ── Ad Block — Known Ad & Tracking Networks ───────────
// Requests to these domains are cancelled before the page loads them.
const AD_BLOCK_PATTERNS = [
  /doubleclick\.net/,
  /googlesyndication\.com/,
  /googleadservices\.com/,
  /googletagservices\.com/,
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /adservice\.google\./,
  /pagead2\.googlesyndication\.com/,
  /amazon-adsystem\.com/,
  /ads\.amazon\.com/,
  /advertising\.com/,
  /adtech\.de/,
  /adblade\.com/,
  /adcolony\.com/,
  /adform\.net/,
  /adnxs\.com/,
  /adsrvr\.org/,
  /adtechus\.com/,
  /adzerk\.net/,
  /bidswitch\.net/,
  /casalemedia\.com/,
  /contextweb\.com/,
  /criteo\.com/,
  /criteo\.net/,
  /demdex\.net/,
  /districtm\.ca/,
  /dotomi\.com/,
  /exelator\.com/,
  /eyeota\.net/,
  /flashtalking\.com/,
  /freewheel\.tv/,
  /gumgum\.com/,
  /id5-sync\.com/,
  /indexexchange\.com/,
  /lijit\.com/,
  /liveintent\.com/,
  /liveramp\.com/,
  /lotame\.com/,
  /nexac\.com/,
  /openx\.net/,
  /outbrain\.com/,
  /pubmatic\.com/,
  /quantserve\.com/,
  /rfihub\.net/,
  /rubiconproject\.com/,
  /scorecardresearch\.com/,
  /sharethrough\.com/,
  /smaato\.net/,
  /spotxchange\.com/,
  /taboola\.com/,
  /tapad\.com/,
  /tribalfusion\.com/,
  /turn\.com/,
  /undertone\.com/,
  /yieldbot\.com/,
  /yieldmo\.com/,
  /zergnet\.com/,
  // Fingerprinting & cross-site tracking
  /agkn\.com/,
  /bluekai\.com/,
  /bounceexchange\.com/,
  /hotjar\.com/,
  /inspectlet\.com/,
  /mathtag\.com/,
  /mouseflow\.com/,
  /parsely\.com/,
  /permutive\.com/,
  /segment\.com/,
  /segment\.io/,
  /statcounter\.com/,
]

// ── Email Tracker Block ───────────────────────────────
// Pixel trackers in emails fire read receipts without your knowledge.
const EMAIL_TRACKER_PATTERNS = [
  /sendgrid\.net\/wf\/open/,
  /sendgrid\.net\/trk/,
  /mailchimp\.com\/track/,
  /list-manage\.com\/track/,
  /mandrillapp\.com\/track/,
  /mailgun\.net\/track/,
  /mailgun\.org\/track/,
  /hubspot\.com\/track/,
  /hs-analytics\.net/,
  /marketo\.net\/trk/,
  /eloqua\.com\/e\/f/,
  /pardot\.com\/l\/\d/,
  /constantcontact\.com\/track/,
  /campaignmonitor\.com\/track/,
  /createsend\.com\/track/,
  /klaviyo\.com\/open/,
  /drip\.com\/track/,
  /convertkit\.com\/track/,
  /activecampaign\.com\/track/,
  /mailerlite\.com\/track/,
  /sendinblue\.com\/track/,
  /brevo\.com\/track/,
  /aweber\.com\/track/,
  /getresponse\.com\/track/,
  /intercom-mail\.com/,
  /intercom\.io\/e\//,
  /customer\.io\/e\//,
  /sailthru\.com\/track/,
  /exacttarget\.com\/track/,
  /mktoresp\.com/,
  /mktdns\.net/,
  /trk\.email/,
  /opens\.re/,
  /t\.dripemail/,
  /s\.mlsend\.com/,
  /tracking\.postmark/,
  /beehiiv\.com\/track/,
  /substack\.com\/track/,
]

const ALL_BLOCKED = [...AD_BLOCK_PATTERNS, ...EMAIL_TRACKER_PATTERNS]

// ── Blocker Setup ─────────────────────────────────────
function setupBlocker(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const url = details.url

    // Never block our own app files or localhost
    if (
      url.startsWith('file://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost')
    ) {
      return callback({ cancel: false })
    }

    const blocked = ALL_BLOCKED.some(pattern => pattern.test(url))
    callback({ cancel: blocked })
  })
}

// ── Window ────────────────────────────────────────────
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#080b12',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 12 },
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.setMenuBarVisibility(false)
  mainWindow.on('closed', () => { mainWindow = null })
}

// ── App Init ──────────────────────────────────────────
app.whenReady().then(() => {
  setupBlocker(session.defaultSession)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

// ── IPC ───────────────────────────────────────────────
ipcMain.on('open-external',   (_, url) => shell.openExternal(url))
ipcMain.on('window-minimize', ()       => mainWindow?.minimize())
ipcMain.on('window-maximize', ()       => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window-close',    ()       => mainWindow?.close())

// Send search config to renderer so browser.js can use the correct engine
ipcMain.handle('get-search-config', () => ({
  engines: SEARCH_ENGINES,
  active:  SEARCH_ENGINE,
  url:     SEARCH_ENGINES[SEARCH_ENGINE],
}))
