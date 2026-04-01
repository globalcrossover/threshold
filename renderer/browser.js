// Threshold Browser — Core Logic v0.2
// Global Crossover | Card Home Page

'use strict'

var HOME_URL   = 'threshold://home'
var SEARCH_URL = 'https://duckduckgo.com/?q='

// ── DOM ──────────────────────────────────────────────
var $contentArea  = document.getElementById('content-area')
var $homePage     = document.getElementById('home-page')
var $addressBar   = document.getElementById('address-bar')
var $securityIcon = document.getElementById('security-icon')
var $backBtn      = document.getElementById('back-btn')
var $forwardBtn   = document.getElementById('forward-btn')
var $reloadBtn    = document.getElementById('reload-btn')
var $homeBtn      = document.getElementById('home-btn')
var $homeSearch   = document.getElementById('home-search')

// ── State ────────────────────────────────────────────
var currentUrl    = HOME_URL
var currentView   = null  // the active webview element

// ── Helpers ──────────────────────────────────────────
function resolveUrl(raw) {
  var s = (raw || '').trim()
  if (!s) return HOME_URL
  if (s === 'threshold://home') return HOME_URL
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s
  if (/^[\w-]+\.[\w]{2,}/.test(s) && s.indexOf(' ') === -1) return 'https://' + s
  return SEARCH_URL + encodeURIComponent(s)
}

function isHome(url) {
  return !url || url === HOME_URL
}

// ── Show Home ─────────────────────────────────────────
function showHome() {
  currentUrl = HOME_URL
  // Hide all webviews
  var views = document.querySelectorAll('webview')
  for (var i = 0; i < views.length; i++) {
    views[i].classList.remove('active')
  }
  // Show home page
  $homePage.classList.add('visible')
  $addressBar.value = ''
  $addressBar.placeholder = 'Search or enter address…'
  setButtons(false, false)
  setSecurityIcon(null)
  currentView = null
}

// ── Navigate to URL ───────────────────────────────────
function navigate(raw) {
  var url = resolveUrl(raw)
  if (isHome(url)) { showHome(); return }

  currentUrl = url

  // Hide home page
  $homePage.classList.remove('visible')

  // Check if we already have a webview for this URL session
  // For simplicity in v0.2 — single webview, reuse it
  var wv = document.getElementById('main-webview')

  if (!wv) {
    wv = document.createElement('webview')
    wv.id = 'main-webview'
    wv.setAttribute('allowpopups', '')
    wv.setAttribute('webpreferences', 'contextIsolation=false')

    wv.addEventListener('did-navigate', function(e) {
      currentUrl = e.url
      $addressBar.value = e.url
      setSecurityIcon(e.url)
      setButtons(wv.canGoBack(), wv.canGoForward())
    })

    wv.addEventListener('did-navigate-in-page', function(e) {
      if (!e.isMainFrame) return
      currentUrl = e.url
      $addressBar.value = e.url
      setSecurityIcon(e.url)
      setButtons(wv.canGoBack(), wv.canGoForward())
    })

    wv.addEventListener('did-start-loading', function() {
      $reloadBtn.innerHTML = '&#10005;'
      $reloadBtn.title = 'Stop'
    })

    wv.addEventListener('did-stop-loading', function() {
      $reloadBtn.innerHTML = '&#8635;'
      $reloadBtn.title = 'Reload'
      setButtons(wv.canGoBack(), wv.canGoForward())
    })

    wv.addEventListener('new-window', function(e) {
      e.preventDefault()
      navigate(e.url)
    })

    $contentArea.appendChild(wv)
  }

  wv.src = url
  wv.classList.add('active')
  currentView = wv

  $addressBar.value = url
  setSecurityIcon(url)
  setButtons(false, false)
}

// ── Nav buttons ───────────────────────────────────────
function setButtons(back, forward) {
  $backBtn.disabled    = !back
  $forwardBtn.disabled = !forward
}

function setSecurityIcon(url) {
  if (!url || isHome(url)) {
    $securityIcon.innerHTML = ''
    return
  }
  if (url.startsWith('https://')) {
    $securityIcon.innerHTML = '&#128274;'
    $securityIcon.style.opacity = '0.5'
  } else {
    $securityIcon.innerHTML = '&#9888;'
    $securityIcon.style.opacity = '0.8'
  }
}

// ── Card clicks ───────────────────────────────────────
var cards = document.querySelectorAll('.brand-card')
for (var c = 0; c < cards.length; c++) {
  (function(card) {
    card.addEventListener('click', function() {
      var url = card.getAttribute('data-url')
      if (url) navigate(url)
    })
  })(cards[c])
}

// ── Address bar ───────────────────────────────────────
$addressBar.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    navigate($addressBar.value)
    $addressBar.blur()
  }
  if (e.key === 'Escape') {
    $addressBar.value = isHome(currentUrl) ? '' : currentUrl
    $addressBar.blur()
  }
})
$addressBar.addEventListener('focus', function() { $addressBar.select() })

// ── Home search ───────────────────────────────────────
$homeSearch.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var q = $homeSearch.value.trim()
    if (q) { navigate(q); $homeSearch.value = '' }
  }
})

// ── Nav button events ─────────────────────────────────
$backBtn.addEventListener('click', function() {
  if (currentView) currentView.goBack()
})

$forwardBtn.addEventListener('click', function() {
  if (currentView) currentView.goForward()
})

$reloadBtn.addEventListener('click', function() {
  if (!currentView || isHome(currentUrl)) return
  if ($reloadBtn.innerHTML.indexOf('10005') !== -1) {
    currentView.stop()
  } else {
    currentView.reload()
  }
})

$homeBtn.addEventListener('click', function() {
  showHome()
})

// ── Window controls (Windows/Linux) ───────────────────
var wcMin   = document.getElementById('wc-min')
var wcMax   = document.getElementById('wc-max')
var wcClose = document.getElementById('wc-close')

if (wcMin)   wcMin.addEventListener('click',   function() { window.threshold.minimize() })
if (wcMax)   wcMax.addEventListener('click',   function() { window.threshold.maximize() })
if (wcClose) wcClose.addEventListener('click', function() { window.threshold.close() })

// ── Keyboard shortcuts ────────────────────────────────
var isMac = window.threshold && window.threshold.platform === 'darwin'

document.addEventListener('keydown', function(e) {
  var mod = isMac ? e.metaKey : e.ctrlKey

  if (mod && e.key === 'l') {
    $addressBar.focus()
    $addressBar.select()
    e.preventDefault()
  }

  if (mod && e.key === 'r') {
    if (currentView && !isHome(currentUrl)) currentView.reload()
    e.preventDefault()
  }

  if (mod && (e.key === 'ArrowLeft' || e.key === '[')) {
    if (currentView) currentView.goBack()
    e.preventDefault()
  }

  if (mod && (e.key === 'ArrowRight' || e.key === ']')) {
    if (currentView) currentView.goForward()
    e.preventDefault()
  }

  // Escape goes home
  if (e.key === 'Escape' && !isHome(currentUrl)) {
    showHome()
  }
})

// ── Platform class ────────────────────────────────────
if (window.threshold && window.threshold.platform) {
  document.body.classList.add(window.threshold.platform)
}

// ── Init ──────────────────────────────────────────────
showHome()
