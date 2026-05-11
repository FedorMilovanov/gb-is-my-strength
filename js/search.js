/* ============================================================
   search.js — Command Palette v2.1
   Господь Бог — Сила Моя · gospod-bog.ru
   Two-column layout: results list + preview panel
   Scopes: Все / Статьи / Писание / Авторы
   History: localStorage 'gb-cp-history' (max 6)
   CSS: external css/command-palette.css (appended to site.css)
   ============================================================ */
(function () {
  'use strict';
 
  /* ─────────────────────────────────────────────────────────
     Inline SVG icons — mirrors lucide-react icons used in
     the original CommandPalette.tsx design
  ───────────────────────────────────────────────────────── */
  var SVG = {
    search17:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    search13:  '<svg width="13" height="13" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    search15:  '<svg width="15" height="15" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    search28:  '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    x:         '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    arrow:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    history:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.9L1 10"/></svg>',
    book14:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    book11:    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    book20:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    book12:    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    globe:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    zap:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sparkle:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    layers:    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    sparkle12: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    clock9:    '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    extLink:   '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    copy:      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check:     '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    user12:    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };
 
  /* ─────────────────────────────────────────────────────────
     Inject HTML — two-column Command Palette
     Left : input + scope chips + results list + footer
     Right: preview panel (hidden below 720px via CSS)
  ───────────────────────────────────────────────────────── */
  var backdrop = document.createElement('div');
  backdrop.className = 'cp-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Поиск по сайту');
  backdrop.innerHTML =
    '<div class="cp-bg"></div>' +
    '<div class="cp-dim"></div>' +
    '<div class="cp-box">' +
      '<div class="cp-spotlight"></div>' +
 
      /* ── Left column ── */
      '<div class="cp-left">' +
 
        '<div class="cp-input-wrap">' +
          '<span class="cp-search-icon">' + SVG.search17 + '</span>' +
          '<input class="cp-input" type="text" ' +
            'placeholder="Поиск по статьям, Писанию\u2026" ' +
            'autocomplete="off" autocorrect="off" autocapitalize="off" ' +
            'spellcheck="false" aria-label="\u041f\u043e\u0438\u0441\u043a" ' +
            'aria-autocomplete="list" aria-controls="cp-listbox">' +
          '<button class="cp-clear" style="display:none" ' +
            'aria-label="\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c">' + SVG.x + '</button>' +
        '</div>' +
 
        '<div class="cp-scope-row">' +
          '<div class="cp-scope-chips" role="tablist">' +
            '<button class="cp-scope-chip active" data-scope="all" role="tab" aria-selected="true">' +
              '<span class="cp-scope-icon">' + SVG.layers + '</span><span>\u0412\u0441\u0435</span>' +
            '</button>' +
            '<button class="cp-scope-chip" data-scope="articles" role="tab" aria-selected="false">' +
              '<span class="cp-scope-icon">' + SVG.book12 + '</span><span>\u0421\u0442\u0430\u0442\u044c\u0438</span>' +
            '</button>' +
            '<button class="cp-scope-chip" data-scope="scripture" role="tab" aria-selected="false">' +
              '<span class="cp-scope-icon">' + SVG.sparkle12 + '</span><span>\u041f\u0438\u0441\u0430\u043d\u0438\u0435</span>' +
            '</button>' +
            '<button class="cp-scope-chip" data-scope="authors" role="tab" aria-selected="false">' +
              '<span class="cp-scope-icon">' + SVG.user12 + '</span><span>\u0410\u0432\u0442\u043e\u0440\u044b</span>' +
            '</button>' +
          '</div>' +
          '<span class="cp-status" id="cp-status"></span>' +
        '</div>' +
 
        '<div class="cp-list" id="cp-listbox" role="listbox" ' +
          'aria-label="\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u043f\u043e\u0438\u0441\u043a\u0430"></div>' +
 
        '<div class="cp-footer">' +
          '<span class="cp-hint"><kbd>\u2191\u2193</kbd> \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f</span>' +
          '<span class="cp-hint"><kbd>\u21b5</kbd> \u043e\u0442\u043a\u0440\u044b\u0442\u044c</span>' +
          '<span class="cp-hint cp-hint-hide-mobile"><kbd>tab</kbd> \u043e\u0431\u043b\u0430\u0441\u0442\u044c</span>' +
          '<span class="cp-hint cp-hint-right"><kbd>esc</kbd> \u0437\u0430\u043a\u0440\u044b\u0442\u044c</span>' +
        '</div>' +
 
      '</div>' +
 
      /* ── Right preview column ── */
      '<div class="cp-preview-col" id="cp-preview-col">' +
        '<div class="cp-preview-placeholder">' +
          '<div class="cp-preview-placeholder-icon">' + SVG.book20 + '</div>' +
          '<span>\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440</span>' +
          '<p>\u041d\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430 \u0441\u0442\u0430\u0442\u044c\u044e, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438</p>' +
        '</div>' +
      '</div>' +
 
    '</div>';
 
  document.body.appendChild(backdrop);
 
  /* ─────────────────────────────────────────────────────────
     Element references
  ───────────────────────────────────────────────────────── */
  var box        = backdrop.querySelector('.cp-box');
  var input      = backdrop.querySelector('.cp-input');
  var clearBtn   = backdrop.querySelector('.cp-clear');
  var listEl     = document.getElementById('cp-listbox');
  var statusEl   = document.getElementById('cp-status');
  var previewCol = document.getElementById('cp-preview-col');
  var scopeChips = backdrop.querySelectorAll('.cp-scope-chip');
 
  /* ─────────────────────────────────────────────────────────
     State
  ───────────────────────────────────────────────────────── */
  var query        = '';
  var scope        = 'all';
  var activeIdx    = 0;
  var currentItems = [];
  var _searchGen   = 0;
  var _searchTimer = null;
  var _raf         = 0;
  var _prevFocus   = null;
  var _copiedTimer = null;
 
  /* ─────────────────────────────────────────────────────────
     History — localStorage key 'gb-cp-history'
  ───────────────────────────────────────────────────────── */
  var HISTORY_KEY = 'gb-cp-history';
 
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; }
  }
  function addToHistory(title) {
    var h    = getHistory();
    var next = [title].concat(h.filter(function (x) { return x !== title; })).slice(0, 6);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch (e) {}
  }
  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
  }
 
  /* ─────────────────────────────────────────────────────────
     String utilities
  ───────────────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
 
  function normalizeQ(s) {
    return String(s || '').toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[«»"'.,;!?:()\[\]{}–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
 
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
 
  /* highlight — wraps matched words in <mark class="cp-hl">.
     Regex runs on the RAW text; each segment is escHtml()-encoded
     separately so HTML entities are never corrupted by the match. */
  function highlight(text, q) {
    if (!q || q.length < 2) return escHtml(text);
    var words = normalizeQ(q).split(' ').filter(function (w) { return w.length > 1; });
    if (!words.length) return escHtml(text);
    try {
      var raw = String(text || '');
      var re  = new RegExp('(' + words.map(escRe).join('|') + ')', 'gi');
      var out  = '';
      var last = 0;
      var m;
      while ((m = re.exec(raw)) !== null) {
        out += escHtml(raw.slice(last, m.index));
        out += '<mark class="cp-hl">' + escHtml(m[0]) + '</mark>';
        last = m.index + m[0].length;
      }
      out += escHtml(raw.slice(last));
      return out;
    } catch (e) { return escHtml(text); }
  }
 
  /* Restyle Pagefind's plain <mark> tags with cp-hl class */
  function fixPagefindMarks(html) {
    return (html || '').replace(/<mark>/gi, '<mark class="cp-hl">');
  }
 
  /* Detect scripture reference patterns: "Мф 5", "Иер 17:9", "1 Кор 13", "1Кор 13" */
  function isScriptureRef(q) {
    return /^(\d\s*)?[а-яёa-z]{1,6}\s?\d/i.test((q || '').trim());
  }
 
  /* Category → icon */
  function catIcon(cat) {
    if (cat === 'Богословие')   return SVG.book14;
    if (cat === 'Герменевтика') return SVG.globe;
    if (cat === 'Апологетика')  return SVG.zap;
    return SVG.sparkle;
  }
 
  /* ─────────────────────────────────────────────────────────
     Pagefind lazy-load — same approach as v1, works from
     any depth (/nagornaya/chast-1/ → ../../pagefind/…)
  ───────────────────────────────────────────────────────── */
  var pagefindLoaded  = false;
  var pagefindLoading = false;
  var pagefindFailed  = false;

  function loadPagefind(cb) {
    if (pagefindLoaded)  { cb && cb(); return; }
    if (pagefindFailed)  { return; }
    if (pagefindLoading) { setTimeout(function () { loadPagefind(cb); }, 80); return; }
    pagefindLoading = true;

    var depth  = (window.location.pathname.match(/\//g) || []).length - 1;
    var prefix = depth > 0 ? Array(depth).fill('..').join('/') + '/' : '/';

    var script = document.createElement('script');
    script.type = 'module';
    script.textContent =
      "import('" + prefix + "pagefind/pagefind.js')" +
      ".then(function(p) {" +
      "  window.__pagefind__ = p;" +
      "  window.__pagefindReady__ = true;" +
      "}).catch(function(err) {" +
      "  console.error('[Pagefind] failed to load:', err);" +
      "  window.__pagefindFailed__ = true;" +
      "});";
    document.head.appendChild(script);

    var polls = 0;
    var poll  = setInterval(function () {
      polls++;
      if (window.__pagefindReady__) {
        clearInterval(poll);
        pagefindLoaded  = true;
        pagefindLoading = false;
        cb && cb();
      } else if (polls > 50) {
        /* else-if: success and timeout are mutually exclusive.
           Without this, a load on tick 51 would set both
           pagefindLoaded=true and pagefindFailed=true in the
           same callback, causing the HYGIENE-7 error screen to
           fire even though the index loaded successfully. */
        clearInterval(poll);
        pagefindLoading = false;
        pagefindFailed  = true;
        window.__pagefindFailed__ = true;
        console.warn('[Pagefind] load timeout after 5s');
        if (cb) cb();
      }
    }, 100);
  }
 
  /* ─────────────────────────────────────────────────────────
     Scroll lock / unlock
  ───────────────────────────────────────────────────────── */
  function lockScroll() {
    if (window.SiteUtils && typeof window.SiteUtils.lockScroll === 'function') {
      window.SiteUtils.lockScroll('command-palette');
    } else {
      document.documentElement.classList.add('cp-scroll-lock');
      document.body.style.overflow = 'hidden';
    }
  }
  function unlockScroll() {
    document.documentElement.classList.remove('cp-scroll-lock');
    if (window.SiteUtils && typeof window.SiteUtils.unlockScroll === 'function') {
      window.SiteUtils.unlockScroll('command-palette');
    } else {
      document.body.style.removeProperty('overflow');
    }
  }
 
  /* ─────────────────────────────────────────────────────────
     Open / Close
  ───────────────────────────────────────────────────────── */
  function openModal() {
    _prevFocus = document.activeElement;
    backdrop.classList.add('is-open');
    lockScroll();
    requestAnimationFrame(function () { input.focus(); });
    /* Show history / hint immediately — no pagefind needed */
    showDefault();
    loadPagefind(function () {
      /* Once pagefind is ready: re-run search only if the user
         already typed something (handles slow-load first-open) */
      if (input.value.trim()) runSearch(input.value.trim());
    });
  }
 
  function closeModal() {
    ++_searchGen;
    clearTimeout(_searchTimer);
    clearTimeout(_copiedTimer);
    backdrop.classList.remove('is-open');
    unlockScroll();
    input.value = '';
    query = '';
    clearBtn.style.display = 'none';
    currentItems = [];
    activeIdx    = 0;
    scope        = 'all';
    scopeChips.forEach(function (chip) {
      var isAll = chip.dataset.scope === 'all';
      chip.classList.toggle('active', isAll);
      chip.setAttribute('aria-selected', isAll ? 'true' : 'false');
    });
    listEl.innerHTML = '';
    statusEl.textContent = '';
    showPreviewPlaceholder();
    if (_prevFocus && _prevFocus.focus) _prevFocus.focus();
    _prevFocus = null;
  }
 
  /* ─────────────────────────────────────────────────────────
     Mouse spotlight — rAF-throttled CSS custom property update
  ───────────────────────────────────────────────────────── */
  box.addEventListener('mousemove', function (e) {
    cancelAnimationFrame(_raf);
    var cx = e.clientX, cy = e.clientY;
    _raf = requestAnimationFrame(function () {
      var r = box.getBoundingClientRect();
      box.style.setProperty('--mouse-x', (cx - r.left) + 'px');
      box.style.setProperty('--mouse-y', (cy - r.top) + 'px');
    });
  });
 
  /* ─────────────────────────────────────────────────────────
     Scope chips
  ───────────────────────────────────────────────────────── */
  function setScope(newScope) {
    scope = newScope;
    scopeChips.forEach(function (chip) {
      var isAct = chip.dataset.scope === scope;
      chip.classList.toggle('active', isAct);
      chip.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
    activeIdx = 0;
    if (query.length >= 2) runSearch(query);
    else showDefault();
  }
 
  scopeChips.forEach(function (chip) {
    chip.addEventListener('click', function () { setScope(chip.dataset.scope); input.focus(); });
  });
 
  /* ─────────────────────────────────────────────────────────
     Rendering helpers
  ───────────────────────────────────────────────────────── */
 
  function renderItemHTML(item, idx) {
    /* sub text: prefer subHtml (Pagefind excerpt), fall back to sub */
    var subContent = (item.subHtml && item.subHtml.trim()) ? item.subHtml
                   : (item.sub ? escHtml(item.sub) : '');
    var hasSub = !!subContent;
 
    var tags = (item.tags || []).map(function (t) {
      return '<span class="cp-item-tag">' + escHtml(t) + '</span>';
    }).join('');
 
    var hasFoot = item.meta || tags;
    var foot = hasFoot
      ? '<span class="cp-item-foot">' +
          (item.meta ? '<span class="cp-item-meta">' + escHtml(item.meta) + '</span>' : '') +
          tags +
        '</span>'
      : '';
 
    return (
      '<button class="cp-item" data-idx="' + idx + '" ' +
              'role="option" aria-selected="false" ' +
              'aria-label="' + escHtml(item.title) + '">' +
        '<span class="cp-item-icon">' + (item.icon || SVG.book14) + '</span>' +
        '<span class="cp-item-body">' +
          '<span class="cp-item-title">' + (item.titleHtml || escHtml(item.title)) + '</span>' +
          (hasSub ? '<span class="cp-item-sub">' + subContent + '</span>' : '') +
          foot +
        '</span>' +
        '<span class="cp-item-arrow">' + SVG.arrow + '</span>' +
      '</button>'
    );
  }
 
  function renderGroups(groups) {
    var flat = [];
    groups.forEach(function (g) {
      g.items.forEach(function (it) { flat.push(it); });
    });
    currentItems = flat;
 
    var html = '';
    var idx  = 0;
 
    groups.forEach(function (g) {
      html += '<div class="cp-group">';
      html +=   '<div class="cp-group-hd">' +
                  '<span>' + escHtml(g.name) + '</span>' +
                  '<span class="cp-group-count">' + g.items.length + '</span>' +
                '</div>';
      if (g.name === 'Недавние запросы') {
        html += '<button class="cp-history-clear" data-action="clear-history">Очистить историю</button>';
      }
      g.items.forEach(function (item) {
        html += renderItemHTML(item, idx++);
      });
      html += '</div>';
    });
 
    listEl.innerHTML = html;
    statusEl.textContent = flat.length + ' рез.';
 
    listEl.querySelectorAll('.cp-item').forEach(function (el) {
      var i = parseInt(el.dataset.idx, 10);
      el.addEventListener('mouseenter', function () { setActive(i, false); });
      el.addEventListener('click', function (e) {
        e.preventDefault();
        pickItem(currentItems[i]);
      });
    });
 
    var clrBtn = listEl.querySelector('[data-action="clear-history"]');
    if (clrBtn) {
      clrBtn.addEventListener('click', function () {
        clearHistory();
        showDefault();
      });
    }
 
    setActive(0, false);
  }
 
  function setActive(i, doScroll) {
    if (!currentItems.length) return;
    if (i < 0) i = 0;
    if (i >= currentItems.length) i = currentItems.length - 1;
    activeIdx = i;
 
    listEl.querySelectorAll('.cp-item').forEach(function (el, j) {
      var isAct = j === i;
      el.classList.toggle('is-active', isAct);
      el.setAttribute('aria-selected', isAct ? 'true' : 'false');
      var iconEl = el.querySelector('.cp-item-icon');
      if (iconEl) iconEl.classList.toggle('is-active', isAct);
    });
 
    if (doScroll !== false) {
      var actEl = listEl.querySelector('.cp-item.is-active');
      if (actEl) actEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
 
    var item = currentItems[i];
    if (item && item.article) renderPreview(item.article);
    else showPreviewPlaceholder();
  }
 
  /* ─────────────────────────────────────────────────────────
     Preview panel
  ───────────────────────────────────────────────────────── */
  function renderPreview(a) {
    var rawAuthor = String(a.author || '');
    var isEditor  = /^Редактор:/i.test(rawAuthor);
    var shortName = rawAuthor.replace(/^Редактор:\s*/i, '');
    var initial   = shortName.charAt(0).toUpperCase() || '?';
    var readTime  = a.readTime || 0;
    var readPct   = readTime ? Math.min((readTime / 40) * 100, 100).toFixed(1) : '0';

    var authorHTML = isEditor
      ? '<span class="cp-author-label">Редактор:</span> ' + escHtml(shortName)
      : escHtml(rawAuthor);

    /* Страница об авторе — особый макет: горизонтальная шапка с фото */
    var isAboutPage = !!(a.url && a.url.indexOf('/about') === 0);

    var imageBlock = '';
    if (isAboutPage && a.image) {
      imageBlock =
        '<div class="cp-preview-author-hero">' +
          '<img class="cp-preview-author-photo" src="' + escHtml(a.image) + '" alt="Фёдор Милованов" loading="lazy">' +
          '<div class="cp-preview-author-hero-info">' +
            '<p class="cp-preview-author-name-big">Фёдор Милованов</p>' +
            '<p class="cp-preview-author-role">Редактор-составитель · gospod-bog.ru</p>' +
          '</div>' +
        '</div>';
    } else if (a.image) {
      imageBlock =
        '<div class="cp-preview-img-wrap">' +
          '<img class="cp-preview-img" src="' + escHtml(a.image) + '" alt="" loading="lazy">' +
          (a.category ? '<span class="cp-preview-badge">' + escHtml(a.category) + '</span>' : '') +
        '</div>';
    }

    var html =
      '<div class="cp-preview-inner">' +
        imageBlock +
        '<div class="cp-preview-body">' +
          (isAboutPage ? '' :
            '<div class="cp-preview-author">' +
              '<span class="cp-preview-avatar">' + escHtml(initial) + '</span>' +
              '<span class="cp-preview-author-name">' + authorHTML + '</span>' +
              (readTime
                ? '<span class="cp-preview-time">' + SVG.clock9 + '<span>' + readTime + ' мин</span></span>'
                : '') +
            '</div>') +
          '<p class="cp-preview-title">' + escHtml(a.title || '') + '</p>' +
          (a.excerpt
            ? '<p class="cp-preview-excerpt">' + fixPagefindMarks(a.excerpt) + '</p>'
            : '') +
          (readTime && !isAboutPage
            ? '<div class="cp-preview-reading">' +
                SVG.clock9 +
                '<span>' + readTime + ' мин чтения</span>' +
                '<div class="cp-reading-bar">' +
                  '<div class="cp-reading-fill" style="width:' + readPct + '%"></div>' +
                '</div>' +
              '</div>'
            : '') +
          (a.scripture
            ? '<div class="cp-preview-scripture">' +
                SVG.book11 + '<span>' + escHtml(a.scripture) + '</span>' +
              '</div>'
            : '') +
          '<div class="cp-preview-actions">' +
            '<a href="' + escHtml(a.url || '#') + '" ' +
               'class="cp-preview-btn primary" id="cp-read-btn">' +
              (isAboutPage ? 'Об авторе ' : 'Читать ') + SVG.extLink +
            '</a>' +
            '<button class="cp-preview-btn secondary" id="cp-copy-btn">' +
              SVG.copy + ' Скопировать ссылку' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    previewCol.innerHTML = html;

    var readBtn = document.getElementById('cp-read-btn');
    if (readBtn) {
      readBtn.addEventListener('click', function () {
        if (a.title) addToHistory(a.title);
        closeModal();
      });
    }

    var copyBtn = document.getElementById('cp-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var copyText = 'https://gospod-bog.ru' + (a.url || '');

        function showCopied() {
          if (!copyBtn || !copyBtn.isConnected) return;
          copyBtn.innerHTML = SVG.check + ' Скопировано';
          clearTimeout(_copiedTimer);
          _copiedTimer = setTimeout(function () {
            if (copyBtn && copyBtn.isConnected) {
              copyBtn.innerHTML = SVG.copy + ' Скопировать ссылку';
            }
          }, 1600);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyText).then(showCopied).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }

        function fallbackCopy() {
          var ta = document.createElement('textarea');
          ta.value = copyText;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          showCopied();
        }
      });
    }
  }
 
  function showPreviewPlaceholder() {
    previewCol.innerHTML =
      '<div class="cp-preview-placeholder">' +
        '<div class="cp-preview-placeholder-icon">' + SVG.book20 + '</div>' +
        '<span>Предпросмотр</span>' +
        '<p>Наведите на статью, чтобы увидеть подробности</p>' +
      '</div>';
  }
 
  /* ─────────────────────────────────────────────────────────
     Empty state — "nothing found" with suggestion chips
  ───────────────────────────────────────────────────────── */
  var SUGGESTIONS = ['Нагорная проповедь', 'Иер 17:9', 'Код да Винчи', 'благодать', 'Павел'];
 
  function showEmpty() {
    var chips = SUGGESTIONS.map(function (s) {
      return '<button class="cp-sug-btn" data-sug="' + escHtml(s) + '">' + escHtml(s) + '</button>';
    }).join('');
 
    listEl.innerHTML =
      '<div class="cp-empty">' +
        '<div class="cp-empty-visual"><span class="cp-empty-icon">' + SVG.search28 + '</span></div>' +
        '<p class="cp-empty-title">Ничего не найдено</p>' +
        '<p class="cp-empty-sub">Попробуйте популярные запросы:</p>' +
        '<div class="cp-suggestions">' + chips + '</div>' +
      '</div>';
 
    statusEl.textContent = '0 рез.';
    currentItems = [];
    showPreviewPlaceholder();
 
    listEl.querySelectorAll('.cp-sug-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = btn.dataset.sug;
        input.value = s;
        query       = s;
        clearBtn.style.display = '';
        activeIdx   = 0;
        runSearch(s);
        input.focus();
      });
    });
  }
 
  /* ─────────────────────────────────────────────────────────
     Authors default state — shown when scope=authors, no query.
     NOTE: pagefind.search('') always returns zero results (by
     design), so we cannot enumerate all pages from the client.
     Show a static prompt with known-author suggestion chips
     instead — zero async work, no _searchGen races.
  ───────────────────────────────────────────────────────── */
  var AUTHOR_SUGGESTIONS = ['Фёдор', 'Абнер'];

  function showDefaultAuthors() {
    var chips = AUTHOR_SUGGESTIONS.map(function (s) {
      return '<button class="cp-sug-btn" data-sug="' + escHtml(s) + '">' +
               SVG.user12 + escHtml(s) +
             '</button>';
    }).join('');

    listEl.innerHTML =
      '<div class="cp-empty">' +
        '<div class="cp-empty-visual"><span class="cp-empty-icon">' + SVG.user12 + '</span></div>' +
        '<p class="cp-empty-title">Поиск по авторам</p>' +
        '<p class="cp-empty-sub">Введите имя — или выберите:</p>' +
        '<div class="cp-suggestions">' + chips + '</div>' +
      '</div>';

    statusEl.textContent = '';
    currentItems = [];
    showPreviewPlaceholder();

    listEl.querySelectorAll('.cp-sug-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = btn.dataset.sug;
        input.value = s;
        query       = s;
        clearBtn.style.display = '';
        activeIdx   = 0;
        runSearch(s);
        input.focus();
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     Default state — history items or prompt text
  ───────────────────────────────────────────────────────── */
  /* ─────────────────────────────────────────────────────────
     Curated picks — показываются в default state как fallback
     Обновлять при добавлении новых материалов
  ───────────────────────────────────────────────────────── */
  var CURATED_PICKS = [
    {
      url: '/nagornaya/seriya/',
      title: 'Нагорная проповедь — серия в 5 частях',
      excerpt: 'Сравнительное исследование Мф 5–7 и Лк 6:17–49 · 120+ источников',
      category: 'Богословие',
      readTime: 100,
      isFlagship: true
    },
    {
      url: '/articles/krajne-li-isporcheno-serdce/',
      title: 'Крайне ли испорчено моё сердце — если я уже верующий?',
      excerpt: 'Разбор Иеремии 17:9–10: экзегеза, синтез и пастырское применение',
      category: 'Экзегеза',
      readTime: 32
    },
    {
      url: '/articles/kod-da-vinchi/',
      title: '«Код да Винчи»: блестящий триллер или историческая подмена?',
      excerpt: 'Никея, канон Нового Завета, Свитки Мёртвого моря, Наг-Хаммади',
      category: 'Апологетика',
      readTime: 17
    },
    {
      url: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
      title: 'Герменевтическая оценка христоцентричной герменевтики',
      excerpt: 'Грамматико-исторический метод · Перевод Абнера Чау',
      category: 'Переводы',
      readTime: 35
    }
  ];

  function catIcon(cat) {
    if (cat === 'Апологетика') return SVG.shield || SVG.book14;
    return SVG.book14;
  }

  function curatedItem(p) {
    return {
      id: 'rec-' + p.url,
      title: p.title,
      titleHtml: escHtml(p.title),
      sub: p.excerpt,
      subHtml: escHtml(p.excerpt),
      icon: catIcon(p.category),
      meta: 'Редактор: Фёдор Милованов' + (p.readTime ? ' · ~' + p.readTime + ' мин' : ''),
      tags: p.isFlagship ? ['Серия', p.category] : [p.category],
      article: {
        url: p.url,
        title: p.title,
        author: 'Редактор: Фёдор Милованов',
        readTime: p.readTime || null,
        category: p.category,
        scripture: '',
        excerpt: p.excerpt,
        image: p.image || null
      }
    };
  }

  /* ── Search Manifest (lazy load) ───────────────────────── */
  var _manifestLoaded = false;
  var _manifestItems  = [];

  function loadSearchManifest(cb) {
    if (_manifestLoaded) { if (cb) cb(); return; }
    fetch('/data/search-manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        _manifestItems = (data && Array.isArray(data.items)) ? data.items : [];
        _manifestLoaded = true;
        if (cb) cb();
      })
      .catch(function () {
        _manifestItems = [];
        _manifestLoaded = true;
        if (cb) cb();
      });
  }

  function manifestToItem(x) {
    return {
      id: 'mf-' + (x.id || x.url),
      title: x.title,
      titleHtml: escHtml(x.title),
      sub: x.description || '',
      subHtml: escHtml(x.description || ''),
      icon: SVG.book14,
      meta: (x.editor ? 'Редактор: ' + x.editor : '') + (x.readTime ? ' · ~' + x.readTime + ' мин' : ''),
      tags: x.type === 'series' ? ['Серия'] : (x.tags ? x.tags.slice(0, 2) : []),
      article: { url: x.url, title: x.title, author: x.author || x.editor || '', category: x.section || '', image: x.image || null, readTime: x.readTime || null, scripture: x.scripture || null, excerpt: x.description || '' }
    };
  }

  function resumeToItem(resume) {
    return {
      id: 'res-' + resume.path,
      title: resume.title || resume.path,
      titleHtml: escHtml(resume.title || resume.path),
      sub: resume.sectionTitle ? 'Раздел: ' + resume.sectionTitle : '',
      subHtml: resume.sectionTitle ? 'Раздел: ' + escHtml(resume.sectionTitle) : '',
      meta: (resume.progress || 0) + '%',
      icon: SVG.book14,
      article: { url: resume.path, title: resume.title || resume.path },
      tags: ['закладка']
    };
  }

  function showDefault() {
    /* Authors scope with no query → show author browser */
    if (scope === 'authors') { showDefaultAuthors(); return; }

    loadSearchManifest(function () {
      var groups = [];

      /* 1. Продолжить чтение (из BookmarkEngine) */
      if (window.BookmarkEngine && typeof window.BookmarkEngine.getResumeCandidate === 'function') {
        var resume = window.BookmarkEngine.getResumeCandidate();
        if (resume && resume.path) {
          groups.push({ name: 'Продолжить', items: [resumeToItem(resume)] });
        }
      }

      /* 2. Недавние запросы */
      var hist = getHistory();
      if (hist.length) {
        groups.push({
          name: 'Недавние запросы',
          items: hist.slice(0, 4).map(function (h, i) {
            return { id: 'h'+i, title: h, titleHtml: highlight(h, ''), icon: SVG.history, isHistory: true };
          })
        });
      }

      /* 3. Рекомендуемое из манифеста (featured: true), иначе curated */
      var featured = _manifestItems
        .filter(function (x) { return x.featured; })
        .sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); })
        .slice(0, 5)
        .map(manifestToItem);
      if (featured.length) {
        groups.push({ name: 'Рекомендуемое', items: featured });
      } else {
        groups.push({ name: 'Популярные исследования', items: CURATED_PICKS.map(curatedItem) });
      }

      /* 4. Новое (по modifiedTime, только non-featured) */
      var recent = _manifestItems
        .filter(function (x) { return !x.featured; })
        .sort(function (a, b) { return Date.parse(b.modifiedTime || 0) - Date.parse(a.modifiedTime || 0); })
        .slice(0, 3)
        .map(manifestToItem);
      if (recent.length) groups.push({ name: 'Новое', items: recent });

      if (groups.length) renderGroups(groups);
      else showDefaultHint();
    });
  }

  function showDefaultHint() {
    listEl.innerHTML =
      '<div class="cp-default-hint">' +
        'Начните вводить запрос — Нагорная проповедь, Иер 17, благодать\u2026' +
      '</div>';
    statusEl.textContent = '';
    currentItems = [];
    showPreviewPlaceholder();
  }
 
  /* ─────────────────────────────────────────────────────────
     Scope filter (client-side, runs after Pagefind returns)
  ───────────────────────────────────────────────────────── */
  function filterByScope(items) {
    if (scope === 'all')       return items;
    if (scope === 'articles')  return items.filter(function (it) { return !it.isScripture; });
    if (scope === 'scripture') return items.filter(function (it) {
      return it.isScripture || (it.article && it.article.scripture);
    });
    /* authors: return everything — runSearch groups results by author name */
    if (scope === 'authors')   return items;
    return items;
  }
 
  /* ─────────────────────────────────────────────────────────
     Main search — Pagefind → load data → filter → render
  ───────────────────────────────────────────────────────── */
  function runSearch(q) {
    if (!q || q.length < 2) { showDefault(); return; }

    /* HYGIENE-7: pagefind failed to load — show actionable error, not
       infinite "Загружаю индекс…".  loadPagefind() returns immediately
       when pagefindFailed=true, so the callback never fires. */
    if (pagefindFailed) {
      listEl.innerHTML =
        '<div class="cp-empty">' +
          '<p class="cp-empty-title">Поиск недоступен</p>' +
          '<p class="cp-empty-sub">Не удалось загрузить индекс. ' +
          'Обновите страницу и попробуйте снова.</p>' +
        '</div>';
      statusEl.textContent = '';
      currentItems = [];
      showPreviewPlaceholder();
      return;
    }

    if (!window.__pagefind__) {
      listEl.innerHTML =
        '<div class="cp-loading">Загружаю индекс\u2026</div>';
      /* Pagefind is still loading — retry once it is ready.
         Guard with current query so a cleared input does not
         resurrect results for a query the user already discarded. */
      loadPagefind(function () { if (query === q) runSearch(q); });
      return;
    }
 
    listEl.innerHTML = '<div class="cp-loading">Ищу\u2026</div>';
    var gen = ++_searchGen;
 
    window.__pagefind__.search(q).then(function (res) {
      if (gen !== _searchGen) return;
      if (!res || !res.results || !res.results.length) { showEmpty(); return; }
 
      var limited = res.results.slice(0, 10);
      Promise.all(limited.map(function (r) { return r.data(); })).then(function (raw) {
        if (gen !== _searchGen) return;
 
        var qNorm      = normalizeQ(q);
        var isScripRef = isScriptureRef(q);
        var scriptureItems = [];
        var articleItems   = [];
        var seen = {};
 
        raw.forEach(function (item) {
          var url      = item.url || '';
          if (seen[url]) return;
          seen[url] = true;
 
          var title    = (item.meta && item.meta.title)    || 'Без названия';
          var author   = (item.meta && item.meta.author)   || '';
          var readTime = parseInt((item.meta && item.meta.readTime) || '0', 10) || 0;
          var category = (item.meta && item.meta.category) || '';
          var scripture= (item.meta && item.meta.scripture)|| '';
          var image    = (item.meta && item.meta.image)    || '';
 
          var article = {
            url:      url,
            title:    title,
            author:   author    || null,
            readTime: readTime  || null,
            category: category  || null,
            scripture:scripture || null,
            image:    image     || null,
            excerpt:  item.excerpt || ''
          };
 
          /* Scripture group — only when query looks like a scripture ref */
          if (isScripRef && scripture) {
            var scripNorm = normalizeQ(scripture);
            var firstWord = qNorm.split(' ')[0];
            if (firstWord && scripNorm.indexOf(firstWord) !== -1) {
              scriptureItems.push({
                id:        'scr-' + url,
                title:     scripture,
                titleHtml: highlight(scripture, q),
                sub:       title,
                subHtml:   highlight(title, q),
                icon:      SVG.book14,
                tags:      ['Ссылка'],
                article:   article,
                isScripture: true
              });
            }
          }
 
          /* Article group */
          var shortAuthor = author;
          var meta = shortAuthor
            ? (shortAuthor + (readTime ? ' · ' + readTime + ' мин' : ''))
            : (readTime ? readTime + ' мин' : null);
 
          var tags = [];
          if (category)  tags.push(category);
          if (scripture) tags.push(scripture);
 
          articleItems.push({
            id:        'art-' + url,
            title:     title,
            titleHtml: highlight(title, q),
            sub:       item.excerpt || null,
            subHtml:   fixPagefindMarks(item.excerpt || ''),
            icon:      catIcon(category),
            meta:      meta,
            tags:      tags,
            article:   article,
            isScripture: false
          });
        });
 
        /* Combine: scripture first, then articles
           In scripture scope, skip article duplicates */
        var allItems = scriptureItems.slice();
        var scripUrls = {};
        scriptureItems.forEach(function (it) { scripUrls[it.article.url] = true; });
        articleItems.forEach(function (it) {
          if (scope === 'scripture' && scripUrls[it.article.url]) return;
          allItems.push(it);
        });
 
        var filtered = filterByScope(allItems);
        if (!filtered.length) { showEmpty(); return; }
 
        var groups = [];
        var scripGroup = filtered.filter(function (it) { return it.isScripture; });
        var artGroup   = filtered.filter(function (it) { return !it.isScripture; });

        /* Authors scope: group results by author name */
        if (scope === 'authors') {
          var byAuthor = {};
          var authorOrder = [];
          artGroup.concat(scripGroup).forEach(function (it) {
            var a = (it.article && it.article.author)
              ? it.article.author.replace(/^Редактор:\s*/i, '')
              : 'Без автора';
            if (!byAuthor[a]) { byAuthor[a] = []; authorOrder.push(a); }
            byAuthor[a].push(it);
          });
          authorOrder.forEach(function (a) {
            groups.push({ name: a, items: byAuthor[a] });
          });
        } else {
          if (scripGroup.length) groups.push({ name: 'Писание', items: scripGroup });
          if (artGroup.length)   groups.push({ name: 'Статьи',  items: artGroup });
        }
 
        renderGroups(groups);
 
      }).catch(function () { if (gen !== _searchGen) return; showEmpty(); });
 
    }).catch(function () { if (gen !== _searchGen) return; showEmpty(); });
  }
 
  /* ─────────────────────────────────────────────────────────
     Input events
  ───────────────────────────────────────────────────────── */
  input.addEventListener('input', function () {
    query = input.value.trim();
    clearBtn.style.display = query ? '' : 'none';
    clearTimeout(_searchTimer);
    activeIdx = 0;
    _searchTimer = setTimeout(function () {
      if (query.length >= 2) runSearch(query);
      else showDefault();
    }, 180);
  });
 
  clearBtn.addEventListener('click', function () {
    input.value = '';
    query = '';
    clearBtn.style.display = 'none';
    clearTimeout(_searchTimer);
    activeIdx = 0;
    showDefault();
    input.focus();
  });
 
  /* ─────────────────────────────────────────────────────────
     Pick item (click or Enter)
  ───────────────────────────────────────────────────────── */
  function pickItem(item) {
    if (!item) return;
    if (item.isHistory) {
      /* Replay the saved query */
      input.value = item.title;
      query       = item.title;
      clearBtn.style.display = '';
      activeIdx   = 0;
      runSearch(item.title);
      input.focus();
      return;
    }
    if (item.article) {
      addToHistory(item.article.title || item.title);
      window.location.href = item.article.url;
    }
    closeModal();
  }
 
  /* ─────────────────────────────────────────────────────────
     Keyboard navigation
  ───────────────────────────────────────────────────────── */
  input.addEventListener('keydown', function (e) {
    var total = currentItems.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(Math.min(activeIdx + 1, total - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(Math.max(activeIdx - 1, 0));
        break;
      case 'PageDown':
        e.preventDefault();
        setActive(Math.min(activeIdx + 5, total - 1));
        break;
      case 'PageUp':
        e.preventDefault();
        setActive(Math.max(activeIdx - 5, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(total - 1);
        break;
      case 'Enter':
        e.preventDefault();
        pickItem(currentItems[activeIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        /* Always stop bubbling: document-level handler must not see this
           event — whether we clear the query or close the modal, only one
           action should happen per keypress. */
        e.stopPropagation();
        if (query) {
          /* Clear query only — do not close modal */
          input.value = '';
          query = '';
          clearBtn.style.display = 'none';
          /* HYGIENE-8: cancel any pending debounced search so it
             does not call showDefault() again ~180 ms later */
          clearTimeout(_searchTimer);
          activeIdx = 0;
          showDefault();
        } else {
          closeModal();
        }
        break;
      case 'Tab':
        /* Tab / Shift+Tab cycles through scope chips */
        e.preventDefault();
        var scopes = ['all', 'articles', 'scripture', 'authors'];
        var dir = e.shiftKey ? -1 : 1;
        var cur = scopes.indexOf(scope);
        setScope(scopes[(cur + dir + scopes.length) % scopes.length]);
        break;
    }
  });
 
  /* ─────────────────────────────────────────────────────────
     Global shortcut ⌘K / Ctrl+K
  ───────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      backdrop.classList.contains('is-open') ? closeModal() : openModal();
    }
    if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
      closeModal();
    }
  });

  /* Кнопка поиска в articles navbar */
  var navSearchBtn = document.getElementById('hCpBtnNav');
  if (navSearchBtn) {
    navSearchBtn.addEventListener('click', function () { openModal(); });
  }
  window.addEventListener('gb:openSearch', function () { openModal(); });
 
  /* ─────────────────────────────────────────────────────────
     Close on backdrop / blur-overlay click
  ───────────────────────────────────────────────────────── */
  backdrop.addEventListener('click', function (e) {
    var t = e.target;
    if (t === backdrop || t.classList.contains('cp-bg') || t.classList.contains('cp-dim')) {
      closeModal();
    }
  });
 
  /* ─────────────────────────────────────────────────────────
     Inject search button into nav
     Preserves all v1 selectors — works on every page type
  ───────────────────────────────────────────────────────── */
  function injectSearchButton() {
    function alreadyInjected() { return !!document.getElementById('gbSearchBtn'); }
 
    /* Home page nav list */
    var hNavLinks = document.querySelector('.h-nav-links');
    if (hNavLinks && !alreadyInjected()) {
      var li = document.createElement('li');
      var b0 = document.createElement('button');
      b0.className = 'gb-search-btn'; b0.id = 'gbSearchBtn';
      b0.setAttribute('aria-label', 'Поиск (⌘K)');
      b0.setAttribute('title', 'Поиск ⌘K');
      b0.innerHTML = SVG.search15 + '<span>Поиск</span><span class="kb">⌘K</span>';
      li.appendChild(b0);
      hNavLinks.insertBefore(li, hNavLinks.firstChild);
      wireBtn(); return;
    }
 
    /* Article pages — .article-topnav */
    var topnav = document.querySelector('.article-topnav');
    if (topnav && !alreadyInjected()) {
      var b1 = document.createElement('button');
      b1.className = 'gb-search-btn'; b1.id = 'gbSearchBtn';
      b1.setAttribute('aria-label', 'Поиск (⌘K)');
      b1.setAttribute('title', 'Поиск ⌘K');
      b1.innerHTML = SVG.search13;
      b1.style.cssText = 'margin-left:auto;margin-right:8px;padding:5px 8px;';
      topnav.appendChild(b1);
      wireBtn(); return;
    }
 
    /* Nagornaya series — before #menuBtn */
    var menuBtn = document.getElementById('menuBtn');
    if (menuBtn && !alreadyInjected()) {
      var b2 = document.createElement('button');
      b2.className = 'gb-search-btn'; b2.id = 'gbSearchBtn';
      b2.setAttribute('aria-label', 'Поиск (⌘K)');
      b2.setAttribute('title', 'Поиск ⌘K');
      b2.style.cssText = 'background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.15);color:#e7e5e4;margin-right:8px;';
      b2.innerHTML = SVG.search15;
      menuBtn.parentNode.insertBefore(b2, menuBtn);
      wireBtn(); return;
    }
 
    /* Fallback — any nav ul */
    var nav = document.querySelector('nav[role="navigation"] ul,.nav-links,.h-nav-links');
    if (nav && !alreadyInjected()) {
      var li2 = document.createElement('li');
      var b3  = document.createElement('button');
      b3.className = 'gb-search-btn'; b3.id = 'gbSearchBtn';
      b3.setAttribute('aria-label', 'Поиск (⌘K)');
      b3.setAttribute('title', 'Поиск ⌘K');
      b3.innerHTML = SVG.search13 + '<span>Поиск</span><span class="kb">⌘K</span>';
      li2.appendChild(b3);
      nav.insertBefore(li2, nav.firstChild);
      wireBtn();
    }
  }
 
  function wireBtn() {
    document.querySelectorAll('#gbSearchBtn').forEach(function (b) {
      b.addEventListener('click', openModal);
    });
  }
 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSearchButton);
  } else {
    injectSearchButton();
  }
 
  showDefault();
 
  /* ─────────────────────────────────────────────────────────
     Public API
  ───────────────────────────────────────────────────────── */
  window.GBSearch = { open: openModal, close: closeModal };
 
})();
