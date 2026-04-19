// Threshold Browser v0.3 — Tab Manager + Bookmarks + Search + VAULTit
// Global Crossover

'use strict'

var SEARCH_PREFIX = 'threshold://search?q='
var HOME          = 'threshold://home'
var BM_KEY        = 'threshold_bookmarks_v2'
var UC_KEY        = 'threshold_user_cards_v1'
var GC_COLLAPSE   = 'threshold_gc_collapsed'

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
var userCards = []

// ─────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────

function bmUid() { return 'bm_' + Date.now() + '_' + Math.floor(Math.random() * 9999) }

function getTab(id) {
  for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) return tabs[i] }
  return null
}

function isHome(url)   { return !url || url === HOME }
function isSearch(url) { return url && url.startsWith(SEARCH_PREFIX) }

function resolveUrl(raw) {
  var s = (raw || '').trim()
  if (!s || s === HOME) return HOME
  if (s.startsWith('threshold://')) return s
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s
  if (/^[\w-]+\.[\w]{2,}/.test(s) && s.indexOf(' ') === -1) return 'https://' + s
  return SEARCH_PREFIX + encodeURIComponent(s)
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch(e) { return url }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function getSearchQuery(url) {
  if (!isSearch(url)) return ''
  try { return decodeURIComponent(url.replace(SEARCH_PREFIX, '')) }
  catch(e) { return '' }
}

// ─────────────────────────────────────────────────────
// BOOKMARK DATA
// ─────────────────────────────────────────────────────

function loadBookmarks() {
  try {
    var raw = localStorage.getItem(BM_KEY)
    if (raw) { bookmarks = JSON.parse(raw); return }
    var oldRaw = localStorage.getItem('threshold_bookmarks_v1')
    if (oldRaw) {
      bookmarks = migrateOldBookmarks(JSON.parse(oldRaw))
      saveBookmarks(); return
    }
  } catch(e) {}
  bookmarks = getDefaultBookmarks()
  saveBookmarks()
}

function migrateOldBookmarks(old) {
  var result = []
  for (var i = 0; i < old.length; i++) {
    var item = old[i]
    if (item.type === 'folder') result.push({ id: bmUid(), type: 'folder', name: item.name, open: false, links: [] })
    else if (item.type === 'link' && item.url) result.push({ id: bmUid(), type: 'link', name: item.name, url: item.url })
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

function saveBookmarks()     { try { localStorage.setItem(BM_KEY, JSON.stringify(bookmarks)) } catch(e) {} }
function findFolder(id)      { for (var i=0;i<bookmarks.length;i++) { if(bookmarks[i].id===id && bookmarks[i].type==='folder') return bookmarks[i] } return null }
function toggleFolderOpen(id){ var f=findFolder(id); if(f) f.open=!f.open; saveBookmarks(); renderAllBookmarkViews() }

function addFolder(name)                        { bookmarks.push({id:bmUid(),type:'folder',name,open:true,links:[]}); saveBookmarks(); renderAllBookmarkViews() }
function addLinkToFolder(fid,name,url)          { var f=findFolder(fid); if(f) f.links.push({id:bmUid(),type:'link',name,url}); saveBookmarks(); renderAllBookmarkViews() }
function addTopLevelLink(name,url)              { bookmarks.push({id:bmUid(),type:'link',name,url}); saveBookmarks(); renderAllBookmarkViews() }
function deleteBookmark(id)                     { for(var i=0;i<bookmarks.length;i++){if(bookmarks[i].id===id){bookmarks.splice(i,1);break}} saveBookmarks(); renderAllBookmarkViews() }
function deleteLinkFromFolder(fid,lid)          { var f=findFolder(fid); if(f){for(var i=0;i<f.links.length;i++){if(f.links[i].id===lid){f.links.splice(i,1);break}}} saveBookmarks(); renderAllBookmarkViews() }

// ─────────────────────────────────────────────────────
// BOOKMARK VIEW RENDERING
// ─────────────────────────────────────────────────────

function renderBookmarksView(homePage) {
  var container = homePage.querySelector('.bookmarks-view')
  if (!container) return
  container.innerHTML = ''

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
      if (bm.type === 'folder') list.appendChild(renderFolder(bm, homePage))
      else list.appendChild(renderLinkItem(bm, null, homePage))
    })(bookmarks[i])
  }
  container.appendChild(list)
}

function renderFolder(folder, homePage) {
  var el = document.createElement('div')
  el.className = 'bm-folder' + (folder.open ? ' open' : '')

  var header   = document.createElement('div'); header.className = 'bm-folder-header'
  var chevron  = document.createElement('span'); chevron.className = 'bm-chevron'; chevron.innerHTML = folder.open ? '&#9660;' : '&#9654;'
  var icon     = document.createElement('span'); icon.className = 'bm-folder-icon'; icon.innerHTML = '&#128193;'
  var name     = document.createElement('span'); name.className = 'bm-folder-name'; name.textContent = folder.name
  var count    = document.createElement('span'); count.className = 'bm-count'; count.textContent = folder.links.length + (folder.links.length === 1 ? ' link' : ' links')
  var actions  = document.createElement('div');  actions.className = 'bm-actions'

  var addBtn = document.createElement('button'); addBtn.className = 'bm-action-btn'; addBtn.innerHTML = '&#43;'; addBtn.title = 'Add link'
  ;(function(fid) { addBtn.addEventListener('click', function(e) { e.stopPropagation(); openAddLinkModal(fid) }) })(folder.id)

  var delBtn = document.createElement('button'); delBtn.className = 'bm-action-btn bm-del-btn'; delBtn.innerHTML = '&#10005;'; delBtn.title = 'Delete folder'
  ;(function(fid, fname) {
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      if (confirm('Delete folder "' + fname + '" and all its links?')) deleteBookmark(fid)
    })
  })(folder.id, folder.name)

  actions.appendChild(addBtn); actions.appendChild(delBtn)
  header.appendChild(chevron); header.appendChild(icon); header.appendChild(name); header.appendChild(count); header.appendChild(actions)
  ;(function(fid) { header.addEventListener('click', function() { toggleFolderOpen(fid) }) })(folder.id)
  el.appendChild(header)

  if (folder.open) {
    var linksWrap = document.createElement('div'); linksWrap.className = 'bm-folder-links'
    if (folder.links.length === 0) {
      var emptyMsg = document.createElement('div'); emptyMsg.className = 'bm-empty-folder'; emptyMsg.textContent = 'Empty — click + to add a link'
      linksWrap.appendChild(emptyMsg)
    }
    for (var j = 0; j < folder.links.length; j++) linksWrap.appendChild(renderLinkItem(folder.links[j], folder.id, homePage))
    el.appendChild(linksWrap)
  }
  return el
}

function renderLinkItem(link, folderId, homePage) {
  var el      = document.createElement('div'); el.className = 'bm-link-item'
  var icon    = document.createElement('span'); icon.className = 'bm-link-icon'; icon.innerHTML = '&#128279;'
  var name    = document.createElement('span'); name.className = 'bm-link-name'; name.textContent = link.name
  var urlLbl  = document.createElement('span'); urlLbl.className = 'bm-link-url'
  try { urlLbl.textContent = new URL(link.url).hostname.replace(/^www\./, '') } catch(e) { urlLbl.textContent = link.url }
  var actions = document.createElement('div'); actions.className = 'bm-actions'
  var delBtn  = document.createElement('button'); delBtn.className = 'bm-action-btn bm-del-btn'; delBtn.innerHTML = '&#10005;'; delBtn.title = 'Remove'

  ;(function(lid, fid, url) {
    el.addEventListener('click', function(e) {
      if (e.target === delBtn) return
      var tab = getTab(activeId); if (tab) navigateTab(tab.id, url)
    })
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      if (fid) deleteLinkFromFolder(fid, lid); else deleteBookmark(lid)
    })
  })(link.id, folderId, link.url)

  actions.appendChild(delBtn)
  el.appendChild(icon); el.appendChild(name); el.appendChild(urlLbl); el.appendChild(actions)
  return el
}

function renderAllBookmarkViews() {
  var homes = document.querySelectorAll('.home-page')
  for (var i = 0; i < homes.length; i++) {
    var bv = homes[i].querySelector('.bookmarks-view')
    if (bv && bv.style.display !== 'none') renderBookmarksView(homes[i])
  }
}

// ─────────────────────────────────────────────────────
// GC SECTION COLLAPSE
// ─────────────────────────────────────────────────────

function loadGCCollapseState() { return localStorage.getItem(GC_COLLAPSE) === '1' }
function saveGCCollapseState(c){ localStorage.setItem(GC_COLLAPSE, c ? '1' : '0') }

function initGCSection(homePage) {
  var section   = homePage.querySelector('.gc-section')
  var btn       = homePage.querySelector('.gc-collapse-btn')
  if (!section || !btn) return

  if (loadGCCollapseState()) section.classList.add('collapsed')

  btn.addEventListener('click', function(e) {
    e.stopPropagation()
    var collapsed = section.classList.toggle('collapsed')
    saveGCCollapseState(collapsed)
    // Sync all other home pages
    var others = document.querySelectorAll('.home-page .gc-section')
    for (var i = 0; i < others.length; i++) {
      collapsed ? others[i].classList.add('collapsed') : others[i].classList.remove('collapsed')
    }
  })
}

// ─────────────────────────────────────────────────────
// USER CARDS
// ─────────────────────────────────────────────────────

function loadUserCards() {
  try { var raw = localStorage.getItem(UC_KEY); if (raw) userCards = JSON.parse(raw) }
  catch(e) { userCards = [] }
}

function saveUserCards() { try { localStorage.setItem(UC_KEY, JSON.stringify(userCards)) } catch(e) {} }

function renderUserCards(homePage) {
  var grid = homePage.querySelector('.user-card-grid')
  if (!grid) return
  grid.innerHTML = ''

  for (var i = 0; i < userCards.length; i++) {
    (function(card) {
      var el   = document.createElement('div'); el.className = 'user-card'
      var del  = document.createElement('button'); del.className = 'user-card-del'; del.innerHTML = '&#10005;'; del.title = 'Remove'
      var icon = document.createElement('span'); icon.className = 'user-card-icon'; icon.textContent = card.icon || '&#127760;'
      var nm   = document.createElement('div');  nm.className  = 'user-card-name'; nm.textContent = card.name

      ;(function(c) {
        el.addEventListener('click', function(e) {
          if (e.target === del) return
          var tab = getTab(activeId); if (tab) navigateTab(tab.id, c.url)
        })
        del.addEventListener('click', function(e) {
          e.stopPropagation()
          userCards = userCards.filter(function(x) { return x.id !== c.id })
          saveUserCards()
          renderAllUserCardViews()
        })
      })(card)

      el.appendChild(del); el.appendChild(icon); el.appendChild(nm)
      grid.appendChild(el)
    })(userCards[i])
  }
}

function renderAllUserCardViews() {
  var homes = document.querySelectorAll('.home-page')
  for (var i = 0; i < homes.length; i++) renderUserCards(homes[i])
}

function initUserSection(homePage) {
  var addBtn = homePage.querySelector('.add-user-card-btn')
  if (addBtn) addBtn.addEventListener('click', function() { openUserCardModal() })
  renderUserCards(homePage)
}

function openUserCardModal() {
  closeBmModal()
  var bg = document.createElement('div')
  bg.id = 'bm-modal-bg'; bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal">' +
    '<h3>Add Card</h3>' +
    '<input id="bm-name-input"  type="text" placeholder="Name (e.g. My Blog)" />' +
    '<input id="bm-url-input"   type="text" placeholder="https://" />' +
    '<input id="bm-icon-input"  type="text" placeholder="Emoji icon (e.g. \uD83C\uDF1F)" maxlength="4" style="width:80px;" />' +
    '<div id="bm-modal-btns">' +
    '<button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Add</button>' +
    '</div></div>'
  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var n = document.getElementById('bm-name-input').value.trim()
    var u = document.getElementById('bm-url-input').value.trim()
    var ic = document.getElementById('bm-icon-input').value.trim() || '\uD83C\uDF10'
    if (n && u) {
      userCards.push({ id: 'uc_' + Date.now(), name: n, url: resolveUrl(u), icon: ic })
      saveUserCards(); renderAllUserCardViews(); closeBmModal()
    }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if(el) el.focus() }, 50)
}

// ─────────────────────────────────────────────────────
// VAULT IT
// ─────────────────────────────────────────────────────

var vaultCredentials = []
var vaultEncrypted   = false

function renderVaultView(homePage) {
  var container = homePage.querySelector('.vault-view')
  if (!container) return
  container.innerHTML = ''

  var toolbar = document.createElement('div'); toolbar.className = 'vault-toolbar'
  var addBtn  = document.createElement('button'); addBtn.className = 'vault-add-btn'
  addBtn.innerHTML = '&#43; Add Credential'
  addBtn.addEventListener('click', function() { openVaultAddModal() })

  var status = document.createElement('span'); status.className = 'vault-status'
  status.textContent = vaultCredentials.length + ' saved'

  var encBadge = document.createElement('span')
  if (vaultEncrypted) {
    encBadge.className = 'vault-enc-badge'; encBadge.textContent = '\uD83D\uDD12 Encrypted'
  } else {
    encBadge.className = 'vault-enc-badge'; encBadge.style.opacity = '0.4'
    encBadge.textContent = '\u26A0 Unencrypted (Electron 15+ required)'
  }

  toolbar.appendChild(addBtn); toolbar.appendChild(status); toolbar.appendChild(encBadge)
  container.appendChild(toolbar)

  var list = document.createElement('div'); list.className = 'vault-list'

  if (vaultCredentials.length === 0) {
    var empty = document.createElement('div'); empty.className = 'vault-empty'
    empty.innerHTML = '\uD83D\uDD13 No credentials saved yet.<br>Add one above or let Threshold prompt you when you log in.'
    list.appendChild(empty)
  }

  for (var i = 0; i < vaultCredentials.length; i++) {
    (function(cred) {
      var item   = document.createElement('div'); item.className = 'vault-item'
      var icon   = document.createElement('div'); icon.className = 'vault-item-icon'; icon.textContent = '\uD83D\uDD10'
      var info   = document.createElement('div'); info.className = 'vault-item-info'
      var dm     = document.createElement('div'); dm.className   = 'vault-item-domain'
      try { dm.textContent = new URL(cred.url).hostname.replace(/^www\./,'') } catch(e) { dm.textContent = cred.url }
      var usr    = document.createElement('div'); usr.className   = 'vault-item-user'; usr.textContent = cred.username || '(no username)'
      info.appendChild(dm); info.appendChild(usr)

      var actions = document.createElement('div'); actions.className = 'vault-item-actions'

      var visitBtn = document.createElement('button'); visitBtn.className = 'vault-btn'; visitBtn.textContent = 'Visit'
      visitBtn.addEventListener('click', function() {
        var tab = getTab(activeId); if (tab) navigateTab(tab.id, cred.url)
      })

      var copyBtn = document.createElement('button'); copyBtn.className = 'vault-btn'; copyBtn.textContent = 'Copy PW'
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(cred.password || '').then(function() {
          copyBtn.textContent = 'Copied!'
          copyBtn.classList.add('vault-copy-flash')
          setTimeout(function() { copyBtn.textContent = 'Copy PW'; copyBtn.classList.remove('vault-copy-flash') }, 1500)
        })
      })

      var delBtn = document.createElement('button'); delBtn.className = 'vault-btn del'; delBtn.textContent = 'Delete'
      delBtn.addEventListener('click', function() {
        if (confirm('Remove credentials for ' + (dm.textContent || cred.url) + '?')) {
          window.threshold.vault.delete(cred.id).then(function(res) {
            vaultCredentials = res.credentials
            vaultEncrypted   = res.encrypted
            renderAllVaultViews()
          })
        }
      })

      actions.appendChild(visitBtn); actions.appendChild(copyBtn); actions.appendChild(delBtn)
      item.appendChild(icon); item.appendChild(info); item.appendChild(actions)
      list.appendChild(item)
    })(vaultCredentials[i])
  }
  container.appendChild(list)
}

function renderAllVaultViews() {
  var homes = document.querySelectorAll('.home-page')
  for (var i = 0; i < homes.length; i++) {
    var vv = homes[i].querySelector('.vault-view')
    if (vv && vv.style.display !== 'none') renderVaultView(homes[i])
  }
}

function openVaultAddModal() {
  closeBmModal()
  var bg = document.createElement('div'); bg.id = 'bm-modal-bg'; bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal">' +
    '<h3>\uD83D\uDD10 Save Credential</h3>' +
    '<input id="bm-url-input"  type="text" placeholder="https://site.com" />' +
    '<input id="bm-name-input" type="text" placeholder="Username or email" />' +
    '<input id="bm-pw-input"   type="password" placeholder="Password" />' +
    '<div id="bm-modal-btns">' +
    '<button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Save to Vault</button>' +
    '</div></div>'
  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var u  = document.getElementById('bm-url-input').value.trim()
    var un = document.getElementById('bm-name-input').value.trim()
    var pw = document.getElementById('bm-pw-input').value
    if (u && pw) {
      window.threshold.vault.save({ url: u, username: un, password: pw }).then(function(res) {
        vaultCredentials = res.credentials
        vaultEncrypted   = res.encrypted
        renderAllVaultViews()
        closeBmModal()
      })
    }
  })
  setTimeout(function() { var el = document.getElementById('bm-url-input'); if(el) el.focus() }, 50)
}

async function loadVault() {
  try {
    var res = await window.threshold.vault.list()
    vaultCredentials = res.credentials
    vaultEncrypted   = res.encrypted
  } catch(e) { vaultCredentials = []; vaultEncrypted = false }
}

// ─────────────────────────────────────────────────────
// SEARCH PAGE
// ─────────────────────────────────────────────────────

function createSearchPage() {
  var el = document.createElement('div')
  el.className = 'search-page'
  $contentArea.appendChild(el)
  return el
}

async function showSearchPage(tab, query) {
  // Hide home and webview for this tab
  tab.homePage.classList.remove('active')
  if (tab.webview) tab.webview.classList.remove('active')

  // Create search page element if needed
  if (!tab.searchPage) tab.searchPage = createSearchPage()
  tab.searchPage.classList.add('active')

  tab.url   = SEARCH_PREFIX + encodeURIComponent(query)
  tab.title = query + ' \u2014 Threshold'

  if (activeId === tab.id) {
    $addressBar.value = query
    setSecurityIcon(null)
    setButtons(false, false)
  }
  renderTabBar()

  // Show loading
  tab.searchPage.innerHTML =
    '<div class="search-page-inner">' +
    '<div class="search-header">' +
    '<div class="search-logo">THRESHOLD</div>' +
    '<div class="search-input-wrap"><input class="search-page-input" type="text" value="' + escHtml(query) + '" /></div>' +
    '</div>' +
    '<div class="search-loading">Searching\u2026</div>' +
    '</div>'

  bindSearchInputEvent(tab.searchPage, tab.id)

  // Fetch results
  try {
    var result = await window.threshold.search(query)
    if (result.ok) {
      renderSearchResults(tab.searchPage, query, result.results)
    } else {
      renderSearchError(tab.searchPage, query, result.error)
    }
  } catch(e) {
    renderSearchError(tab.searchPage, query, e.message)
  }

  bindSearchInputEvent(tab.searchPage, tab.id)
}

function renderSearchResults(container, query, results) {
  var inner =
    '<div class="search-page-inner">' +
    '<div class="search-header">' +
    '<div class="search-logo">THRESHOLD</div>' +
    '<div class="search-input-wrap"><input class="search-page-input" type="text" value="' + escHtml(query) + '" /></div>' +
    '</div>'

  if (results.length === 0) {
    inner += '<div class="search-no-results">No results found for \u201c' + escHtml(query) + '\u201d</div>'
  } else {
    inner += '<div class="search-meta">About ' + results.length + ' results</div>'
    inner += '<div class="search-results">'
    for (var i = 0; i < results.length; i++) {
      var r = results[i]
      var dm = ''
      try { dm = new URL(r.url).hostname.replace(/^www\./,'') } catch(e) { dm = r.url }
      inner +=
        '<div class="search-result" data-url="' + escHtml(r.url) + '">' +
        '<div class="search-result-domain">' + escHtml(dm) + '</div>' +
        '<div class="search-result-title">' + escHtml(r.title || r.url) + '</div>' +
        '<div class="search-result-desc">' + escHtml(r.description || '') + '</div>' +
        '</div>'
    }
    inner += '</div>'
  }
  inner += '</div>'
  container.innerHTML = inner
  bindSearchResultEvents(container)
  bindSearchInputEvent(container, activeId)
}

function renderSearchError(container, query, errCode) {
  var msg   = errCode === 'NO_API_KEY' ? '' : 'Search unavailable. Please try again.'
  var setup = errCode === 'NO_API_KEY'
    ? '&#9888; Threshold Search needs a Brave API key.<br>' +
      '1. Get a free key at <strong>api-dashboard.search.brave.com</strong><br>' +
      '2. Open <strong>main.js</strong> and replace <code>YOUR_BRAVE_API_KEY_HERE</code><br>' +
      '3. Rebuild Threshold'
    : ''
  container.innerHTML =
    '<div class="search-page-inner">' +
    '<div class="search-header">' +
    '<div class="search-logo">THRESHOLD</div>' +
    '<div class="search-input-wrap"><input class="search-page-input" type="text" value="' + escHtml(query) + '" /></div>' +
    '</div>' +
    '<div class="search-error">' +
    (msg ? '<div class="search-error-msg">' + escHtml(msg) + '</div>' : '') +
    (setup ? '<div class="search-error-setup">' + setup + '</div>' : '') +
    '</div>' +
    '</div>'
  bindSearchInputEvent(container, activeId)
}

function bindSearchResultEvents(container) {
  var results = container.querySelectorAll('.search-result')
  for (var i = 0; i < results.length; i++) {
    (function(el) {
      el.addEventListener('click', function() {
        var url = el.getAttribute('data-url')
        var tab = getTab(activeId)
        if (url && tab) navigateTab(tab.id, url)
      })
    })(results[i])
  }
}

function bindSearchInputEvent(container, tabId) {
  var input = container.querySelector('.search-page-input')
  if (!input) return
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var q = input.value.trim()
      if (q) { var tab = getTab(tabId); if (tab) navigateTab(tab.id, resolveUrl(q)) }
    }
  })
}

// ─────────────────────────────────────────────────────
// HOME / BOOKMARKS / VAULT TOGGLE
// ─────────────────────────────────────────────────────

function switchHomeView(homePage, view) {
  var gcSection  = homePage.querySelector('.gc-section')
  var userSec    = homePage.querySelector('.user-section')
  var searchWrap = homePage.querySelector('.home-search-wrap')
  var bmView     = homePage.querySelector('.bookmarks-view')
  var vaultView  = homePage.querySelector('.vault-view')
  var btns       = homePage.querySelectorAll('.vt-btn')

  // Hide all panels
  if (gcSection)  gcSection.style.display  = ''
  if (userSec)    userSec.style.display    = ''
  if (bmView)     bmView.style.display     = 'none'
  if (vaultView)  vaultView.style.display  = 'none'

  if (view === 'home') {
    // Everything already shown above
  } else if (view === 'bookmarks') {
    if (gcSection) gcSection.style.display  = 'none'
    if (userSec)   userSec.style.display    = 'none'
    if (bmView)    { bmView.style.display   = ''; renderBookmarksView(homePage) }
  } else if (view === 'vault') {
    if (gcSection)   gcSection.style.display  = 'none'
    if (userSec)     userSec.style.display    = 'none'
    if (vaultView)   { vaultView.style.display = ''; renderVaultView(homePage) }
  }

  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === view)
  }
}

// ─────────────────────────────────────────────────────
// BOOKMARK IMPORT
// ─────────────────────────────────────────────────────

function importBookmarks() {
  var input = document.createElement('input')
  input.type = 'file'; input.accept = '.html,.htm'
  input.addEventListener('change', function() {
    var file = input.files[0]; if (!file) return
    var reader = new FileReader()
    reader.onload = function(e) { parseBmFile(e.target.result) }
    reader.readAsText(file)
  })
  input.click()
}

function parseBmFile(html) {
  try {
    var parser = new DOMParser()
    var doc    = parser.parseFromString(html, 'text/html')
    var rootDL = doc.querySelector('DL')
    if (!rootDL) { alert('No bookmarks found.'); return }
    var imported = []
    parseBmDL(rootDL, imported)
    if (imported.length > 0) {
      bookmarks = bookmarks.concat(imported)
      saveBookmarks(); renderAllBookmarkViews()
      alert('Imported ' + imported.length + ' items.')
    } else { alert('No bookmarks found in file.') }
  } catch(e) { alert('Could not read bookmark file. Export as HTML from your browser and try again.') }
}

function parseBmDL(dl, out) {
  var children = dl.children
  for (var i = 0; i < children.length; i++) {
    var dt = children[i]; if (dt.tagName !== 'DT' && dt.tagName !== 'LI') continue
    var h3     = dt.querySelector(':scope > H3')
    var nested = dt.querySelector(':scope > DL')
    if (!nested) { for (var x = 0; x < dt.children.length; x++) { if (dt.children[x].tagName === 'DL') { nested = dt.children[x]; break } } }
    if (h3) {
      var folder = { id: bmUid(), type: 'folder', name: h3.textContent.trim(), open: false, links: [] }
      if (nested) parseBmDLIntoFolder(nested, folder)
      out.push(folder)
    } else {
      var a = dt.querySelector('A')
      if (a) {
        var href = a.getAttribute('HREF') || a.getAttribute('href') || ''
        if (href && href.indexOf('javascript:') === -1 && href.indexOf('place:') === -1) {
          out.push({ id: bmUid(), type: 'link', name: (a.textContent.trim() || href), url: href })
        }
      }
    }
  }
}

function parseBmDLIntoFolder(dl, folder) {
  var children = dl.children
  for (var i = 0; i < children.length; i++) {
    var dt = children[i]; if (dt.tagName !== 'DT' && dt.tagName !== 'LI') continue
    var a = dt.querySelector('A')
    if (a) {
      var href = a.getAttribute('HREF') || a.getAttribute('href') || ''
      if (href && href.indexOf('javascript:') === -1 && href.indexOf('place:') === -1) {
        folder.links.push({ id: bmUid(), type: 'link', name: (a.textContent.trim() || href), url: href })
      }
    }
  }
}

// ─────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────

function openFolderModal() {
  closeBmModal()
  var bg = document.createElement('div'); bg.id = 'bm-modal-bg'; bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal"><h3>New Folder</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Folder name" />' +
    '<div id="bm-modal-btns"><button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Create</button></div></div>'
  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var n = document.getElementById('bm-name-input').value.trim()
    if (n) { addFolder(n); closeBmModal() }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if(el) el.focus() }, 50)
}

function openAddLinkModal(folderId) {
  closeBmModal()
  var bg = document.createElement('div'); bg.id = 'bm-modal-bg'; bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal"><h3>Add Bookmark</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Name" />' +
    '<input id="bm-url-input"  type="text" placeholder="https://" />' +
    '<div id="bm-modal-btns"><button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Save</button></div></div>'
  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var n = document.getElementById('bm-name-input').value.trim()
    var u = document.getElementById('bm-url-input').value.trim()
    if (n && u) { if (folderId) addLinkToFolder(folderId, n, u); else addTopLevelLink(n, u); closeBmModal() }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if(el) el.focus() }, 50)
}

function openBookmarkModal(prefillUrl, prefillName) {
  closeBmModal()
  var folderOptions = '<option value="">— Top level —</option>'
  for (var i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].type === 'folder') folderOptions += '<option value="' + bookmarks[i].id + '">' + bookmarks[i].name + '</option>'
  }
  var bg = document.createElement('div'); bg.id = 'bm-modal-bg'; bg.className = 'open'
  bg.innerHTML =
    '<div id="bm-modal"><h3>Save Bookmark</h3>' +
    '<input id="bm-name-input" type="text" placeholder="Name" value="' + escHtml(prefillName || '') + '" />' +
    '<input id="bm-url-input"  type="text" placeholder="https://" value="' + escHtml(prefillUrl || '') + '" />' +
    '<select id="bm-folder-select">' + folderOptions + '</select>' +
    '<div id="bm-modal-btns"><button class="modal-btn" id="bm-cancel">Cancel</button>' +
    '<button class="modal-btn primary" id="bm-save">Save</button></div></div>'
  $contentArea.appendChild(bg)
  bg.addEventListener('click', function(e) { if (e.target === bg) closeBmModal() })
  document.getElementById('bm-cancel').addEventListener('click', closeBmModal)
  document.getElementById('bm-save').addEventListener('click', function() {
    var n   = document.getElementById('bm-name-input').value.trim()
    var u   = document.getElementById('bm-url-input').value.trim()
    var fid = document.getElementById('bm-folder-select').value
    if (n && u) { if (fid) addLinkToFolder(fid, n, u); else addTopLevelLink(n, u); closeBmModal() }
  })
  setTimeout(function() { var el = document.getElementById('bm-name-input'); if(el) el.focus() }, 50)
}

function closeBmModal() {
  var el = document.getElementById('bm-modal-bg')
  if (el && el.parentNode) el.parentNode.removeChild(el)
}

// ─────────────────────────────────────────────────────
// TAB MANAGEMENT
// ─────────────────────────────────────────────────────

function createTab(url, activate) {
  var id       = 'tab_' + (++tabSeq)
  var resolved = resolveUrl(url || HOME)

  var tpl      = document.getElementById('home-page-template').children[0]
  var homePage = tpl.cloneNode(true)
  homePage.classList.remove('active')
  $contentArea.appendChild(homePage)

  // GC collapse state
  initGCSection(homePage)

  // User cards
  initUserSection(homePage)

  // Brand card clicks
  var cards = homePage.querySelectorAll('.brand-card')
  for (var c = 0; c < cards.length; c++) {
    (function(card) {
      card.addEventListener('click', function() {
        var u = card.getAttribute('data-url'); if (u) navigateTab(id, u)
      })
    })(cards[c])
  }

  // Home search bar
  var hs = homePage.querySelector('.home-search')
  hs.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var q = hs.value.trim()
      if (q) { navigateTab(id, resolveUrl(q)); hs.value = '' }
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

  var tab = { id, url: resolved, title: 'New Tab', favicon: null, loading: false, webview: null, homePage, searchPage: null }
  tabs.push(tab)

  if (!isHome(resolved) && !isSearch(resolved)) createWebview(tab)
  if (activate !== false) activateTab(id)
  renderTabBar()

  // Load search if needed
  if (isSearch(resolved)) showSearchPage(tab, getSearchQuery(resolved))

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
    if (activeId === tab.id) { $reloadBtn.innerHTML = '&#8635;'; setButtons(wv.canGoBack(), wv.canGoForward()) }
    renderTabBar()
  })

  wv.addEventListener('did-navigate', function(e) {
    tab.url = e.url
    if (activeId === tab.id) { $addressBar.value = e.url; setSecurityIcon(e.url); setButtons(wv.canGoBack(), wv.canGoForward()) }
    renderTabBar()
  })

  wv.addEventListener('did-navigate-in-page', function(e) {
    if (!e.isMainFrame) return
    tab.url = e.url
    if (activeId === tab.id) { $addressBar.value = e.url; setSecurityIcon(e.url) }
  })

  wv.addEventListener('page-title-updated', function(e) {
    tab.title = e.title || domain(tab.url); renderTabBar()
  })

  wv.addEventListener('page-favicon-updated', function(e) {
    if (e.favicons && e.favicons[0]) { tab.favicon = e.favicons[0]; renderTabBar() }
  })

  wv.addEventListener('new-window', function(e) {
    e.preventDefault(); createTab(e.url, true)
  })

  // Right-click context menu
  wv.addEventListener('context-menu', function(e) {
    if (window.threshold && window.threshold.showContextMenu) {
      window.threshold.showContextMenu({
        linkURL:       e.params.linkURL      || '',
        linkText:      e.params.linkText     || '',
        selectionText: e.params.selectionText|| '',
        x: e.params.x || 0,
        y: e.params.y || 0
      })
    }
  })

  $contentArea.appendChild(wv)
  tab.webview = wv
  return wv
}

function activateTab(id) {
  activeId = id
  var tab  = getTab(id)
  if (!tab) return

  // Hide everything
  var allWebviews = document.querySelectorAll('webview')
  for (var i = 0; i < allWebviews.length; i++) allWebviews[i].classList.remove('active')
  var allHomes = document.querySelectorAll('.home-page')
  for (var j = 0; j < allHomes.length; j++) allHomes[j].classList.remove('active')
  var allSearches = document.querySelectorAll('.search-page')
  for (var k = 0; k < allSearches.length; k++) allSearches[k].classList.remove('active')

  if (isHome(tab.url)) {
    tab.homePage.classList.add('active')
    $addressBar.value = ''
    $addressBar.placeholder = 'Search or enter address\u2026'
    setButtons(false, false); setSecurityIcon(null)
  } else if (isSearch(tab.url)) {
    if (tab.searchPage) tab.searchPage.classList.add('active')
    $addressBar.value = getSearchQuery(tab.url)
    setButtons(false, false); setSecurityIcon(null)
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

  // Hide all views for this tab
  tab.homePage.classList.remove('active')
  if (tab.webview)     tab.webview.classList.remove('active')
  if (tab.searchPage)  tab.searchPage.classList.remove('active')

  if (isHome(url)) {
    tab.url = HOME; tab.title = 'New Tab'; tab.favicon = null
    tab.homePage.classList.add('active')
    if (id === activeId) { $addressBar.value = ''; setButtons(false, false); setSecurityIcon(null) }
    renderTabBar(); return
  }

  if (isSearch(url)) {
    showSearchPage(tab, getSearchQuery(url)); return
  }

  // Real URL
  tab.url = url
  if (!tab.webview) { createWebview(tab) } else { tab.webview.src = url }
  if (id === activeId) {
    tab.webview.classList.add('active')
    $addressBar.value = url; setSecurityIcon(url); setButtons(false, false)
  }
}

function closeTab(id) {
  if (tabs.length === 1) {
    var newId = createTab(HOME, false); activateTab(newId); cleanupTab(id)
    tabs.splice(0, 1); renderTabBar(); return
  }
  var idx = -1
  for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) { idx = i; break } }
  if (idx === -1) return
  var wasActive = (activeId === id)
  cleanupTab(id); tabs.splice(idx, 1)
  if (wasActive) { var next = tabs[Math.min(idx, tabs.length - 1)]; if (next) activateTab(next.id) }
  renderTabBar()
}

function cleanupTab(id) {
  var tab = getTab(id); if (!tab) return
  if (tab.webview    && tab.webview.parentNode)    tab.webview.parentNode.removeChild(tab.webview)
  if (tab.homePage   && tab.homePage.parentNode)   tab.homePage.parentNode.removeChild(tab.homePage)
  if (tab.searchPage && tab.searchPage.parentNode) tab.searchPage.parentNode.removeChild(tab.searchPage)
}

// ─────────────────────────────────────────────────────
// TAB BAR RENDERING (with drag-to-reorder)
// ─────────────────────────────────────────────────────

var dragSrcId = null

function renderTabBar() {
  $tabsContainer.innerHTML = ''
  for (var i = 0; i < tabs.length; i++) {
    (function(t, idx) {
      var el = document.createElement('div')
      el.className = 'tab' + (t.id === activeId ? ' active' : '') + (t.loading ? ' loading' : '')
      el.draggable = true
      el.dataset.tabId = t.id

      var fav = document.createElement('img')
      fav.className = 'tab-favicon' + (t.favicon ? '' : ' hidden')
      if (t.favicon) { fav.src = t.favicon; fav.onerror = function() { fav.classList.add('hidden') } }

      var ttl = document.createElement('span')
      ttl.className   = 'tab-title'
      ttl.textContent = t.loading ? 'Loading\u2026' : (t.title || domain(t.url) || 'New Tab')

      var cls = document.createElement('button')
      cls.className = 'tab-close'; cls.innerHTML = '&#10005;'
      cls.addEventListener('click', function(e) { e.stopPropagation(); closeTab(t.id) })

      el.appendChild(fav); el.appendChild(ttl); el.appendChild(cls)
      el.addEventListener('click', function() { activateTab(t.id) })

      // Drag-to-reorder
      el.addEventListener('dragstart', function(e) {
        dragSrcId = t.id
        el.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', t.id)
      })
      el.addEventListener('dragend', function() {
        el.classList.remove('dragging')
        var all = $tabsContainer.querySelectorAll('.tab')
        for (var x = 0; x < all.length; x++) all[x].classList.remove('drag-over')
        dragSrcId = null
      })
      el.addEventListener('dragover', function(e) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        var all = $tabsContainer.querySelectorAll('.tab')
        for (var x = 0; x < all.length; x++) all[x].classList.remove('drag-over')
        if (dragSrcId !== t.id) el.classList.add('drag-over')
      })
      el.addEventListener('drop', function(e) {
        e.preventDefault()
        if (!dragSrcId || dragSrcId === t.id) return
        var srcIdx  = -1
        var destIdx = -1
        for (var x = 0; x < tabs.length; x++) {
          if (tabs[x].id === dragSrcId) srcIdx  = x
          if (tabs[x].id === t.id)     destIdx = x
        }
        if (srcIdx === -1 || destIdx === -1) return
        var moved = tabs.splice(srcIdx, 1)[0]
        tabs.splice(destIdx, 0, moved)
        renderTabBar()
      })

      $tabsContainer.appendChild(el)
    })(tabs[i], i)
  }
}

function setButtons(back, forward) {
  $backBtn.disabled    = !back
  $forwardBtn.disabled = !forward
}

function setSecurityIcon(url) {
  if (!url || isHome(url) || isSearch(url)) { $securityIcon.innerHTML = ''; return }
  $securityIcon.innerHTML     = url.startsWith('https://') ? '&#128274;' : '&#9888;'
  $securityIcon.style.opacity = url.startsWith('https://') ? '0.6' : '0.9'
}

// ─────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────

$addressBar.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var tab = getTab(activeId)
    if (tab) navigateTab(tab.id, $addressBar.value)
    $addressBar.blur()
  }
  if (e.key === 'Escape') {
    var t = getTab(activeId)
    if (t) {
      if (isHome(t.url))   $addressBar.value = ''
      else if (isSearch(t.url)) $addressBar.value = getSearchQuery(t.url)
      else $addressBar.value = t.url
    }
    $addressBar.blur()
  }
})
$addressBar.addEventListener('focus', function() { $addressBar.select() })

$backBtn.addEventListener('click',    function() { var t=getTab(activeId); if(t&&t.webview) t.webview.goBack() })
$forwardBtn.addEventListener('click', function() { var t=getTab(activeId); if(t&&t.webview) t.webview.goForward() })
$reloadBtn.addEventListener('click',  function() {
  var tab = getTab(activeId)
  if (!tab || isHome(tab.url) || isSearch(tab.url)) return
  if (tab.loading && tab.webview) tab.webview.stop()
  else if (tab.webview) tab.webview.reload()
})
$homeBtn.addEventListener('click',     function() { var t=getTab(activeId); if(t) navigateTab(t.id, HOME) })
$bookmarkBtn.addEventListener('click', function() {
  var tab   = getTab(activeId)
  var url   = (tab && !isHome(tab.url) && !isSearch(tab.url)) ? tab.url : ''
  var title = (tab && tab.title && tab.title !== 'New Tab') ? tab.title : ''
  openBookmarkModal(url, title)
})
$newTabBtn.addEventListener('click', function() { createTab(HOME, true) })

// Window controls
var wcMin = document.getElementById('wc-min')
var wcMax = document.getElementById('wc-max')
var wcCls = document.getElementById('wc-close')
if (wcMin) wcMin.addEventListener('click', function() { if(window.threshold) window.threshold.minimize() })
if (wcMax) wcMax.addEventListener('click', function() { if(window.threshold) window.threshold.maximize() })
if (wcCls) wcCls.addEventListener('click', function() { if(window.threshold) window.threshold.close() })

// Keyboard shortcuts
var isMac = window.threshold && window.threshold.platform === 'darwin'
document.addEventListener('keydown', function(e) {
  var mod = isMac ? e.metaKey : e.ctrlKey
  if (mod && e.key === 'l') { $addressBar.focus(); $addressBar.select(); e.preventDefault() }
  if (mod && e.key === 't') { createTab(HOME, true); e.preventDefault() }
  if (mod && e.key === 'w') { closeTab(activeId); e.preventDefault() }
  if (mod && e.key === 'r') { var t=getTab(activeId); if(t&&t.webview&&!isHome(t.url)&&!isSearch(t.url)) t.webview.reload(); e.preventDefault() }
  if (mod && e.key === 'd') { $bookmarkBtn.click(); e.preventDefault() }
  if (mod && (e.key==='ArrowLeft'  || e.key==='[')) { var t2=getTab(activeId); if(t2&&t2.webview) t2.webview.goBack();    e.preventDefault() }
  if (mod && (e.key==='ArrowRight' || e.key===']')) { var t3=getTab(activeId); if(t3&&t3.webview) t3.webview.goForward(); e.preventDefault() }
  if (e.key === 'Escape') { var tab=getTab(activeId); if(tab&&isHome(tab.url)) return; navigateTab(activeId, HOME) }
  if (mod && e.key >= '1' && e.key <= '9') {
    var idx = parseInt(e.key) - 1
    if (tabs[idx]) { activateTab(tabs[idx].id); e.preventDefault() }
  }
})

// Messages from main process
if (window.threshold && window.threshold.onMessage) {
  window.threshold.onMessage('tray-new-tab', function() { createTab(HOME, true) })
  window.threshold.onMessage('ctx-open-tab', function(url) { createTab(url, true) })
  window.threshold.onMessage('ctx-search',   function(query) {
    var tab = getTab(activeId); if (tab) navigateTab(tab.id, SEARCH_PREFIX + encodeURIComponent(query))
  })
  window.threshold.onMessage('ctx-inspect',  function(x, y) {
    var tab = getTab(activeId); if (tab && tab.webview) tab.webview.inspectElement(x, y)
  })
}

if (window.threshold && window.threshold.platform) {
  document.body.classList.add(window.threshold.platform)
}

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────

loadBookmarks()
loadUserCards()
loadVault().then(function() { createTab(HOME, true) })
