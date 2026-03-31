// Threshold Browser — Core Logic
// Global Crossover | v0.1

'use strict'

// ── Config ────────────────────────────────────────────
const HOME_URL = 'https://knockknock.email'
const NEW_TAB  = 'threshold://newtab'

// Search engine URL — loaded from main.js config on init
let SEARCH_URL = 'https://duckduckgo.com/?q=' // default until loaded

const PINNED_TABS = [
  { title: 'Knock Knock',  url: 'https://knockknock.email' },
  { title: 'Seeface',      url: 'https://seeface.app'      },
  { title: 'Truth Net',    url: 'https://truthnet.news'    },
  { title: 'Sonify',       url: 'https://sonify.stream'    },
  { title: 'Mydo Games',   url: 'https://mydogames.com'    },
  { title: 'Make A Vid',   url: 'https://makeavid.com'     },
  { title: 'Oath Tracker', url: 'https://oathtracker.com'  },
  { title: 'Claude',       url: 'https://claude.ai'        },
]

// ── State ─────────────────────────────────────────────
let tabs      = []   // { id, url, title, favicon, pinned, loading }
let activeId  = null
let tabSeq    = 0

// ── DOM References ────────────────────────────────────
const $tabsContainer = document.getElementById('tabs-container')
const $contentArea   = document.getElementById('content-area')
const $newTabPage    = document.getElementById('new-tab-page')
const $addressBar    = document.getElementById('address-bar')
const $securityIcon  = document.getElementById('security-icon')
const $backBtn       = document.getElementById('back-btn')
const $forwardBtn    = document.getElementById('forward-btn')
const $reloadBtn     = document.getElementById('reload-btn')
const $homeBtn       = document.getElementById('home-btn')
const $newTabBtn     = document.getElementById('new-tab-btn')
const $ntSearch      = document.getElementById('nt-search')

// ── Helpers ───────────────────────────────────────────
function uid()         { return 'tab_' + (++tabSeq) }
function tab(id)       { return tabs.find(t => t.id === id) }
function webview(id)   { return document.getElementById('wv_' + id) }
function isNewTab(url) { return !url || url === NEW_TAB }

function resolveUrl(raw) {
  const s = (raw || '').trim()
  if (!s) return null
  if (isNewTab(s)) return NEW_TAB
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s
  // Looks like a domain
  if (/^[\w-]+\.[\w]{2,}/.test(s) && !s.includes(' ')) return 'https://' + s
  // Search
  return SEARCH_URL + encodeURIComponent(s)
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

// ── Tab Creation ──────────────────────────────────────
function createTab(url, pinned = false, title = '') {
  const id  = uid()
  const resolved = resolveUrl(url) || NEW_TAB
  const t = { id, url: resolved, title: title || (isNewTab(resolved) ? 'New Tab' : domain(resolved)), favicon: null, pinned, loading: false }
  tabs.push(t)

  if (!isNewTab(resolved)) {
    // Build webview
    const wv = document.createElement('webview')
    wv.id  = 'wv_' + id
    wv.src = resolved
    wv.setAttribute('allowpopups', '')

    // Events
    wv.addEventListener('did-start-loading', () => {
      patch(id, { loading: true })
    })

    wv.addEventListener('did-stop-loading', () => {
      patch(id, { loading: false })
    })

    wv.addEventListener('did-navigate', e => {
      patch(id, { url: e.url })
      if (activeId === id) syncNav(id)
    })

    wv.addEventListener('did-navigate-in-page', e => {
      if (!e.isMainFrame) return
      patch(id, { url: e.url })
      if (activeId === id) syncNav(id)
    })

    wv.addEventListener('page-title-updated', e => {
      patch(id, { title: e.title || domain(t.url) })
    })

    wv.addEventListener('page-favicon-updated', e => {
      if (e.favicons?.[0]) patch(id, { favicon: e.favicons[0] })
    })

    wv.addEventListener('did-fail-load', e => {
      if (e.errorCode === -3) return  // navigation aborted — ignore
      patch(id, { loading: false, title: 'Page not found' })
    })

    // Allow new windows to open as new tabs
    wv.addEventListener('new-window', e => {
      e.preventDefault()
      openTab(e.url)
    })

    $contentArea.appendChild(wv)
  }

  return id
}

// ── Patch State ───────────────────────────────────────
function patch(id, updates) {
  const t = tab(id)
  if (!t) return
  Object.assign(t, updates)
  renderTabBar()
  if (activeId === id && updates.url) syncNav(id)
}

// ── Activate Tab ──────────────────────────────────────
function activateTab(id) {
  activeId = id
  const t = tab(id)

  // Show/hide webviews and new-tab page
  document.querySelectorAll('webview').forEach(wv => wv.classList.remove('visible'))
  $newTabPage.classList.remove('visible')

  if (isNewTab(t?.url)) {
    $newTabPage.classList.add('visible')
    $addressBar.value = ''
    setButtons(false, false)
    setSecurityIcon(null)
  } else {
    const wv = webview(id)
    if (wv) wv.classList.add('visible')
    syncNav(id)
  }

  renderTabBar()
}

// ── Sync Address Bar + Nav Buttons ────────────────────
function syncNav(id) {
  const t  = tab(id)
  const wv = webview(id)
  if (!t) return
  $addressBar.value = isNewTab(t.url) ? '' : t.url
  setButtons(wv?.canGoBack() || false, wv?.canGoForward() || false)
  setSecurityIcon(t.url)
}

function setButtons(back, forward) {
  $backBtn.disabled    = !back
  $forwardBtn.disabled = !forward
}

function setSecurityIcon(url) {
  if (!url || isNewTab(url)) {
    $securityIcon.textContent = ''
    $securityIcon.title = ''
    return
  }
  if (url.startsWith('https://')) {
    $securityIcon.textContent = '🔒'
    $securityIcon.title = 'Secure connection (HTTPS)'
    $securityIcon.style.opacity = '0.7'
  } else {
    $securityIcon.textContent = '⚠️'
    $securityIcon.title = 'Not secure'
    $securityIcon.style.opacity = '0.9'
  }
}

// ── Close Tab ─────────────────────────────────────────
function closeTab(id) {
  const t = tab(id)
  if (!t || t.pinned) return

  const idx = tabs.findIndex(x => x.id === id)
  tabs.splice(idx, 1)

  const wv = webview(id)
  if (wv) wv.remove()

  if (activeId === id) {
    const next = tabs[Math.min(idx, tabs.length - 1)]
    if (next) activateTab(next.id)
  }

  renderTabBar()
}

// ── Navigate Current Tab ──────────────────────────────
function navigate(raw) {
  const url = resolveUrl(raw)
  if (!url) return
  const t  = tab(activeId)
  const wv = webview(activeId)

  if (!t) return

  if (isNewTab(url)) {
    patch(activeId, { url: NEW_TAB, title: 'New Tab', favicon: null })
    activateTab(activeId)
    return
  }

  patch(activeId, { url, title: domain(url), favicon: null })

  if (wv) {
    wv.src = url
  } else {
    // Was a new tab page — now needs a webview
    const wvNew = document.createElement('webview')
    wvNew.id  = 'wv_' + activeId
    wvNew.src = url
    wvNew.setAttribute('allowpopups', '')
    attachWebviewEvents(wvNew, activeId)
    $contentArea.appendChild(wvNew)
    $newTabPage.classList.remove('visible')
    wvNew.classList.add('visible')
  }
}

function attachWebviewEvents(wv, id) {
  wv.addEventListener('did-start-loading', () => patch(id, { loading: true }))
  wv.addEventListener('did-stop-loading',  () => patch(id, { loading: false }))
  wv.addEventListener('did-navigate', e => { patch(id, { url: e.url }); if (activeId === id) syncNav(id) })
  wv.addEventListener('did-navigate-in-page', e => { if (!e.isMainFrame) return; patch(id, { url: e.url }); if (activeId === id) syncNav(id) })
  wv.addEventListener('page-title-updated',   e => patch(id, { title: e.title || domain(wv.src) }))
  wv.addEventListener('page-favicon-updated', e => { if (e.favicons?.[0]) patch(id, { favicon: e.favicons[0] }) })
  wv.addEventListener('new-window', e => { e.preventDefault(); openTab(e.url) })
}

function openTab(url) {
  const id = createTab(url)
  activateTab(id)
}

// ── Render Tab Bar ────────────────────────────────────
function renderTabBar() {
  $tabsContainer.innerHTML = ''

  tabs.forEach(t => {
    const el = document.createElement('div')
    el.className = [
      'tab',
      t.id === activeId ? 'active'  : '',
      t.pinned           ? 'pinned'  : '',
      t.loading          ? 'loading' : '',
    ].filter(Boolean).join(' ')

    // Favicon
    const fav = document.createElement('img')
    fav.className = 'tab-favicon'
    if (t.favicon) {
      fav.src     = t.favicon
      fav.onerror = () => fav.classList.add('hidden')
    } else {
      fav.classList.add('hidden')
    }

    // Title
    const ttl = document.createElement('span')
    ttl.className   = 'tab-title'
    ttl.textContent = t.loading ? 'Loading…' : (t.title || domain(t.url))

    // Close
    const cls = document.createElement('button')
    cls.className   = 'tab-close'
    cls.textContent = '✕'
    cls.addEventListener('click', e => { e.stopPropagation(); closeTab(t.id) })

    el.appendChild(fav)
    el.appendChild(ttl)
    el.appendChild(cls)
    el.addEventListener('click', () => activateTab(t.id))

    $tabsContainer.appendChild(el)
  })
}

// ── Event Listeners ───────────────────────────────────

// Address bar
$addressBar.addEventListener('keydown', e => {
  if (e.key === 'Enter')  { navigate($addressBar.value); $addressBar.blur() }
  if (e.key === 'Escape') { syncNav(activeId); $addressBar.blur() }
})
$addressBar.addEventListener('focus', () => $addressBar.select())

// New tab page search
$ntSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') { navigate($ntSearch.value); $ntSearch.value = '' }
})

// Nav buttons
$backBtn.addEventListener('click',   () => webview(activeId)?.goBack())
$forwardBtn.addEventListener('click',() => webview(activeId)?.goForward())
$reloadBtn.addEventListener('click', () => {
  const wv = webview(activeId)
  if (wv) wv.reload(); else activateTab(activeId)
})
$homeBtn.addEventListener('click', () => navigate(HOME_URL))

// New tab
$newTabBtn.addEventListener('click', () => {
  const id = createTab(NEW_TAB)
  activateTab(id)
  setTimeout(() => $ntSearch.focus(), 50)
})

// Win controls (Windows/Linux only)
document.getElementById('wc-min')?.addEventListener('click',   () => window.threshold.minimize())
document.getElementById('wc-max')?.addEventListener('click',   () => window.threshold.maximize())
document.getElementById('wc-close')?.addEventListener('click', () => window.threshold.close())

// Keyboard shortcuts
const isMac = window.threshold.platform === 'darwin'

document.addEventListener('keydown', e => {
  const mod = isMac ? e.metaKey : e.ctrlKey

  if (mod && e.key === 'l') { $addressBar.focus(); $addressBar.select(); e.preventDefault() }
  if (mod && e.key === 't') { const id = createTab(NEW_TAB); activateTab(id); setTimeout(() => $ntSearch.focus(), 50); e.preventDefault() }
  if (mod && e.key === 'w') { closeTab(activeId); e.preventDefault() }
  if (mod && e.key === 'r') { webview(activeId)?.reload(); e.preventDefault() }
  if (mod && e.shiftKey && e.key === 'R') { webview(activeId)?.reloadIgnoringCache(); e.preventDefault() }
  if (mod && (e.key === 'ArrowLeft'  || e.key === '[')) { webview(activeId)?.goBack();    e.preventDefault() }
  if (mod && (e.key === 'ArrowRight' || e.key === ']')) { webview(activeId)?.goForward(); e.preventDefault() }

  // Cmd+1 through Cmd+8 — jump to pinned tab
  if (mod && e.key >= '1' && e.key <= '8') {
    const idx = parseInt(e.key) - 1
    if (tabs[idx]) { activateTab(tabs[idx].id); e.preventDefault() }
  }
})

// ── Platform Class ────────────────────────────────────
document.body.classList.add(window.threshold.platform || 'unknown')

// ── Init ──────────────────────────────────────────────
async function init() {
  // Load search engine config from main.js
  try {
    const config = await window.threshold.getSearchConfig()
    SEARCH_URL = config.url || SEARCH_URL
  } catch (e) {
    console.warn('Could not load search config, using default:', e)
  }

  PINNED_TABS.forEach(p => createTab(p.url, true, p.title))
  if (tabs.length > 0) activateTab(tabs[0].id)
  renderTabBar()
}

init()
