// Threshold Browser v1.1 — Tab Manager
// Global Crossover

'use strict'

var SEARCH_URL = 'https://duckduckgo.com/?q='
var HOME       = 'threshold://home'
var BM_KEY     = 'threshold_bookmarks_v1'

var $contentArea   = document.getElementById('content-area')
var $tabsContainer = document.getElementById('tabs-container')
var $newTabBtn     = document.getElementById('new-tab-btn')
var $addressBar    = document.getElementById('address-bar')
var $securityIcon  = document.getElementById('security-icon')
var $backBtn       = document.getElementById('back-btn')
var $forwardBtn    = document.getElementById('forward-btn')
var $reloadBtn     = document.getElementById('reload-btn')
var $homeBtn       = document.getElementById('home-btn')
var $bookmarkBtn   = document.getElementById('bookmark-btn')

var tabs      = []
var activeId  = null
var tabSeq    = 0
var bookmarks = []

function uid() { return 'tab_' + (++tabSeq) }
function getTab(id) { for (var i=0;i<tabs.length;i++) { if (tabs[i].id===id) return tabs[i] } return null }

function resolveUrl(raw) {
  var s = (raw || '').trim()
  if (!s || s === HOME) return HOME
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s
  if (/^[\w-]+\.[\w]{2,}/.test(s) && s.indexOf(' ') === -1) return 'https://' + s
  return SEARCH_URL + encodeURIComponent(s)
}

function isHome(url) { return !url || url === HOME }

function createTab(url, activate) {
  var id       = uid()
  var resolved = resolveUrl(url || HOME)

  var tpl      = document.getElementById('home-page-template').children[0]
  var homePage = tpl.cloneNode(true)
  homePage.classList.remove('active')
  $contentArea.appendChild(homePage)

  var cards = homePage.querySelectorAll('.brand-card')
  for (var c = 0; c < cards.length; c++) {
    (function(card) {
      card.addEventListener('click', function() {
        var u = card.getAttribute('data-url')
        if (u) navigateTab(id, u)
      })
    })(cards[c])
  }

  var hs = homePage.querySelector('.home-search')
  hs.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var q = hs.value.trim()
      if (q) { navigateTab(id, q); hs.value = '' }
    }
  })

  var addBmBtn = homePage.querySelector('.add-bookmark-btn')
  addBmBtn.addEventListener('click', function() { openBookmarkModal('', '') })

  renderBookmarksInHome(homePage)

  var tab = { id: id, url: resolved, title: 'New Tab', favicon: null, loading: false, webview: null, homePage: homePage }
  tabs.push(tab)

  if (!isHome(resolved)) createWebview(tab)
  if (activate !== false) activateTab(id)
  renderTabBar()
  return id
}

function createWebview(tab) {
  var wv = document.createElement('webview')
  wv.id  = 'wv_' + tab.id
  wv.src = tab.url
  wv.setAttribute('allowpopups', '')

  wv.addEventListener('did-start-loading', function() {
    tab.loading = true
    if (activeId === tab.id) $reloadBtn.innerHTML = '&#10005;'
    renderTabBar()
  })

  wv.addEventListener('did-stop-loading', function() {
    tab.loading = false
    if (activeId === tab.id) {
      $reloadBtn.innerHTML = '&#8635;'
      setButtons(wv.canGoBack(), wv.canGoForward())
    }
    renderTabBar()
  })

  wv.addEventListener('did-navigate', function(e) {
    tab.url = e.url
    if (activeId === tab.id) {
      $addressBar.value = e.url
      setSecurityIcon(e.url)
      setButtons(wv.canGoBack(), wv.canGoForward())
    }
    renderTabBar()
  })

  wv.addEventListener('did-navigate-in-page', function(e) {
    if (!e.isMainFrame) return
    tab.url = e.url
    if (activeId === tab.id) {
      $addressBar.value = e.url
      setSecurityIcon(e.url)
    }
  })

  wv.addEventListener('page-title-updated', function(e) {
    tab.title = e.title || domain(tab.url)
    renderTabBar()
  })

  wv.addEventListener('page-favicon-updated', function(e) {
    if (e.favicons && e.favicons[0]) {
      tab.favicon = e.favicons[0]
      renderTabBar()
    }
  })

  wv.addEventListener('new-window', function(e) {
    e.preventDefault()
    createTab(e.url, true)
  })

  $contentArea.appendChild(wv)
  tab.webview = wv
  return wv
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch(e) { return url }
}

function activateTab(id) {
  activeId = id
  var tab  = getTab(id)
  if (!tab) return

  var views = document.querySelectorAll('webview')
  for (var i = 0; i < views.length; i++) views[i].classList.remove('active')
  var homes = document.querySelectorAll('.home-page')
  for (var j = 0; j < homes.length; j++) homes[j].classList.remove('active')

  if (isHome(tab.url)) {
    tab.homePage.classList.add('active')
    $addressBar.value = ''
    $addressBar.placeholder = 'Search or enter address\u2026'
    setButtons(false, false)
    setSecurityIcon(null)
  } else {
    if (tab.webview) tab.webview.classList.add('active')
    $addressBar.value = tab.url
    setSecurityIcon(tab.url)
    if (tab.webview) setButtons(tab.webview.canGoBack(), tab.webview.canGoForward())
  }

  $reloadBtn.innerHTML = tab.loading ? '&#10005;' : '&#8635;'
  renderTabBar()
}

function navigateTab(id, raw) {
  var tab = getTab(id)
  if (!tab) return
  var url = resolveUrl(raw)

  if (isHome(url)) {
    tab.url     = HOME
    tab.title   = 'New Tab'
    tab.favicon = null
    if (tab.webview) tab.webview.classList.remove('active')
    tab.homePage.classList.add('active')
    if (id === activeId) {
      $addressBar.value = ''
      setButtons(false, false)
      setSecurityIcon(null)
    }
    renderTabBar()
    return
  }

  tab.url = url
  tab.homePage.classList.remove('active')

  if (!tab.webview) {
    createWebview(tab)
  } else {
    tab.webview.src = url
  }

  if (id === activeId) {
    tab.webview.classList.add('active')
    $addressBar.value = url
    setSecurityIcon(url)
    setButtons(false, false)
  }
}

function closeTab(id) {
  if (tabs.length === 1) {
    var newId = createTab(HOME, false)
    activateTab(newId)
    cleanupTab(id)
    tabs.splice(0, 1)
    renderTabBar()
    return
  }

  var idx = -1
  for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) { idx = i; break; } }
  if (idx === -1) return

  var wasActive = (activeId === id)
  cleanupTab(id)
  tabs.splice(idx, 1)

  if (wasActive) {
    var next = tabs[Math.min(idx, tabs.length - 1)]
    if (next) activateTab(next.id)
  }
  renderTabBar()
}

function cleanupTab(id) {
  var tab = getTab(id)
  if (!tab) return
  if (tab.webview && tab.webview.parentNode) tab.webview.parentNode.removeChild(tab.webview)
  if (tab.homePage && tab.homePage.parentNode) tab.homePage.parentNode.removeChild(tab.homePage)
}

function renderTabBar() {
  $tabsContainer.innerHTML = ''

  for (var i = 0; i < tabs.length; i++) {
    (function(t) {
      var el = document.createElement('div')
      el.className = 'tab' + (t.id === activeId ? ' active' : '') + (t.loading ? ' loading' : '')

      var fav = document.createElement('img')
      fav.className = 'tab-favicon' + (t.favicon ? '' : ' hidden')
      if (t.favicon) {
        fav.src = t.favicon
        fav.onerror = function() { fav.classList.add('hidden') }
      }

      var ttl = document.createElement('span')
      ttl.className   = 'tab-title'
      ttl.textContent = t.loading ? 'Loading\u2026' : (t.title || domain(t.url) || 'New Tab')

      var cls = document.createElement('button')
      cls.className = 'tab-close'
      cls.innerHTML = '&#10005;'
      cls.addEventListener('click', function(e) { e.stopPropagation(); closeTab(t.id) })

      el.appendChild(fav)
      el.appendChild(ttl)
      el.appendChild(cls)
      el.addEventListener('click', function() { activateTab(t.id) })

      $tabsContainer.appendChild(el)
    })(tabs[i])
  }
}

function setButtons(back, forward) {
  $backBtn.disabled    = !back
  $forwardBtn.disabled = !forward
}

function setSecurityIcon(url) {
  if (!url || isHome(url)) { $securityIcon.innerHTML = ''; return }
  $securityIcon.innerHTML    = url.startsWith('https://') ? '&#128274;' : '&#9888;'
  $securityIcon.style.opacity = url.startsWith('https://') ? '0.6' : '0.9'
}

function loadBookmarks() {
  try {
    var raw = localStorage.getItem(BM_KEY)
    if (raw) bookmarks = JSON.parse(raw)
  } catch(e) { bookmarks = [] }
  if (!bookmarks || bookmarks.length === 0) {
    bookmarks = [
      { type:'folder', name:'Work',       icon:'\uD83D\uDCC1' },
      { type:'folder', name:'Research',   icon:'\uD83D\uDCC1' },
      { type:'link',   name:'The Quran',  url:'https://themajesticreading.com',      icon:'\uD83D\uDD17' },
      { type:'link',   name:'GC Admin',   url:'https://globalcrossover.com/admin',   icon:'\uD83D\uDD17' },
      { type:'link',   name:'Make A Vid', url:'https://makeavid.com',                icon:'\uD83D\uDD17' },
    ]
    saveBookmarks()
  }
}

function saveBookmarks() {
  try { localStorage.setItem(BM_KEY, JSON.stringify(bookmarks)) } catch(e) {}
}

function renderBookmarksInHome(homePage) {
  var list = homePage.querySelector('.bookmarks-list')
  if (!list) return
  list.innerHTML = ''
  for (var i = 0; i < bookmarks.length; i++) {
    (function(bm) {
      var el = document.createElement('div')
      el.className = 'bookmark-item'
      el.innerHTML = '<span class="bm-icon">' + bm.icon + '</span><span>' + bm.name + '</span>'
      if (bm.type === 'link' && bm.url) {
        (function(url) {
          el.addEventListener('click', function() {
            var tab = getTab(activeId)
            if (tab) navigateTab(tab.id, url)
          })
        })(bm.url)
      }
      list.appendChild(el)
    })(bookmarks[i])
  }
}

function renderAllHomeBookmarks() {
  var homes = document.querySelectorAll('.home-page')
  for (var i = 0; i < homes.length; i++) renderBookmarksInHome(homes[i])
}

function addBookmark(name, url) {
  bookmarks.push({ type:'link', name:name, url:url, icon:'\uD83D\uDD17' })
  saveBookmarks()
  renderAllHomeBookmarks()
}

function openBookmarkModal(prefillUrl, prefillName) {
  var existing = document.getElementById('bm-modal-bg')
  if (existing) existing.parentNode.removeChild(existing)

  var bg = document.createElement('div')
  bg.id = 'bm-modal-bg'
  bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal">' +
    '<h3>Save Bookmark</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Name" value="' + (prefillName || '') + '" />' +
    '<input id="bm-url-input" type="text" placeholder="https://" value="' + (prefillUrl || '') + '" />' +
    '<div id="bm-modal-btns">' +
    '<button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Save</button>' +
    '</div></div>'

  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var n = document.getElementById('bm-name-input').value.trim()
    var u = document.getElementById('bm-url-input').value.trim()
    if (n && u) { addBookmark(n, u); closeBmModal() }
  })
  setTimeout(function() { var inp = document.getElementById('bm-name-input'); if (inp) inp.focus() }, 50)
}

function closeBmModal() {
  var el = document.getElementById('bm-modal-bg')
  if (el) el.parentNode.removeChild(el)
}

$addressBar.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var tab = getTab(activeId)
    if (tab) navigateTab(tab.id, $addressBar.value)
    $addressBar.blur()
  }
  if (e.key === 'Escape') {
    var t = getTab(activeId)
    $addressBar.value = t && !isHome(t.url) ? t.url : ''
    $addressBar.blur()
  }
})
$addressBar.addEventListener('focus', function() { $addressBar.select() })

$backBtn.addEventListener('click', function() {
  var tab = getTab(activeId)
  if (tab && tab.webview) tab.webview.goBack()
})

$forwardBtn.addEventListener('click', function() {
  var tab = getTab(activeId)
  if (tab && tab.webview) tab.webview.goForward()
})

$reloadBtn.addEventListener('click', function() {
  var tab = getTab(activeId)
  if (!tab || isHome(tab.url)) return
  if (tab.loading && tab.webview) { tab.webview.stop() }
  else if (tab.webview) { tab.webview.reload() }
})

$homeBtn.addEventListener('click', function() {
  var tab = getTab(activeId)
  if (tab) navigateTab(tab.id, HOME)
})

$bookmarkBtn.addEventListener('click', function() {
  var tab   = getTab(activeId)
  var url   = (tab && !isHome(tab.url)) ? tab.url : ''
  var title = (tab && tab.title && tab.title !== 'New Tab') ? tab.title : ''
  openBookmarkModal(url, title)
})

$newTabBtn.addEventListener('click', function() { createTab(HOME, true) })

var wcMin = document.getElementById('wc-min')
var wcMax = document.getElementById('wc-max')
var wcCls = document.getElementById('wc-close')
if (wcMin) wcMin.addEventListener('click', function() { if(window.threshold) window.threshold.minimize() })
if (wcMax) wcMax.addEventListener('click', function() { if(window.threshold) window.threshold.maximize() })
if (wcCls) wcCls.addEventListener('click', function() { if(window.threshold) window.threshold.close() })

var isMac = window.threshold && window.threshold.platform === 'darwin'
document.addEventListener('keydown', function(e) {
  var mod = isMac ? e.metaKey : e.ctrlKey
  if (mod && e.key === 'l') { $addressBar.focus(); $addressBar.select(); e.preventDefault() }
  if (mod && e.key === 't') { createTab(HOME, true); e.preventDefault() }
  if (mod && e.key === 'w') { closeTab(activeId); e.preventDefault() }
  if (mod && e.key === 'r') { var t=getTab(activeId); if(t&&t.webview&&!isHome(t.url)) t.webview.reload(); e.preventDefault() }
  if (mod && e.key === 'd') { $bookmarkBtn.click(); e.preventDefault() }
  if (mod && (e.key === 'ArrowLeft'  || e.key === '[')) { var t2=getTab(activeId); if(t2&&t2.webview) t2.webview.goBack();    e.preventDefault() }
  if (mod && (e.key === 'ArrowRight' || e.key === ']')) { var t3=getTab(activeId); if(t3&&t3.webview) t3.webview.goForward(); e.preventDefault() }
  if (mod && e.key >= '1' && e.key <= '9') {
    var idx = parseInt(e.key) - 1
    if (tabs[idx]) { activateTab(tabs[idx].id); e.preventDefault() }
  }
})

if (window.threshold && window.threshold.platform) {
  document.body.classList.add(window.threshold.platform)
}

loadBookmarks()
createTab(HOME, true)
