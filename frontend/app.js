/* ── Config ── */
var API = window.STAGEVAULT_API || 'https://mystagevault-backend.railway.app';

/* ── Device ID -- works on file://, http://, and https:// ── */
var DEVICE_ID = 'dev_local';
try {
  var stored = localStorage.getItem('msv_device_id');
  if (stored) {
    DEVICE_ID = stored;
  } else {
    DEVICE_ID = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('msv_device_id', DEVICE_ID);
  }
} catch(e) { /* file:// protocol -- use in-memory ID */ }

/* ── State ── */
var S = {
  page: 'discover',
  shelf: {},
  ratings: {},
  notes: {},
  shelfTab: 'read',
  search: { q: '', genre: 'All', era: 'All', cast: 'All', gender: 'All', theme: 'All' },
  mono: { gender: 'All', type: 'All' },
  sceneGender: 'All',
  detail: null,
  mobileNavOpen: false
};

/* ── API ── */
function apiFetch(path, opts) {
  return fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
    .then(function(r) { return r.json(); })
    .catch(function(e) { console.warn('API unavailable:', e.message); return null; });
}

function loadUserData() {
  return Promise.all([
    apiFetch('/api/shelf/' + DEVICE_ID),
    apiFetch('/api/ratings/' + DEVICE_ID),
    apiFetch('/api/notes/' + DEVICE_ID)
  ]).then(function(results) {
    if (results[0]) results[0].forEach(function(r) { S.shelf[r.play_key] = r.status; });
    if (results[1]) results[1].forEach(function(r) { S.ratings[r.play_key] = r.rating; });
    if (results[2]) results[2].forEach(function(r) { S.notes[r.play_key] = r.note; });
  });
}

function saveShelf(key, val) {
  if (val) apiFetch('/api/shelf/' + DEVICE_ID + '/' + encodeURIComponent(key), { method: 'PUT', body: JSON.stringify({ status: val }) });
  else apiFetch('/api/shelf/' + DEVICE_ID + '/' + encodeURIComponent(key), { method: 'DELETE' });
}

function saveRating(key, val) {
  apiFetch('/api/ratings/' + DEVICE_ID + '/' + encodeURIComponent(key), { method: 'PUT', body: JSON.stringify({ rating: val }) });
}

function saveNote(key) {
  var ta = document.getElementById('note-area');
  if (!ta) return;
  S.notes[key] = ta.value;
  apiFetch('/api/notes/' + DEVICE_ID + '/' + encodeURIComponent(key), { method: 'PUT', body: JSON.stringify({ note: ta.value }) });
  toast('Note saved');
}

/* ── Helpers ── */
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function enc(s) { return encodeURIComponent(s); }

function coverHTML(p, cls) {
  var c = p.color || hashColor(p.title || '');
  var i = playInitials(p.title || '?');
  if (p.cov) {
    return '<div class="' + cls + '" style="background:' + c + '">'
      + '<img src="https://covers.openlibrary.org/b/id/' + p.cov + '-M.jpg" alt="' + p.title + '" onerror="this.style.display=\'none\'">'
      + '</div>';
  }
  return '<div class="' + cls + '" style="background:' + c + ';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:500;font-style:italic;color:rgba(255,255,255,.92)">' + i + '</div>';
}

function shelfBtns(id) {
  var s = S.shelf[id] || null;
  return '<div class="shelf-btns" onclick="event.stopPropagation()">'
    + '<button class="sab' + (s === 'read' ? ' s-read' : '') + '" onclick="tog(\'' + id + '\',\'read\')">&#10003; Read</button>'
    + '<button class="sab' + (s === 'reading' ? ' s-reading' : '') + '" onclick="tog(\'' + id + '\',\'reading\')">Reading</button>'
    + '<button class="sab' + (s === 'want' ? ' s-want' : '') + '" onclick="tog(\'' + id + '\',\'want\')">&#9829; Want</button>'
    + '</div>';
}

function ribbonHTML(id) {
  var s = S.shelf[id];
  if (!s) return '';
  var labels = { read: '&#10003; Read', reading: 'Reading', want: '&#9829; Want' };
  return '<div class="ribbon r-' + s + '">' + labels[s] + '</div>';
}

function playCard(p) {
  var r = S.ratings[p.key || p.id] || 0;
  var starColor = r ? '#f59e0b' : '#e4e1da';
  return '<div class="play-card" onclick="openDetail(\'' + (p.key || p.id) + '\')">'
    + ribbonHTML(p.key || p.id)
    + coverHTML(p, 'cover')
    + '<div class="card-title">' + p.title + '</div>'
    + '<div class="card-author">' + p.author + '</div>'
    + '<div class="card-meta">'
    + '<span class="card-stars' + (r ? '' : ' dim') + '" style="color:' + starColor + '">&#9733;&#9733;&#9733;&#9733;&#9733;</span>'
    + '<span class="card-genre">' + p.genre + '</span>'
    + '</div>'
    + shelfBtns(p.key || p.id)
    + '</div>';
}

function cardsGrid(plays) {
  if (!plays.length) return '<div class="empty"><span class="empty-icon">&#128218;</span>Nothing here yet.</div>';
  return '<div class="cards-grid">' + plays.map(playCard).join('') + '</div>';
}

function scriptLinks(p) {
  var bq = enc(p.title + ' ' + p.author);
  return '<div class="get-script">'
    + '<span style="font-size:10px;color:#a09d97">Get the script:</span>'
    + '<a class="script-link" href="https://www.concordtheatricals.com/search#q=' + bq + '" target="_blank">Concord</a>'
    + '<a class="script-link" href="https://www.dramatists.com" target="_blank">DPS</a>'
    + '<a class="script-link" href="https://www.worldcat.org/search?q=' + bq + '&fq=dt:bks" target="_blank">Library</a>'
    + '</div>';
}

function gdot(g) {
  return '<span class="gdot dot-' + g + '"></span>';
}

/* ── Navigation ── */
function go(pg) {
  S.page = pg;
  S.mobileNavOpen = false;
  render();
}

function navItem(id, icon, label) {
  return '<div class="ni' + (S.page === id ? ' on' : '') + '" onclick="go(\'' + id + '\')">'
    + '<i class="ti ti-' + icon + '" aria-hidden="true"></i>' + label + '</div>';
}

/* ── Filter helpers ── */
function chips(items, active, fn) {
  return items.map(function(item) {
    var val = typeof item === 'object' ? item.val : item;
    var label = typeof item === 'object' ? item.label : item;
    return '<button class="chip' + (active === val ? ' on' : '') + '" onclick="' + fn + '(\'' + val + '\')">' + label + '</button>';
  }).join('');
}

function filterGroup(label, items, active, fn) {
  return '<div class="filter-group"><div class="filter-label">' + label + '</div>'
    + '<div class="chips">' + chips(items, active, fn) + '</div></div>';
}

/* ── Pages ── */
function pgDiscover() {
  var featured = PLAYS.slice(0, 12);
  var recent = PLAYS.slice(12, 24);
  return '<div class="pg-title">Featured plays</div>'
    + '<div class="pg-sub">50 plays in the vault and growing</div>'
    + cardsGrid(featured)
    + '<div class="pg-title" style="margin-top:24px">More plays</div>'
    + cardsGrid(recent);
}

function getFilteredPlays() {
  var q = S.search.q.toLowerCase();
  return PLAYS.filter(function(p) {
    var mq = !q
      || p.title.toLowerCase().indexOf(q) >= 0
      || p.author.toLowerCase().indexOf(q) >= 0
      || (p.themes || []).join(' ').indexOf(q) >= 0
      || (p.monos || []).some(function(m) { return m.ch && m.ch.toLowerCase().indexOf(q) >= 0; });
    var mg = S.search.genre === 'All' || p.genre === S.search.genre;
    var me = S.search.era === 'All' || p.era === S.search.era;
    var mc = S.search.cast === 'All' || p.cast === S.search.cast;
    var mgd = S.search.gender === 'All' || p.gender === S.search.gender;
    var mth = S.search.theme === 'All' || (p.themes || []).indexOf(S.search.theme) >= 0;
    return mq && mg && me && mc && mgd && mth;
  });
}

function pgSearch() {
  var genres = ['All','Drama','Comedy','Tragedy','Absurdist','Experimental','Musical'];
  var eras = ['All','1600s','1700s','1800s','1900s','1950s','1960s','1970s','1980s','1990s','2000s','2010s'];
  var casts = [
    {val:'All',label:'Any size'},
    {val:'solo',label:'Solo'},
    {val:'small',label:'Small (2-4)'},
    {val:'medium',label:'Medium (5-9)'},
    {val:'large',label:'Large (10+)'},
    {val:'flexible',label:'Flexible'}
  ];
  var genders = [
    {val:'All',label:'Any'},
    {val:'mixed',label:'Mixed'},
    {val:'female',label:'Female-led'},
    {val:'male',label:'Male-led'}
  ];
  var themes = ['All','queerness','race','family','identity','love','politics','gender','class','memory','religion','violence'];
  var results = getFilteredPlays();

  return '<div class="pg-title">Search</div>'
    + '<div class="pg-sub">Search by title, playwright, character name, or theme</div>'
    + filterGroup('Genre', genres, S.search.genre, 'setF_genre')
    + filterGroup('Era', eras, S.search.era, 'setF_era')
    + filterGroup('Cast size', casts, S.search.cast, 'setF_cast')
    + filterGroup('Gender focus', genders, S.search.gender, 'setF_gender')
    + filterGroup('Theme', themes.map(function(t) { return {val:t,label:t==='All'?'All themes':t}; }), S.search.theme, 'setF_theme')
    + '<div class="rc">' + results.length + ' play' + (results.length !== 1 ? 's' : '') + ' found</div>'
    + cardsGrid(results);
}

function pgShelf() {
  var counts = { read: 0, reading: 0, want: 0 };
  Object.keys(S.shelf).forEach(function(k) { if (counts[S.shelf[k]] !== undefined) counts[S.shelf[k]]++; });
  var mine = PLAYS.filter(function(p) { return S.shelf[p.key || p.id] === S.shelfTab; });

  return '<div class="pg-title">My shelf</div>'
    + '<div class="shelf-tabs">'
    + '<button class="stab' + (S.shelfTab === 'read' ? ' on' : '') + '" onclick="setST(\'read\')">'
    + '<span class="tdot" style="background:#0a5e47"></span>Read' + (counts.read ? ' (' + counts.read + ')' : '') + '</button>'
    + '<button class="stab' + (S.shelfTab === 'reading' ? ' on' : '') + '" onclick="setST(\'reading\')">'
    + '<span class="tdot" style="background:#154f8a"></span>Reading' + (counts.reading ? ' (' + counts.reading + ')' : '') + '</button>'
    + '<button class="stab' + (S.shelfTab === 'want' ? ' on' : '') + '" onclick="setST(\'want\')">'
    + '<span class="tdot" style="background:#8c2150"></span>Want to read' + (counts.want ? ' (' + counts.want + ')' : '') + '</button>'
    + '</div>'
    + (mine.length ? cardsGrid(mine) : '<div class="empty"><span class="empty-icon">&#128218;</span>Nothing here yet.<br>Hit Read, Reading, or Want on any play card.</div>');
}

function pgMono() {
  var genders = [{val:'All',label:'All genders'},{val:'Female',label:'Female'},{val:'Male',label:'Male'},{val:'Non-binary',label:'Non-binary'}];
  var types = [{val:'All',label:'All types'},{val:'Dramatic',label:'Dramatic'},{val:'Comedic',label:'Comedic'},{val:'Seriocomic',label:'Seriocomic'}];
  var items = [];
  PLAYS.forEach(function(p) {
    (p.monos || []).forEach(function(m) {
      var gm = m.g === 'f' ? 'Female' : m.g === 'm' ? 'Male' : 'Non-binary';
      if ((S.mono.gender === 'All' || S.mono.gender === gm) && (S.mono.type === 'All' || S.mono.type === m.t)) {
        items.push({ p: p, m: m, gm: gm });
      }
    });
  });

  var html = '<div class="pg-title">Monologues</div>'
    + '<div class="pg-sub">Click any card to open the play. Use the script links to read the actual text.</div>'
    + filterGroup('Character gender', genders, S.mono.gender, 'setMG')
    + filterGroup('Type', types, S.mono.type, 'setMT')
    + '<div class="rc">' + items.length + ' monologue' + (items.length !== 1 ? 's' : '') + '</div>';

  items.forEach(function(item) {
    var p = item.p, m = item.m;
    html += '<div class="mcard" onclick="openDetail(\'' + (p.key || p.id) + '\')">'
      + '<div class="mcard-top">' + gdot(m.g)
      + '<span class="mcard-char">' + m.ch + '</span>'
      + '<span class="mcard-from">in <strong>' + p.title + '</strong></span>'
      + '<span class="mbadge">' + m.t + '</span></div>'
      + '<div class="mcard-from" style="margin-bottom:4px">' + item.gm + ' &middot; ' + p.author + (p.year ? ' &middot; ' + p.year : '') + '</div>'
      + '<p class="mcard-desc">' + m.d + '</p>'
      + (m.ex ? '<div class="excerpt-box"><div class="excerpt-label">Sample text</div><p class="excerpt-text">' + m.ex + '</p><p class="excerpt-src">' + m.exsrc + '</p></div>' : '')
      + scriptLinks(p)
      + '</div>';
  });
  return html;
}

function pgScenes() {
  var mixes = [{val:'All',label:'All mixes'},{val:'F/F',label:'F/F'},{val:'M/M',label:'M/M'},{val:'M/F',label:'M/F'},{val:'Mixed/3+',label:'Mixed/3+'}];
  var items = [];
  PLAYS.forEach(function(p) {
    (p.scenes || []).forEach(function(s) {
      var fs = s.ch.filter(function(c) { return c.g === 'f'; }).length;
      var ms = s.ch.filter(function(c) { return c.g === 'm'; }).length;
      var mix = 'Mixed/3+';
      if (s.ch.length === 2) {
        if (fs === 2) mix = 'F/F';
        else if (ms === 2) mix = 'M/M';
        else if (fs === 1 && ms === 1) mix = 'M/F';
      }
      if (S.sceneGender === 'All' || S.sceneGender === mix) items.push({ p: p, s: s, mix: mix });
    });
  });

  var html = '<div class="pg-title">Scenes</div>'
    + '<div class="pg-sub">Two-handers and duologues. Use the script links to read the actual text.</div>'
    + filterGroup('Cast mix', mixes, S.sceneGender, 'setSG')
    + '<div class="rc">' + items.length + ' scene' + (items.length !== 1 ? 's' : '') + '</div>';

  items.forEach(function(item) {
    var p = item.p, s = item.s;
    html += '<div class="mcard" onclick="openDetail(\'' + (p.key || p.id) + '\')">'
      + '<div class="mcard-top">'
      + s.ch.map(function(c) { return gdot(c.g) + '<span class="mcard-char">' + c.n + '</span>'; }).join('<span style="color:#a09d97;margin:0 2px">&middot;</span>')
      + '<span class="mbadge">' + s.t + '</span><span class="mbadge">' + item.mix + '</span></div>'
      + '<div class="mcard-from" style="margin-bottom:4px">from <strong>' + p.title + '</strong> &middot; ' + p.author + '</div>'
      + '<p class="mcard-desc">' + s.d + '</p>'
      + scriptLinks(p)
      + '</div>';
  });
  return html;
}

/* ── Main render ── */
function render() {
  var pg = '';
  if (S.page === 'discover') pg = pgDiscover();
  else if (S.page === 'search') pg = pgSearch();
  else if (S.page === 'shelf') pg = pgShelf();
  else if (S.page === 'monologues') pg = pgMono();
  else if (S.page === 'scenes') pg = pgScenes();

  document.getElementById('app').innerHTML =
    '<div class="sidebar' + (S.mobileNavOpen ? ' mobile-open' : '') + '">'
    + '<div class="logo"><span class="logo-mark">&#127917;</span>'
    + '<div><div class="logo-name">My Stage Vault</div><div class="logo-tag">plays &middot; free &middot; theatre</div></div></div>'
    + '<nav>'
    + navItem('discover', 'compass', 'Discover')
    + navItem('search', 'search', 'Search')
    + navItem('shelf', 'books', 'My shelf')
    + navItem('monologues', 'microphone', 'Monologues')
    + navItem('scenes', 'users', 'Scenes')
    + '</nav></div>'
    + '<div class="main">'
    + '<div class="topbar">'
    + '<button class="menu-toggle" onclick="toggleNav()" aria-label="Menu">&#9776;</button>'
    + '<div class="search-wrap">'
    + '<i class="ti ti-search search-icon" aria-hidden="true"></i>'
    + '<input type="search" value="' + S.search.q.replace(/"/g, '&quot;') + '" oninput="onSearch(this.value)" placeholder="Title, playwright, character, theme...">'
    + '</div>'
    + '<button class="card-btn-top" onclick="showTheatreCard()">'
    + '<i class="ti ti-id" aria-hidden="true"></i><span>Theatre card</span></button>'
    + '</div>'
    + '<div class="content">' + pg + '</div>'
    + '</div>';
}

/* ── Actions ── */
function setST(t) { S.shelfTab = t; render(); }
function setMG(g) { S.mono.gender = g; render(); }
function setMT(t) { S.mono.type = t; render(); }
function setSG(g) { S.sceneGender = g; render(); }
function setF_genre(v) { S.search.genre = v; render(); }
function setF_era(v) { S.search.era = v; render(); }
function setF_cast(v) { S.search.cast = v; render(); }
function setF_gender(v) { S.search.gender = v; render(); }
function setF_theme(v) { S.search.theme = v; render(); }
function toggleNav() { S.mobileNavOpen = !S.mobileNavOpen; render(); }

var searchTimer;
function onSearch(v) {
  S.search.q = v;
  if (v && S.page !== 'search') S.page = 'search';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 200);
}

function tog(id, val) {
  if (S.shelf[id] === val) {
    delete S.shelf[id];
    saveShelf(id, null);
    toast('Removed from shelf');
  } else {
    S.shelf[id] = val;
    saveShelf(id, val);
    var L = { read: 'Added to Read', reading: 'Added to Reading', want: 'Added to Want to read' };
    toast(L[val]);
  }
  render();
  if (S.detail && (S.detail.key === id || String(S.detail.id) === String(id))) openDetail(id);
}

function setRating(id, val) {
  S.ratings[id] = val;
  saveRating(id, val);
  toast('Rated ' + val + '/5');
  render();
  if (S.detail) renderDetail(S.detail);
}

/* ── Detail panel ── */
function openDetail(id) {
  var p = null;
  for (var i = 0; i < PLAYS.length; i++) {
    if ((PLAYS[i].key || PLAYS[i].id) == id) { p = PLAYS[i]; break; }
  }
  if (!p) return;
  S.detail = p;
  renderDetail(p);
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}

function renderDetail(p) {
  var key = p.key || p.id;
  var r = S.ratings[key] || 0;
  var s = S.shelf[key] || null;
  var note = S.notes[key] || '';
  var bq = enc(p.title + ' ' + p.author);
  var recs = (p.rids || []).map(function(rid, i) {
    for (var j = 0; j < PLAYS.length; j++) {
      if ((PLAYS[j].key || PLAYS[j].id) == rid) return { p: PLAYS[j], why: (p.rwhy || [])[i] || 'Similar play' };
    }
    return null;
  }).filter(Boolean);

  function sodClass(val) { return s === val ? ' ' + (val === 'read' ? 'ar' : val === 'reading' ? 'ag' : 'aw') : ''; }

  var stars = '';
  for (var i = 1; i <= 5; i++) {
    stars += '<span class="rate-star' + (i <= r ? ' on' : '') + '" onclick="setRating(\'' + key + '\',' + i + ')" onmouseover="hoverStars(' + i + ')" onmouseout="unhoverStars(' + r + ')">&#9733;</span>';
  }

  var html = '<div class="dp-header">'
    + '<span class="dp-title">' + p.title + '</span>'
    + '<button class="dp-close" onclick="closeDp()">&#10005;</button>'
    + '</div><div class="dp-body">'
    + coverHTML(p, 'dp-cover')
    + '<div class="dp-play-title">' + p.title + '</div>'
    + '<div class="dp-author">' + p.author + (p.year ? ' &middot; ' + p.year : '') + '</div>'
    + '<div class="dp-tags">'
    + '<span class="card-genre">' + p.genre + '</span>'
    + (p.era ? '<span class="card-genre">' + p.era + '</span>' : '')
    + (p.cast ? '<span class="card-genre">Cast: ' + p.cast + '</span>' : '')
    + (p.runtime ? '<span class="card-genre">' + p.runtime + ' min</span>' : '')
    + (p.themes || []).map(function(t) { return '<span class="card-genre">' + t + '</span>'; }).join('')
    + '</div>'
    + '<p class="dp-desc">' + p.desc + '</p>'
    + '<div class="dp-sub">My rating</div>'
    + '<div class="rate-row" id="rate-row">' + stars + (r ? '<span class="rate-label">' + r + '/5</span>' : '') + '</div>'
    + '<div class="dp-sub">Add to shelf</div>'
    + '<div class="shelf-row">'
    + '<button class="shelf-opt' + sodClass('read') + '" onclick="tog(\'' + key + '\',\'read\')"><i class="ti ti-check" aria-hidden="true"></i>Read</button>'
    + '<button class="shelf-opt' + sodClass('reading') + '" onclick="tog(\'' + key + '\',\'reading\')"><i class="ti ti-book-open" aria-hidden="true"></i>Reading</button>'
    + '<button class="shelf-opt' + sodClass('want') + '" onclick="tog(\'' + key + '\',\'want\')"><i class="ti ti-heart" aria-hidden="true"></i>Want to read</button>'
    + '</div>'
    + '<div class="dp-sub">Get the script</div>'
    + '<div class="get-script">'
    + '<a class="script-link" href="https://www.concordtheatricals.com/search#q=' + bq + '" target="_blank">Concord Theatricals</a>'
    + '<a class="script-link" href="https://www.dramatists.com" target="_blank">Dramatists Play Service</a>'
    + '<a class="script-link" href="https://www.worldcat.org/search?q=' + bq + '&fq=dt:bks" target="_blank">WorldCat library</a>'
    + '</div>'
    + '<div class="dp-sub">My notes <span style="font-size:9px;font-weight:400;text-transform:none;letter-spacing:0">(private to you)</span></div>'
    + '<textarea class="note-area" id="note-area" placeholder="What struck you? What did you think?">' + note + '</textarea>'
    + '<div class="note-hint">&#128274; Only visible to you</div>'
    + '<button class="save-btn" onclick="saveNote(\'' + key + '\')">Save note</button>';

  if (recs.length) {
    html += '<div class="dp-sub">If you liked this, try...</div><div class="rec-list">';
    recs.forEach(function(rec) {
      var c = rec.p.color || hashColor(rec.p.title || '');
      var ri = playInitials(rec.p.title || '?');
      html += '<div class="rec-item" onclick="openDetail(\'' + (rec.p.key || rec.p.id) + '\')">'
        + '<div class="rec-thumb" style="background:' + c + '">'
        + (rec.p.cov ? '<img src="https://covers.openlibrary.org/b/id/' + rec.p.cov + '-S.jpg" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : ri)
        + '</div>'
        + '<div class="rec-info"><div class="rec-title">' + rec.p.title + '</div><div class="rec-why">' + rec.why + '</div></div>'
        + '<span style="color:#a09d97">&#8250;</span></div>';
    });
    html += '</div>';
  }

  if ((p.monos || []).length) {
    html += '<div class="dp-sub">Monologues from this play</div>';
    p.monos.forEach(function(m) {
      html += '<div class="mini-card"><div class="mini-top">' + gdot(m.g)
        + '<strong style="font-size:12px;color:#1a1916">' + m.ch + '</strong>'
        + '<span class="mbadge" style="margin-left:auto">' + m.t + '</span></div>'
        + '<p class="mini-desc">' + m.d + '</p></div>';
    });
  }

  if ((p.scenes || []).length) {
    html += '<div class="dp-sub">Scenes from this play</div>';
    p.scenes.forEach(function(sc) {
      html += '<div class="mini-card"><div class="mini-top">'
        + sc.ch.map(function(c) { return gdot(c.g) + '<span style="font-size:12px;font-weight:500;color:#1a1916">' + c.n + '</span>'; }).join('<span style="color:#a09d97;margin:0 2px">&middot;</span>')
        + '<span class="mbadge" style="margin-left:auto">' + sc.t + '</span></div>'
        + '<p class="mini-desc">' + sc.d + '</p></div>';
    });
  }

  html += '</div>';
  document.getElementById('detail-panel').innerHTML = html;
}

function closeDp() {
  S.detail = null;
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function hoverStars(n) {
  document.querySelectorAll('#rate-row .rate-star').forEach(function(el, i) {
    el.style.color = i < n ? '#f59e0b' : '#e4e1da';
  });
}
function unhoverStars(r) {
  document.querySelectorAll('#rate-row .rate-star').forEach(function(el, i) {
    el.style.color = i < r ? '#f59e0b' : '#e4e1da';
  });
}

/* ── Theatre card ── */
function showTheatreCard() {
  var readPlays = PLAYS.filter(function(p) { return S.shelf[p.key || p.id] === 'read'; }).slice(0, 5);
  var readingPlays = PLAYS.filter(function(p) { return S.shelf[p.key || p.id] === 'reading'; }).slice(0, 2);
  var totalRead = Object.values(S.shelf).filter(function(v) { return v === 'read'; }).length;
  var totalWant = Object.values(S.shelf).filter(function(v) { return v === 'want'; }).length;
  var totalRated = Object.keys(S.ratings).length;

  var cardHTML = '<div class="theatre-card">'
    + '<div class="tc-header"><div class="tc-logo">&#127917;</div>'
    + '<div><div class="tc-name">My Stage Vault</div><div class="tc-tag">plays &middot; free &middot; theatre</div></div></div>'
    + '<div class="tc-stats">'
    + '<div class="tc-stat"><div class="num">' + totalRead + '</div><div class="lbl">Read</div></div>'
    + '<div class="tc-stat"><div class="num">' + totalWant + '</div><div class="lbl">Want to read</div></div>'
    + '<div class="tc-stat"><div class="num">' + totalRated + '</div><div class="lbl">Rated</div></div>'
    + '</div>';

  if (readPlays.length) {
    cardHTML += '<div class="tc-section" style="margin-top:16px"><div class="tc-label">Plays I have read</div><div class="tc-plays">';
    readPlays.forEach(function(p) {
      var c = p.color || hashColor(p.title || '');
      cardHTML += '<div class="tc-play">'
        + '<div class="tc-play-cover" style="background:' + c + '">'
        + (p.cov ? '<img src="https://covers.openlibrary.org/b/id/' + p.cov + '-S.jpg" style="width:100%;height:100%;object-fit:cover">' : '')
        + '</div>'
        + '<div class="tc-play-info"><div class="title">' + p.title + '</div><div class="author">' + p.author + '</div></div>'
        + '</div>';
    });
    cardHTML += '</div></div>';
  }

  if (readingPlays.length) {
    cardHTML += '<div class="tc-section"><div class="tc-label">Currently reading</div>';
    readingPlays.forEach(function(p) {
      cardHTML += '<div class="tc-play"><div class="tc-play-cover" style="background:' + (p.color || '#888') + '">'
        + (p.cov ? '<img src="https://covers.openlibrary.org/b/id/' + p.cov + '-S.jpg" style="width:100%;height:100%;object-fit:cover">' : '')
        + '</div><div class="tc-play-info"><div class="title">' + p.title + '</div></div></div>';
    });
    cardHTML += '</div>';
  }

  cardHTML += '<div class="tc-footer">mystagevault.com &middot; scriptshelf.com</div></div>';

  var modal = document.getElementById('card-modal');
  modal.innerHTML = '<div class="card-modal-inner">'
    + '<button class="modal-close-x" onclick="closeCardModal()">&#10005;</button>'
    + '<h2 style="font-size:16px;font-weight:500;margin-bottom:4px;color:#1a1916">Your theatre card</h2>'
    + '<p style="font-size:12px;color:#6b6860;margin-bottom:14px">Screenshot this to share on social media</p>'
    + cardHTML
    + '<div class="modal-btns" style="margin-top:14px">'
    + '<button class="modal-btn" onclick="closeCardModal()">Close</button>'
    + '<button class="modal-btn primary" onclick="toast(\'Screenshot the card above to share it!\')">How to share</button>'
    + '</div></div>';
  modal.classList.add('show');
}

function closeCardModal() {
  document.getElementById('card-modal').classList.remove('show');
}

/* ── Toast ── */
var toastTimer;
function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, 2400);
}

/* ── Init -- render immediately, load backend data in background ── */
render();
loadUserData().then(function() { render(); });
