// Threshold Browser v0.3
// Global Crossover

'use strict'

var SEARCH_URL = 'https://duckduckgo.com/?q='
var HOME       = 'threshold://home'
var BM_KEY     = 'threshold_bookmarks_v1'

// ── DOM ──────────────────────────────────────────────
var $shell        = document.getElementById('shell')
var $contentArea  = document.getElementById('content-area')
var $homePage     = document.getElementById('home-page')
var $addressBar   = document.getElementById('address-bar')
var $securityIcon = document.getElementById('security-icon')
var $backBtn      = document.getElementById('back-btn')
var $forwardBtn   = document.getElementById('forward-btn')
var $reloadBtn    = document.getElementById('reload-btn')
var $homeBtn      = document.getElementById('home-btn')
var $bookmarkBtn  = document.getElementById('bookmark-btn')
var $homeSearch   = document.getElementById('home-search')
var $bmList       = document.getElementById('bookmarks-list')
var $addBmBtn     = document.getElementById('add-bookmark-btn')

// ── State ─────────────────────────────────────────────
var currentUrl  = HOME
var currentView = null
var bookmarks   = []

// ── Bookmarks ─────────────────────────────────────────
function loadBookmarks() {
  try {
    var raw = localStorage.getItem(BM_KEY)
    if (raw) bookmarks = JSON.parse(raw)
  } catch(e) {
    bookmarks = getDefaultBookmarks()
  }
  if (!bookmarks || bookmarks.length === 0) {
    bookmarks = getDefaultBookmarks()
    saveBookmarks()
  }
  renderBookmarks()
}

function getDefaultBookmarks() {
  return [
    { type: 'folder', name: 'Work',     icon: '📁' },
    { type: 'folder', name: 'Research', icon: '📁' },
    { type: 'link',   name: 'The Quran',  url: 'https://themajesticreading.com', icon: '🔗' },
    { type: 'link',   name: 'GC Admin',   url: 'https://globalcrossover.com/admin', icon: '🔗' },
    { type: 'link',   name: 'Make A Vid', url: 'https://makeavid.com', icon: '🔗' },
  ]
}

function saveBookmarks() {
  try { localStorage.setItem(BM_KEY, JSON.stringify(bookmarks)) } catch(e) {}
}

function renderBookmarks() {
  $bmList.innerHTML = ''
  for (var i = 0; i < bookmarks.length; i++) {
    (function(bm, idx) {
      var el = document.createElement('div')
      el.className = 'bookmark-item'
      el.innerHTML = '<span class="bm-icon">' + bm.icon + '</span><span>' + bm.name + '</span>'
      if (bm.type === 'link' && bm.url) {
        el.addEventListener('click', function() { navigate(bm.url) })
      }
      $bmList.appendChild(el)
    })(bookmarks[i], i)
  }
}

function addBookmark(name, url) {
  bookmarks.push({ type: 'link', name: name, url: url, icon: '🔗' })
  saveBookmarks()
  renderBookmarks()
}

// ── Bookmark Modal ─────────────────────────────────────
function openBookmarkModal(prefillUrl, prefillName) {
  var existing = document.getElementById('bm-modal-bg')
  if (existing) existing.parentNode.removeChild(existing)

  var bg = document.createElement('div')
  bg.id = 'bm-modal-bg'
  bg.className = 'open'

  bg.innerHTML = '<div id="bm-modal">' +
    '<h3>Save Bookmark</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Name" value="' + (prefillName || '') + '" />' +
    '<input id="bm-url-input" type="text" placeholder="URL" value="' + (prefillUrl || '') + '" />' +
    '<div id="bm-modal-btns">' +
    '<button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Save</button>' +
    '</div></div>'

  document.body.appendChild(bg)

  bg.addEventListener('click', function(e) {
    if (e.target === bg) closeBmModal()
  })

  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)

  document.getElementById('bm-save').addEventListener('click', function() {
    var name = document.getElementById('bm-name-input').value.trim()
    var url  = document.getElementById('bm-url-input').value.trim()
    if (name && url) {
      addBookmark(name, url)
      closeBmModal()
    }
  })

  setTimeout(function() {
    var inp = document.getElementById('bm-name-input')
    if (inp) inp.focus()
  }, 50)
}

function closeBmModal() {
  var el = document.getElementById('bm-modal-bg')
  if (el) el.parentNode.removeChild(el)
}

// ── Navigation ─────────────────────────────────────────
function resolveUrl(raw) {
  var s = (raw || '').trim()
  if (!s || s === HOME) return HOME
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s
  if (/^[\w-]+\.[\w]{2,}/.test(s) && s.indexOf(' ') === -1) return 'https://' + s
  return SEARCH_URL + encodeURIComponent(s)
}

function isHome(url) { return !url || url === HOME }

function showHome() {
  currentUrl = HOME
  var views = document.querySelectorAll('webview')
  for (var i = 0; i < views.length; i++) views[i].classList.remove('active')
  $homePage.classList.add('visible')
  $addressBar.value = ''
  $addressBar.placeholder = 'Search or enter address\u2026'
  setButtons(false, false)
  setSecurityIcon(null)
  currentView = null
}

function navigate(raw) {
  var url = resolveUrl(raw)
  if (isHome(url)) { showHome(); return }

  currentUrl = url
  $homePage.classList.remove('visible')

  var wv = document.getElementById('main-webview')
  if (!wv) {
    wv = document.createElement('webview')
    wv.id = 'main-webview'
    wv.setAttribute('allowpopups', '')

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

    wv.addEventListener('page-title-updated', function(e) {
      // store title for bookmark use
      wv._pageTitle = e.title
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

function setButtons(back, forward) {
  $backBtn.disabled    = !back
  $forwardBtn.disabled = !forward
}

function setSecurityIcon(url) {
  if (!url || isHome(url)) { $securityIcon.innerHTML = ''; return }
  if (url.startsWith('https://')) {
    $securityIcon.innerHTML = '&#128274;'
    $securityIcon.style.opacity = '0.6'
  } else {
    $securityIcon.innerHTML = '&#9888;'
    $securityIcon.style.opacity = '0.9'
  }
}

// ── Card Clicks ────────────────────────────────────────
var cards = document.querySelectorAll('.brand-card')
for (var c = 0; c < cards.length; c++) {
  (function(card) {
    card.addEventListener('click', function() {
      var url = card.getAttribute('data-url')
      if (url) navigate(url)
    })
  })(cards[c])
}

// ── Address Bar ────────────────────────────────────────
$addressBar.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { navigate($addressBar.value); $addressBar.blur() }
  if (e.key === 'Escape') { $addressBar.value = isHome(currentUrl) ? '' : currentUrl; $addressBar.blur() }
})
$addressBar.addEventListener('focus', function() { $addressBar.select() })

// ── Home Search ────────────────────────────────────────
$homeSearch.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var q = $homeSearch.value.trim()
    if (q) { navigate(q); $homeSearch.value = '' }
  }
})

// ── Nav Buttons ────────────────────────────────────────
$backBtn.addEventListener('click', function() { if (currentView) currentView.goBack() })
$forwardBtn.addEventListener('click', function() { if (currentView) currentView.goForward() })
$reloadBtn.addEventListener('click', function() {
  if (!currentView || isHome(currentUrl)) return
  if ($reloadBtn.innerHTML.indexOf('10005') !== -1) {
    currentView.stop()
  } else {
    currentView.reload()
  }
})
$homeBtn.addEventListener('click', function() { showHome() })

// ── Bookmark Button ────────────────────────────────────
$bookmarkBtn.addEventListener('click', function() {
  var url   = isHome(currentUrl) ? '' : currentUrl
  var title = (currentView && currentView._pageTitle) ? currentView._pageTitle : ''
  openBookmarkModal(url, title)
})

$addBmBtn.addEventListener('click', function() {
  openBookmarkModal('', '')
})

// ── Window Controls ────────────────────────────────────
var wcMin   = document.getElementById('wc-min')
var wcMax   = document.getElementById('wc-max')
var wcClose = document.getElementById('wc-close')
if (wcMin)   wcMin.addEventListener('click',   function() { if(window.threshold) window.threshold.minimize() })
if (wcMax)   wcMax.addEventListener('click',   function() { if(window.threshold) window.threshold.maximize() })
if (wcClose) wcClose.addEventListener('click', function() { if(window.threshold) window.threshold.close() })

// ── Keyboard Shortcuts ─────────────────────────────────
var isMac = window.threshold && window.threshold.platform === 'darwin'
document.addEventListener('keydown', function(e) {
  var mod = isMac ? e.metaKey : e.ctrlKey
  if (mod && e.key === 'l') { $addressBar.focus(); $addressBar.select(); e.preventDefault() }
  if (mod && e.key === 'r') { if (currentView && !isHome(currentUrl)) currentView.reload(); e.preventDefault() }
  if (mod && e.key === 'd') { $bookmarkBtn.click(); e.preventDefault() }
  if (mod && (e.key === 'ArrowLeft'  || e.key === '[')) { if (currentView) currentView.goBack();    e.preventDefault() }
  if (mod && (e.key === 'ArrowRight' || e.key === ']')) { if (currentView) currentView.goForward(); e.preventDefault() }
  if (e.key === 'Escape' && !isHome(currentUrl)) { showHome() }
})

// ── Platform Class ─────────────────────────────────────
if (window.threshold && window.threshold.platform) {
  document.body.classList.add(window.threshold.platform)
}

// ── Init ───────────────────────────────────────────────
loadBookmarks()
showHome()
