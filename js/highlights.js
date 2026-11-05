/* Unified reader library. Existing quote/favorite keys remain authoritative.
 * Saved article buttons and GBFavoriteStore keep their original owners.
 * Library owns only the combined read UI, quotations, and personal notes.
 */
(function () {
  'use strict';
  if (window.GBHighlights && window.GBHighlights.libraryVersion === 2) return;

  const QUOTES_KEY = 'gb-highlights-v1';
  const NOTES_KEY = 'gb-reader-notes-v1';
  const FAVORITES_KEY = 'gb-favorites';
  const LIMIT_QUOTES = 200;
  const LIMIT_NOTES = 500;
  const BATCH_SIZE = 30;
  const quoteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4V4z"/></svg>';
  const bookSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-3-2-6-2-9-1v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v13"/></svg>';
  const penSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/></svg>';
  const closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>';
  const searchSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';

  function normalizeText(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function gbHighlightPath(item) {
    const raw = String(item && item.url || '');
    try { return new URL(raw, location.origin).pathname.replace(/\/+$/, '') || '/'; }
    catch { return raw.split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '') || '/'; }
  }
  function gbHighlightText(item) { return normalizeText(item && item.text).toLocaleLowerCase(); }
  function gbHighlightKey(item) {
    const text = gbHighlightText(item);
    return text ? gbHighlightPath(item) + '\n' + text : '';
  }
  function gbDedupeHighlights(items) {
    const seen = new Set();
    const result = [];
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const key = gbHighlightKey(item) || '__invalid__:' + (item && item.id || index);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(item);
    });
    return result;
  }
  function gbAddHighlight(items, item) {
    const existing = gbDedupeHighlights(items);
    const key = gbHighlightKey(item);
    return key && !existing.some((entry) => gbHighlightKey(entry) === key)
      ? [item].concat(existing).slice(0, LIMIT_QUOTES) : existing;
  }
  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(value)) return value;
      if (key === FAVORITES_KEY && Array.isArray(value && value.items)) return value.items;
    } catch {}
    return [];
  }
  function write(key, items) {
    try { localStorage.setItem(key, JSON.stringify(items)); return true; }
    catch { return false; }
  }
  function quotes() {
    const existing = read(QUOTES_KEY);
    const compact = gbDedupeHighlights(existing);
    if (existing.length !== compact.length) write(QUOTES_KEY, compact);
    return compact;
  }
  function notes() { return read(NOTES_KEY).filter((n) => n && typeof n.text === 'string' && n.id); }
  function favorites() {
    const store = window.GBFavoriteStore;
    return store && typeof store.list === 'function' ? store.list({ persistMigration: false }) : read(FAVORITES_KEY);
  }
  function localUrl(value) {
    try {
      const url = new URL(value || '', location.origin);
      if (url.origin === location.origin && /^https?:$/.test(url.protocol)) return url.pathname + url.search + url.hash;
    } catch {}
    return '';
  }
  function all() {
    const q = quotes().map((x) => ({ id: String(x.id), type: 'quote', text: String(x.text || ''), title: String(x.articleTitle || 'Статья'), url: localUrl(x.url), savedAt: Number(x.savedAt) || 0 }));
    const n = notes().map((x) => ({ id: String(x.id), type: 'note', text: String(x.text || ''), quoteText: String(x.quoteText || ''), title: String(x.articleTitle || 'Статья'), url: localUrl(x.url), savedAt: Number(x.savedAt) || 0 }));
    const f = favorites().map((x) => ({ id: String(x.path || x.url || ''), type: 'favorite', text: String(x.description || ''), title: String(x.title || 'Статья'), url: localUrl(x.path || x.url), savedAt: Number(x.addedAt || x.savedAt) || 0 }));
    return q.concat(n, f).sort((a, b) => b.savedAt - a.savedAt);
  }
  function currentTitle() { return normalizeText(document.title.replace(/\s*[·—|].*$/, '')) || 'Статья'; }
  function fragment(text) {
    const words = normalizeText(text).split(/\s+/);
    return words.length <= 14 ? 'text=' + encodeURIComponent(text)
      : 'text=' + encodeURIComponent(words.slice(0, 6).join(' ')) + ',' + encodeURIComponent(words.slice(-6).join(' '));
  }
  let lastSelection = { text: '', anchor: '', url: '' };
  function rememberSelection() {
    const selection = window.getSelection && window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = normalizeText(selection.toString());
    if (text.length < 8) return;
    let anchor = '';
    try {
      const root = document.querySelector('article,main,[data-pagefind-body]') || document.body;
      for (let e = selection.getRangeAt(0).commonAncestorContainer; e && e !== root.parentElement; e = e.parentElement) {
        if (e.nodeType === 1 && e.id) { anchor = e.id; break; }
      }
    } catch {}
    lastSelection = { text, anchor, url: location.href };
    window.__ssLastText__ = text;
    window.__ssLastTextUrl__ = location.href;
  }
  function selection() {
    rememberSelection();
    return lastSelection.url === location.href ? lastSelection : { text: '', anchor: '', url: '' };
  }
  function sourceUrl(selected) {
    return location.origin + location.pathname + '#' +
      (selected.anchor ? encodeURIComponent(selected.anchor) : '') + ':~:' + fragment(selected.text);
  }
  function uid(prefix) { return prefix + Date.now() + Math.random().toString(36).slice(2, 7); }
  function savedDate(timestamp) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  let overlay, panel, list, fab, titleCount, search, sourceSelect, status, editor, textArea;
  let tab = 'all', filter = 'all', searchTerm = '', shown = BATCH_SIZE, opener = null;
  let expanded = new Set(), draft = null, pendingUndo = null;
  const stylesheet = document.createElement('link');
  stylesheet.id = 'gbHlRuntimeCss';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/css/highlights-runtime.css?v=aef2b37f';
  if (!document.getElementById(stylesheet.id)) document.head.appendChild(stylesheet);

  function button(action, label, text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.libraryAction = action;
    b.setAttribute('aria-label', label);
    b.textContent = text;
    return b;
  }
  function element(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = value;
    return node;
  }
  function isOpen() { return Boolean(overlay && overlay.classList.contains('is-open')); }
  function statusMessage(message, error) {
    if (!status) return;
    status.replaceChildren(element('span', '', message));
    status.classList.add('is-visible');
    status.classList.toggle('is-error', Boolean(error));
    clearTimeout(statusMessage.timer);
    statusMessage.timer = setTimeout(() => { if (!pendingUndo) status.classList.remove('is-visible'); }, 5000);
  }
  function create() {
    if (!document.body || document.getElementById('gb-hl-backdrop')) return;
    overlay = document.createElement('div');
    overlay.id = 'gb-hl-backdrop';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    overlay.innerHTML = [
      '<section id="gb-hl-panel" role="dialog" aria-modal="true" aria-labelledby="gb-hl-title" tabindex="-1">',
      '<div id="gb-hl-handle" aria-hidden="true"></div>',
      '<header id="gb-hl-header"><div class="gb-hl-heading"><span class="gb-hl-eyebrow">ЛИЧНОЕ СОБРАНИЕ</span>',
      '<h2 id="gb-hl-title">Моя библиотека <span id="gb-hl-count"></span></h2></div>',
      '<button type="button" id="gb-hl-export" aria-label="Экспорт библиотеки в Markdown">↓ Markdown</button>',
      '<button type="button" id="gb-hl-close" aria-label="Закрыть библиотеку">' + closeSvg + '</button></header>',
      '<nav id="gb-hl-tabs" aria-label="Тип сохранений">',
      '<button type="button" data-library-tab="all" aria-pressed="true">Все</button>',
      '<button type="button" data-library-tab="quote" aria-pressed="false">Цитаты</button>',
      '<button type="button" data-library-tab="note" aria-pressed="false">Заметки</button>',
      '<button type="button" data-library-tab="favorite" aria-pressed="false">Статьи</button></nav>',
      '<div id="gb-hl-tools"><label id="gb-hl-searchwrap">' + searchSvg,
      '<input id="gb-hl-search" type="search" placeholder="Найти в сохранениях…" aria-label="Поиск по сохранениям" autocomplete="off"></label>',
      '<select id="gb-hl-source" aria-label="Фильтр по исходной статье"><option value="all">Все статьи</option></select></div>',
      '<div id="gb-hl-list" tabindex="0" aria-label="Сохранённые материалы"></div>',
      '<div id="gb-hl-status" role="status" aria-live="polite"></div>',
      '<form id="gb-hl-editor" hidden><label for="gb-hl-note-text">Личная заметка</label>',
      '<div id="gb-hl-note-context"></div><textarea id="gb-hl-note-text" rows="4" maxlength="16000" placeholder="Что вы хотите запомнить?"></textarea>',
      '<div class="gb-hl-editor-actions"><button type="button" id="gb-hl-note-cancel">Отмена</button>',
      '<button type="submit">Сохранить заметку</button></div></form>',
      '<footer id="gb-hl-foot"><button type="button" id="gb-hl-new-note">' + penSvg + ' Новая заметка</button></footer>',
      '</section>',
    ].join('');
    document.body.append(overlay);
    panel = overlay.querySelector('#gb-hl-panel');
    list = overlay.querySelector('#gb-hl-list');
    titleCount = overlay.querySelector('#gb-hl-count');
    search = overlay.querySelector('#gb-hl-search');
    sourceSelect = overlay.querySelector('#gb-hl-source');
    status = overlay.querySelector('#gb-hl-status');
    editor = overlay.querySelector('#gb-hl-editor');
    textArea = overlay.querySelector('#gb-hl-note-text');
    fab = document.createElement('button');
    fab.id = 'gb-hl-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Моя библиотека');
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-controls', 'gb-hl-panel');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = bookSvg + '<span id="gb-hl-fab-count" aria-hidden="true"></span>';
    document.body.append(fab);
    fab.classList.add('visible');
    fab.addEventListener('click', () => open(fab));
    overlay.querySelector('#gb-hl-close').addEventListener('click', close);
    overlay.querySelector('#gb-hl-export').addEventListener('click', exportMarkdown);
    overlay.querySelector('#gb-hl-new-note').addEventListener('click', () => showEditor());
    overlay.querySelector('#gb-hl-note-cancel').addEventListener('click', hideEditor);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#gb-hl-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-library-tab]');
      if (!b) return;
      tab = b.dataset.libraryTab; shown = BATCH_SIZE; render();
    });
    search.addEventListener('input', () => { searchTerm = normalizeText(search.value).toLocaleLowerCase(); shown = BATCH_SIZE; render(); });
    sourceSelect.addEventListener('change', () => { filter = sourceSelect.value; shown = BATCH_SIZE; render(); });
    list.addEventListener('click', listClick);
    editor.addEventListener('submit', saveNote);
    document.addEventListener('keydown', keydown);
    window.addEventListener('gb:favorites-changed', sync);
    window.addEventListener('gb:favorite-store-ready', sync);
    window.addEventListener('storage', (e) => { if ([QUOTES_KEY, NOTES_KEY, FAVORITES_KEY].includes(e.key)) sync(); });
    document.addEventListener('astro:page-load', () => { dock(); sync(); attachSelection(); });
    window.addEventListener('resize', dock, { passive: true });
    attachSelection();
    dock();
    sync();
  }
  function keydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); if (editor.hidden) close(); else hideEditor(); return; }
    if (e.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')]
      .filter((node) => !node.closest('[hidden]') && node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  }
  function open(trigger) {
    if (!overlay) create();
    if (!overlay || isOpen()) return;
    opener = trigger || document.activeElement;
    tab = 'all'; filter = 'all'; searchTerm = ''; shown = BATCH_SIZE;
    search.value = '';
    render();
    overlay.removeAttribute('inert');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');
    if (window.SiteUtils && window.SiteUtils.lockScroll) window.SiteUtils.lockScroll('highlights');
    else document.body.classList.add('no-scroll');
    overlay.querySelector('#gb-hl-close').focus({ preventScroll: true });
  }
  function close() {
    if (!isOpen()) return;
    hideEditor(false);
    clearUndo();
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    fab.setAttribute('aria-expanded', 'false');
    if (window.SiteUtils && window.SiteUtils.unlockScroll) window.SiteUtils.unlockScroll('highlights');
    else document.body.classList.remove('no-scroll');
    if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
  }
  function sync() { if (fab) { fab.classList.add('visible'); fab.querySelector('#gb-hl-fab-count').hidden = all().length === 0; fab.setAttribute('aria-label', 'Моя библиотека — сохранено ' + all().length); } if (isOpen()) render(); }
  function dock() {
    if (!fab) return;
    const gill = document.querySelector('.mobile-bottom-bar');
    const herm = document.querySelector('.hmbar');
    const legacy = document.querySelector('.bottom-bar-inner');
    let host = null, before = null, cls = '';
    if (herm) { host = herm; before = document.getElementById('hmShareBtn'); cls = 'hmbar-btn'; }
    else if (gill) { host = gill.querySelector('.mobile-icon-row') || gill; before = host.querySelector('[data-action="share"],[data-fc-action="share"]'); cls = 'gb-icon'; }
    else if (legacy) { host = legacy; before = document.getElementById('barShareBtn'); cls = 'bar-icon-btn'; }
    fab.classList.remove('gb-hl-fab--docked', 'hmbar-btn', 'gb-icon', 'bar-icon-btn');
    if (!host) { document.body.append(fab); return; }
    fab.classList.add('gb-hl-fab--docked', cls);
    if (before && before.parentNode === host) host.insertBefore(fab, before);
    else host.append(fab);
  }
  function render() {
    if (!list) return;
    const items = all();
    titleCount.textContent = '· ' + items.length;
    const labels = [...new Set(items.map((x) => x.title))].sort((a, b) => a.localeCompare(b, 'ru'));
    if (filter !== 'all' && !labels.includes(filter)) filter = 'all';
    sourceSelect.replaceChildren(new Option('Все статьи', 'all'));
    for (const label of labels) sourceSelect.append(new Option(label, label));
    sourceSelect.value = filter;
    overlay.querySelectorAll('[data-library-tab]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.libraryTab === tab)));
    const filtered = items.filter((x) =>
      (tab === 'all' || tab === x.type) && (filter === 'all' || filter === x.title) &&
      (!searchTerm || (x.text + ' ' + x.quoteText + ' ' + x.title).toLocaleLowerCase().includes(searchTerm)));
    list.replaceChildren();
    if (!filtered.length) {
      list.append(element('div', 'gb-hl-empty', items.length
        ? 'По вашему запросу ничего не найдено.'
        : 'Пока пусто. Сохраните цитату или статью либо создайте заметку.'));
      return;
    }
    for (const item of filtered.slice(0, shown)) list.append(renderItem(item));
    if (filtered.length > shown) list.append(button('more', 'Загрузить ещё записи', 'Показать ещё · ' + (filtered.length - shown)));
  }
  function renderItem(item) {
    const card = element('article', 'gb-hl-item');
    card.dataset.type = item.type; card.dataset.id = item.id;
    card.append(element('div', 'gb-hl-type',
      (item.type === 'favorite' ? 'Статья' : item.type === 'quote' ? 'Цитата' : 'Заметка') +
      (item.savedAt ? ' · ' + savedDate(item.savedAt) : '')));
    if (item.quoteText) {
      const related = element('div', 'gb-hl-related', 'К цитате: «' + item.quoteText + '»');
      card.append(related);
    }
    const body = element(item.type === 'quote' ? 'blockquote' : 'p', 'gb-hl-quote', item.text || (item.type === 'favorite' ? 'Сохранённая статья' : ''));
    if (item.type === 'note') body.classList.add('gb-hl-note');
    if (item.type === 'favorite') body.classList.add('gb-hl-favorite');
    card.append(body);
    if (item.type !== 'favorite' && item.text.length > 240) {
      const key = item.type + ':' + item.id;
      const full = expanded.has(key);
      body.classList.toggle('is-collapsed', !full);
      const toggle = button('expand', full ? 'Свернуть запись' : 'Развернуть запись', full ? 'Свернуть' : 'Читать полностью');
      toggle.className = 'gb-hl-expand';
      toggle.setAttribute('aria-expanded', String(full));
      card.append(toggle);
    }
    const meta = element('div', 'gb-hl-meta');
    const link = document.createElement('a');
    link.textContent = item.title;
    if (item.url) link.href = item.url;
    else link.setAttribute('aria-disabled', 'true');
    meta.append(link);
    if (item.type === 'quote') {
      meta.append(button('note-for-quote', 'Написать заметку к этой цитате', 'Заметка'));
      meta.append(button('card', 'Сохранить цитату как открытку', 'Открытка'));
    }
    if (item.type === 'note') meta.append(button('edit-note', 'Изменить заметку', 'Изменить'));
    if (item.type !== 'favorite') meta.append(button('delete', 'Удалить запись', 'Удалить'));
    card.append(meta);
    return card;
  }
  function listClick(e) {
    const b = e.target.closest('[data-library-action]');
    if (!b) return;
    const action = b.dataset.libraryAction;
    if (action === 'more') { shown += BATCH_SIZE; render(); return; }
    const card = b.closest('.gb-hl-item');
    if (!card) return;
    const item = all().find((x) => x.id === card.dataset.id && x.type === card.dataset.type);
    if (!item) return;
    if (action === 'expand') {
      const key = item.type + ':' + item.id, full = !expanded.has(key);
      if (full) expanded.add(key); else expanded.delete(key);
      card.querySelector('.gb-hl-quote').classList.toggle('is-collapsed', !full);
      b.setAttribute('aria-expanded', String(full));
      b.textContent = full ? 'Свернуть' : 'Читать полностью';
    }
    if (action === 'delete') deleteItem(item);
    if (action === 'edit-note') showEditor(null, item);
    if (action === 'note-for-quote') showEditor({ quoteText: item.text, title: item.title, url: item.url });
    if (action === 'card') exportQuoteCard(item);
  }
  function showEditor(context = null, editing = null) {
    draft = { context, editing };
    editor.hidden = false;
    panel.classList.add('is-editing');
    textArea.value = editing ? editing.text : '';
    overlay.querySelector('#gb-hl-note-context').textContent = context && context.quoteText
      ? 'К цитате: «' + context.quoteText.slice(0, 180) + '»'
      : editing && editing.quoteText ? 'К цитате: «' + editing.quoteText.slice(0, 180) + '»'
      : 'Мысли во время чтения';
    textArea.focus({ preventScroll: true });
  }
  function hideEditor(focus = true) {
    if (!editor) return;
    editor.hidden = true; draft = null;
    panel.classList.remove('is-editing');
    if (focus) overlay.querySelector('#gb-hl-new-note').focus({ preventScroll: true });
  }
  function saveNote(e) {
    e.preventDefault();
    const text = textArea.value.trim();
    if (!text) { statusMessage('Сначала напишите заметку.', true); return; }
    const old = notes(), context = draft && draft.context, editing = draft && draft.editing;
    if (!editing && old.length >= LIMIT_NOTES) {
      statusMessage('Достигнут лимит заметок. Экспортируйте библиотеку перед удалением старых записей.', true);
      return;
    }
    const next = editing
      ? old.map((x) => x.id === editing.id ? Object.assign({}, x, { text }) : x)
      : [{
          id: uid('note'), text, quoteText: context && context.quoteText || '',
          articleTitle: context && context.title || currentTitle(),
          url: context && context.url || location.origin + location.pathname,
          savedAt: Date.now(),
        }].concat(old);
    if (!write(NOTES_KEY, next)) {
      statusMessage('Не удалось сохранить заметку. Проверьте доступное место в браузере.', true); return;
    }
    hideEditor(false);
    tab = 'note'; filter = 'all'; shown = BATCH_SIZE;
    render(); sync();
    statusMessage(editing ? 'Заметка обновлена.' : 'Заметка сохранена.');
  }
  function clearUndo() {
    if (pendingUndo) clearTimeout(pendingUndo.timer);
    pendingUndo = null;
    if (status) { status.replaceChildren(); status.classList.remove('is-visible'); }
  }
  function deleteItem(item) {
    const key = item.type === 'note' ? NOTES_KEY : QUOTES_KEY;
    const old = item.type === 'note' ? notes() : quotes();
    const index = old.findIndex((x) => String(x.id) === item.id);
    if (index < 0) return;
    if (!write(key, old.filter((x) => String(x.id) !== item.id))) {
      statusMessage('Не удалось удалить запись.', true); return;
    }
    clearUndo();
    pendingUndo = { key, entry: old[index], index };
    render(); sync();
    const undoButton = button('undo', 'Отменить удаление', 'Отменить');
    status.replaceChildren(element('span', '', 'Запись удалена'), undoButton);
    status.classList.add('is-visible');
    undoButton.addEventListener('click', () => {
      if (!pendingUndo) return;
      const u = pendingUndo, items = read(u.key);
      items.splice(Math.min(u.index, items.length), 0, u.entry);
      if (!write(u.key, items)) { statusMessage('Не удалось восстановить запись.', true); return; }
      clearUndo(); render(); sync(); statusMessage('Запись восстановлена.');
    });
    pendingUndo.timer = setTimeout(clearUndo, 6000);
  }
  function saveSelectedQuote() {
    const selected = selection();
    if (selected.text.length < 8) { statusMessage('Сначала выделите текст.', true); return false; }
    const old = quotes(), record = {
      id: uid('quote'), text: selected.text, articleTitle: currentTitle(),
      url: sourceUrl(selected), savedAt: Date.now(),
    };
    if (old.length >= LIMIT_QUOTES && !old.some((x) => gbHighlightKey(x) === gbHighlightKey(record))) {
      statusMessage('Сохранено 200 цитат — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.', true);
      return false;
    }
    const next = gbAddHighlight(old, record);
    if (next.length === old.length && next.every((x, i) => x === old[i])) {
      statusMessage('Такая цитата уже сохранена.'); return true;
    }
    if (!write(QUOTES_KEY, next)) {
      statusMessage('Не удалось сохранить цитату. Хранилище недоступно или заполнено.', true);
      return false;
    }
    sync(); statusMessage('Цитата сохранена вместе с источником.');
    return true;
  }
  function bindSelectionButton(id, label, icon, handler, popup) {
    if (popup.querySelector('#' + id)) return;
    const b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = icon + '<span>' + (id === 'ss-save' ? 'Сохранить' : 'Заметка') + '</span>';
    popup.append(b);
    b.addEventListener('click', handler);
  }
  function attachSelection() {
    const popup = document.getElementById('selection-share-popup');
    if (!popup || popup.querySelector('#ss-save')) return;
    popup.append(element('span', 'ss-sep'));
    bindSelectionButton('ss-save', 'Сохранить выделенный текст как цитату', quoteSvg, () => {
      if (saveSelectedQuote()) {
        const label = popup.querySelector('#ss-save span');
        if (label) label.textContent = 'Сохранено';
        popup.classList.add('gb-hl-selection-saved');
        setTimeout(() => {
          if (label && label.isConnected) label.textContent = 'Сохранить';
          popup.classList.remove('gb-hl-selection-saved', 'ss-visible');
          popup.setAttribute('aria-hidden', 'true');
        }, 660);
      }
    }, popup);
    bindSelectionButton('ss-note', 'Добавить заметку к выделенному тексту', penSvg, () => {
      const s = selection();
      const context = s.text.length >= 8
        ? { quoteText: s.text, url: sourceUrl(s), title: currentTitle() } : null;
      popup.classList.remove('ss-visible');
      popup.setAttribute('aria-hidden', 'true');
      open(document.getElementById('ss-note'));
      showEditor(context);
    }, popup);
  }
  function exportMarkdown() {
    const items = all();
    if (!items.length) { statusMessage('Библиотека пуста.'); return; }
    const lines = ['# Моя библиотека · Господь Бог — Сила Моя', ''];
    for (const x of items) {
      lines.push('## ' + (x.type === 'note' ? 'Заметка' : x.type === 'quote' ? 'Цитата' : 'Статья') + ' — ' + x.title);
      lines.push('');
      lines.push(x.type === 'quote' ? '> ' + x.text.replace(/\n/g, '\n> ') : x.text);
      if (x.quoteText) lines.push('', 'К цитате: ' + x.quoteText);
      if (x.url) lines.push('', 'Источник: ' + new URL(x.url, location.origin).href);
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'gb-moya-biblioteka.md';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function exportQuoteCard(item) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) { statusMessage('Ваш браузер не поддерживает открытки.', true); return; }
    const dark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = dark ? '#1c1712' : '#fffdf8';
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.strokeStyle = dark ? '#d1b387' : '#aa865b';
    ctx.strokeRect(48, 48, 984, 1254);
    const size = item.text.length > 260 ? 39 : item.text.length > 140 ? 49 : 58;
    ctx.fillStyle = dark ? '#f5ead7' : '#241b15';
    ctx.font = 'italic ' + size + 'px Georgia, serif';
    let current = '';
    const lines = [];
    for (const word of normalizeText(item.text).split(' ')) {
      const next = current ? current + ' ' + word : word;
      if (ctx.measureText(next).width > 875 && current) { lines.push(current); current = word; }
      else current = next;
    }
    if (current) lines.push(current);
    const visible = lines.slice(0, 18);
    const top = Math.max(260, (1190 - visible.length * size * 1.42) / 2);
    visible.forEach((line, index) => ctx.fillText(line, 98, top + index * size * 1.42));
    ctx.font = '30px Georgia, serif';
    ctx.fillStyle = dark ? '#caa87e' : '#7c5c3b';
    ctx.fillText(item.title.slice(0, 48), 98, 1210);
    ctx.fillText('Господь Бог — Сила Моя', 98, 1290);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'gb-citata.png';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }
  document.addEventListener('mouseup', () => setTimeout(rememberSelection, 25));
  document.addEventListener('touchend', () => setTimeout(rememberSelection, 60), { passive: true });
  document.addEventListener('selectionchange', rememberSelection);
  document.addEventListener('click', (e) => {
    if (e.target.closest('#selection-share-popup')) attachSelection();
  });

  const api = Object.freeze({
    libraryVersion: 2, open, close, getAll: quotes,
    getNotes: notes, getLibrary: all,
    highlightPath: gbHighlightPath, highlightText: gbHighlightText,
    highlightKey: gbHighlightKey, dedupe: gbDedupeHighlights, addHighlight: gbAddHighlight,
  });
  window.GBHighlights = api;
  window.GBReaderLibrary = api;

  function init() {
    create();
    setTimeout(attachSelection, 500);
    setTimeout(dock, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
