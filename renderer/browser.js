// Threshold Browser v1.2 — Tab Manager + Bookmarks
// Global Crossover

'use strict'

var SEARCH_URL = 'https://duckduckgo.com/?q='
var HOME       = 'threshold://home'
var BM_KEY     = 'threshold_bookmarks_v2'

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

// ── Utilities ──

function bmUid() { return 'bm_' + Date.now() + '_' + Math.floor(Math.random() * 9999) }

function getTab(id) {
  for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) return tabs[i] }
  return null
}

function resolveUrl(raw) {
  var s = (raw || '').trim()
  if (!s || s === HOME) return HOME
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s
  if (/^[\w-]+\.[\w]{2,}/.test(s) && s.indexOf(' ') === -1) return 'https://' + s
  return SEARCH_URL + encodeURIComponent(s)
}

function isHome(url) { return !url || url === HOME }

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch(e) { return url }
}

// ── Bookmark Data ──

function loadBookmarks() {
  try {
    var raw = localStorage.getItem(BM_KEY)
    if (raw) { bookmarks = JSON.parse(raw); return }

    // Migrate from old v1 format if present
    var oldRaw = localStorage.getItem('threshold_bookmarks_v1')
    if (oldRaw) {
      var old = JSON.parse(oldRaw)
      bookmarks = migrateOldBookmarks(old)
      saveBookmarks()
      return
    }
  } catch(e) {}

  bookmarks = getDefaultBookmarks()
  saveBookmarks()
}

function migrateOldBookmarks(old) {
  var result = []
  for (var i = 0; i < old.length; i++) {
    var item = old[i]
    if (item.type === 'folder') {
      result.push({ id: bmUid(), type: 'folder', name: item.name, open: false, links: [] })
    } else if (item.type === 'link' && item.url) {
      result.push({ id: bmUid(), type: 'link', name: item.name, url: item.url })
    }
  }
  return result
}

function getDefaultBookmarks() {
  return [
    { id: 'df1', type: 'folder', name: 'Islamic', open: false, links: [
      { id: 'df1l1', type: 'link', name: 'The Quran', url: 'https://www.themajesticreading.com/read' },
      { id: 'df1l2', type: 'link', name: 'The Quran Network', url: 'https://thequrannetwork.com' }
    ]},
    { id: 'df2', type: 'folder', name: 'Work', open: false, links: [
      { id: 'df2l1', type: 'link', name: 'GC Admin', url: 'https://globalcrossover.com/admin' },
      { id: 'df2l2', type: 'link', name: 'Make A Vid', url: 'https://makeavid.com' }
    ]},
    { id: 'df3', type: 'folder', name: 'Research', open: false, links: [] }
  ]
}

function saveBookmarks() {
  try { localStorage.setItem(BM_KEY, JSON.stringify(bookmarks)) } catch(e) {}
}

function findFolder(id) {
  for (var i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].id === id && bookmarks[i].type === 'folder') return bookmarks[i]
  }
  return null
}

function addFolder(name) {
  bookmarks.push({ id: bmUid(), type: 'folder', name: name, open: true, links: [] })
  saveBookmarks()
  renderAllBookmarkViews()
}

function addLinkToFolder(folderId, name, url) {
  var folder = findFolder(folderId)
  if (folder) { folder.links.push({ id: bmUid(), type: 'link', name: name, url: url }) }
  saveBookmarks()
  renderAllBookmarkViews()
}

function addTopLevelLink(name, url) {
  bookmarks.push({ id: bmUid(), type: 'link', name: name, url: url })
  saveBookmarks()
  renderAllBookmarkViews()
}

function deleteBookmark(id) {
  for (var i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].id === id) { bookmarks.splice(i, 1); break }
  }
  saveBookmarks()
  renderAllBookmarkViews()
}

function deleteLinkFromFolder(folderId, linkId) {
  var folder = findFolder(folderId)
  if (folder) {
    for (var i = 0; i < folder.links.length; i++) {
      if (folder.links[i].id === linkId) { folder.links.splice(i, 1); break }
    }
  }
  saveBookmarks()
  renderAllBookmarkViews()
}

function toggleFolderOpen(id) {
  var folder = findFolder(id)
  if (folder) { folder.open = !folder.open }
  saveBookmarks()
  renderAllBookmarkViews()
}

// ── Bookmark View Rendering ──

function renderBookmarksView(homePage) {
  var container = homePage.querySelector('.bookmarks-view')
  if (!container) return
  container.innerHTML = ''

  // Toolbar
  var toolbar = document.createElement('div')
  toolbar.className = 'bm-toolbar'

  var addFolderBtn = document.createElement('button')
  addFolderBtn.className = 'bm-tool-btn'
  addFolderBtn.innerHTML = '&#128193;&nbsp; New Folder'
  addFolderBtn.addEventListener('click', function() { openFolderModal() })

  var addLinkBtn = document.createElement('button')
  addLinkBtn.className = 'bm-tool-btn'
  addLinkBtn.innerHTML = '&#43;&nbsp; Add Link'
  addLinkBtn.addEventListener('click', function() { openAddLinkModal(null) })

  var importBtn = document.createElement('button')
  importBtn.className = 'bm-tool-btn bm-import-btn'
  importBtn.innerHTML = '&#8679;&nbsp; Import from Browser'
  importBtn.addEventListener('click', importBookmarks)

  toolbar.appendChild(addFolderBtn)
  toolbar.appendChild(addLinkBtn)
  toolbar.appendChild(importBtn)
  container.appendChild(toolbar)

  // Items
  var list = document.createElement('div')
  list.className = 'bm-list'

  if (bookmarks.length === 0) {
    var empty = document.createElement('div')
    empty.className = 'bm-empty'
    empty.textContent = 'No bookmarks yet. Add a link, create a folder, or import from another browser.'
    list.appendChild(empty)
  }

  for (var i = 0; i < bookmarks.length; i++) {
    (function(bm) {
      if (bm.type === 'folder') {
        list.appendChild(renderFolder(bm, homePage))
      } else {
        list.appendChild(renderLinkItem(bm, null, homePage))
      }
    })(bookmarks[i])
  }

  container.appendChild(list)
}

function renderFolder(folder, homePage) {
  var el = document.createElement('div')
  el.className = 'bm-folder' + (folder.open ? ' open' : '')

  var header = document.createElement('div')
  header.className = 'bm-folder-header'

  var chevron = document.createElement('span')
  chevron.className = 'bm-chevron'
  chevron.innerHTML = folder.open ? '&#9660;' : '&#9654;'

  var icon = document.createElement('span')
  icon.className = 'bm-folder-icon'
  icon.innerHTML = '&#128193;'

  var name = document.createElement('span')
  name.className = 'bm-folder-name'
  name.textContent = folder.name

  var count = document.createElement('span')
  count.className = 'bm-count'
  count.textContent = folder.links.length + (folder.links.length === 1 ? ' link' : ' links')

  var actions = document.createElement('div')
  actions.className = 'bm-actions'

  var addBtn = document.createElement('button')
  addBtn.className = 'bm-action-btn'
  addBtn.innerHTML = '&#43;'
  addBtn.title = 'Add link to this folder'
  ;(function(fid) {
    addBtn.addEventListener('click', function(e) { e.stopPropagation(); openAddLinkModal(fid) })
  })(folder.id)

  var delBtn = document.createElement('button')
  delBtn.className = 'bm-action-btn bm-del-btn'
  delBtn.innerHTML = '&#10005;'
  delBtn.title = 'Delete folder'
  ;(function(fid, fname) {
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      if (confirm('Delete folder "' + fname + '" and all its links?')) deleteBookmark(fid)
    })
  })(folder.id, folder.name)

  actions.appendChild(addBtn)
  actions.appendChild(delBtn)
  header.appendChild(chevron)
  header.appendChild(icon)
  header.appendChild(name)
  header.appendChild(count)
  header.appendChild(actions)

  ;(function(fid) {
    header.addEventListener('click', function() { toggleFolderOpen(fid) })
  })(folder.id)

  el.appendChild(header)

  if (folder.open) {
    var linksWrap = document.createElement('div')
    linksWrap.className = 'bm-folder-links'

    if (folder.links.length === 0) {
      var emptyMsg = document.createElement('div')
      emptyMsg.className = 'bm-empty-folder'
      emptyMsg.textContent = 'Empty — click + to add a link'
      linksWrap.appendChild(emptyMsg)
    }

    for (var j = 0; j < folder.links.length; j++) {
      linksWrap.appendChild(renderLinkItem(folder.links[j], folder.id, homePage))
    }
    el.appendChild(linksWrap)
  }

  return el
}

function renderLinkItem(link, folderId, homePage) {
  var el = document.createElement('div')
  el.className = 'bm-link-item'

  var icon = document.createElement('span')
  icon.className = 'bm-link-icon'
  icon.innerHTML = '&#128279;'

  var name = document.createElement('span')
  name.className = 'bm-link-name'
  name.textContent = link.name

  var urlLabel = document.createElement('span')
  urlLabel.className = 'bm-link-url'
  try { urlLabel.textContent = new URL(link.url).hostname.replace(/^www\./, '') }
  catch(e) { urlLabel.textContent = link.url }

  var actions = document.createElement('div')
  actions.className = 'bm-actions'

  var delBtn = document.createElement('button')
  delBtn.className = 'bm-action-btn bm-del-btn'
  delBtn.innerHTML = '&#10005;'
  delBtn.title = 'Remove bookmark'

  ;(function(lid, fid, url) {
    el.addEventListener('click', function(e) {
      if (e.target === delBtn) return
      var tab = getTab(activeId)
      if (tab) navigateTab(tab.id, url)
    })
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      if (fid) deleteLinkFromFolder(fid, lid)
      else deleteBookmark(lid)
    })
  })(link.id, folderId, link.url)

  actions.appendChild(delBtn)
  el.appendChild(icon)
  el.appendChild(name)
  el.appendChild(urlLabel)
  el.appendChild(actions)
  return el
}

function renderAllBookmarkViews() {
  var homes = document.querySelectorAll('.home-page')
  for (var i = 0; i < homes.length; i++) {
    var bv = homes[i].querySelector('.bookmarks-view')
    if (bv && bv.style.display !== 'none') {
      renderBookmarksView(homes[i])
    }
  }
}

// ── Home / Bookmarks Toggle ──

function switchHomeView(homePage, view) {
  var cardGrid = homePage.querySelector('.card-grid')
  var bmView   = homePage.querySelector('.bookmarks-view')
  var btns     = homePage.querySelectorAll('.vt-btn')

  if (view === 'home') {
    cardGrid.style.display = ''
    bmView.style.display = 'none'
  } else {
    cardGrid.style.display = 'none'
    bmView.style.display = ''
    renderBookmarksView(homePage)
  }

  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === view)
  }
}

// ── Import Bookmarks ──

function importBookmarks() {
  var input = document.createElement('input')
  input.type = 'file'
  input.accept = '.html,.htm'
  input.addEventListener('change', function() {
    var file = input.files[0]
    if (!file) return
    var reader = new FileReader()
    reader.onload = function(e) { parseBmFile(e.target.result) }
    reader.readAsText(file)
  })
  input.click()
}

function parseBmFile(html) {
  try {
    var parser = new DOMParser()
    var doc = parser.parseFromString(html, 'text/html')
    var rootDL = doc.querySelector('DL')
    if (!rootDL) { alert('No bookmarks found in this file.'); return }
    var imported = []
    parseBmDL(rootDL, imported)
    if (imported.length > 0) {
      bookmarks = bookmarks.concat(imported)
      saveBookmarks()
      renderAllBookmarkViews()
      alert('Imported ' + imported.length + ' items successfully.')
    } else {
      alert('No bookmarks found in the file.')
    }
  } catch(e) {
    alert('Could not read the bookmark file. Please export as HTML from your browser and try again.')
  }
}

function parseBmDL(dl, out) {
  var children = dl.children
  for (var i = 0; i < children.length; i++) {
    var dt = children[i]
    if (dt.tagName !== 'DT' && dt.tagName !== 'LI') continue
    var h3 = dt.querySelector(':scope > H3')
    if (!h3) h3 = dt.children[0] && dt.children[0].tagName === 'H3' ? dt.children[0] : null
    var nested = dt.querySelector(':scope > DL')
    if (!nested) {
      // look at next sibling
      for (var x = 0; x < dt.children.length; x++) {
        if (dt.children[x].tagName === 'DL') { nested = dt.children[x]; break }
      }
    }
    if (h3) {
      var folder = { id: bmUid(), type: 'folder', name: h3.textContent.trim(), open: false, links: [] }
      if (nested) parseBmDLIntoFolder(nested, folder)
      out.push(folder)
    } else {
      var a = dt.querySelector('A')
      if (a) {
        var href = a.getAttribute('HREF') || a.getAttribute('href') || ''
        if (href && href.indexOf('javascript:') === -1 && href.indexOf('place:') === -1 && href !== '') {
          out.push({ id: bmUid(), type: 'link', name: (a.textContent.trim() || href), url: href })
        }
      }
    }
  }
}

function parseBmDLIntoFolder(dl, folder) {
  var children = dl.children
  for (var i = 0; i < children.length; i++) {
    var dt = children[i]
    if (dt.tagName !== 'DT' && dt.tagName !== 'LI') continue
    var a = dt.querySelector('A')
    if (a) {
      var href = a.getAttribute('HREF') || a.getAttribute('href') || ''
      if (href && href.indexOf('javascript:') === -1 && href.indexOf('place:') === -1 && href !== '') {
        folder.links.push({ id: bmUid(), type: 'link', name: (a.textContent.trim() || href), url: href })
      }
    }
  }
}

// ── Modals ──

function openFolderModal() {
  closeBmModal()
  var bg = document.createElement('div')
  bg.id = 'bm-modal-bg'
  bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal">' +
    '<h3>New Folder</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Folder name" />' +
    '<div id="bm-modal-btns">' +
    '<button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Create</button>' +
    '</div></div>'
  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var n = document.getElementById('bm-name-input').value.trim()
    if (n) { addFolder(n); closeBmModal() }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if (el) el.focus() }, 50)
}

function openAddLinkModal(folderId) {
  closeBmModal()
  var bg = document.createElement('div')
  bg.id = 'bm-modal-bg'
  bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal">' +
    '<h3>Add Bookmark</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Name" />' +
    '<input id="bm-url-input" type="text" placeholder="https://" />' +
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
    if (n && u) {
      if (folderId) addLinkToFolder(folderId, n, u)
      else addTopLevelLink(n, u)
      closeBmModal()
    }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if (el) el.focus() }, 50)
}

function openBookmarkModal(prefillUrl, prefillName) {
  // Nav bar star button — save current page with optional folder
  closeBmModal()
  var folderOptions = '<option value="">— Top level (no folder) —</option>'
  for (var i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].type === 'folder') {
      folderOptions += '<option value="' + bookmarks[i].id + '">' + bookmarks[i].name + '</option>'
    }
  }
  var bg = document.createElement('div')
  bg.id = 'bm-modal-bg'
  bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal">' +
    '<h3>Save Bookmark</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Name" value="' + (prefillName || '') + '" />' +
    '<input id="bm-url-input" type="text" placeholder="https://" value="' + (prefillUrl || '') + '" />' +
    '<select id="bm-folder-select">' + folderOptions + '</select>' +
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
    var fid = document.getElementById('bm-folder-select').value
    if (n && u) {
      if (fid) addLinkToFolder(fid, n, u)
      else addTopLevelLink(n, u)
      closeBmModal()
    }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if (el) el.focus() }, 50)
}

function closeBmModal() {
  var el = document.getElementById('bm-modal-bg')
  if (el && el.parentNode) el.parentNode.removeChild(el)
}

// ── Tab Management ──

function createTab(url, activate) {
  var id       = 'tab_' + (++tabSeq)
  var resolved = resolveUrl(url || HOME)

  var tpl      = document.getElementById('home-page-template').children[0]
  var homePage = tpl.cloneNode(true)
  homePage.classList.remove('active')
  $contentArea.appendChild(homePage)

  // Brand card clicks
  var cards = homePage.querySelectorAll('.brand-card')
  for (var c = 0; c < cards.length; c++) {
    (function(card) {
      card.addEventListener('click', function() {
        var u = card.getAttribute('data-url')
        if (u) navigateTab(id, u)
      })
    })(cards[c])
  }

  // Home search
  var hs = homePage.querySelector('.home-search')
  hs.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var q = hs.value.trim()
      if (q) { navigateTab(id, q); hs.value = '' }
    }
  })

  // View toggle
  var toggleBtns = homePage.querySelectorAll('.vt-btn')
  for (var t = 0; t < toggleBtns.length; t++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        switchHomeView(homePage, btn.getAttribute('data-view'))
      })
    })(toggleBtns[t])
  }

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
    if (activeId === tab.id) { $addressBar.value = e.url; setSecurityIcon(e.url) }
  })

  wv.addEventListener('page-title-updated', function(e) {
    tab.title = e.title || domain(tab.url)
    renderTabBar()
  })

  wv.addEventListener('page-favicon-updated', function(e) {
    if (e.favicons && e.favicons[0]) { tab.favicon = e.favicons[0]; renderTabBar() }
  })

  wv.addEventListener('new-window', function(e) {
    e.preventDefault()
    createTab(e.url, true)
  })

  $contentArea.appendChild(wv)
  tab.webview = wv
  return wv
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
    tab.url = HOME; tab.title = 'New Tab'; tab.favicon = null
    if (tab.webview) tab.webview.classList.remove('active')
    tab.homePage.classList.add('active')
    if (id === activeId) { $addressBar.value = ''; setButtons(false, false); setSecurityIcon(null) }
    renderTabBar()
    return
  }

  tab.url = url
  tab.homePage.classList.remove('active')
  if (!tab.webview) { createWebview(tab) } else { tab.webview.src = url }
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
  for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) { idx = i; break } }
  if (idx === -1) return
  var wasActive = (activeId === id)
  cleanupTab(id)
  tabs.splice(idx, 1)
  if (wasActive) { var next = tabs[Math.min(idx, tabs.length - 1)]; if (next) activateTab(next.id) }
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
      if (t.favicon) { fav.src = t.favicon; fav.onerror = function() { fav.classList.add('hidden') } }

      var ttl = document.createElement('span')
      ttl.className   = 'tab-title'
      ttl.textContent = t.loading ? 'Loading\u2026' : (t.title || domain(t.url) || 'New Tab')

      var cls = document.createElement('button')
      cls.className = 'tab-close'
      cls.innerHTML = '&#10005;'
      cls.addEventListener('click', function(e) { e.stopPropagation(); closeTab(t.id) })

      el.appendChild(fav); el.appendChild(ttl); el.appendChild(cls)
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
  $securityIcon.innerHTML     = url.startsWith('https://') ? '&#128274;' : '&#9888;'
  $securityIcon.style.opacity = url.startsWith('https://') ? '0.6' : '0.9'
}

// ── Event Listeners ──

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
  if (tab.loading && tab.webview) tab.webview.stop()
  else if (tab.webview) tab.webview.reload()
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
