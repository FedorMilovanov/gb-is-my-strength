/* Reader Library v3: opt-in research tools. Keeps legacy content owners and keys intact. */
'use strict';

const KEYS = Object.freeze({
  quotes: 'gb-highlights-v1',
  notes: 'gb-reader-notes-v1',
  favorites: 'gb-favorites',
  tags: 'gb-library-tags-v1',
  reading: 'gb-library-reading-v1',
  revisit: 'gb-library-revisit-v1',
});
const FORMAT = 'gospod-bog-reader-library';
const MAX = { quotes: 200, notes: 500, favorites: 50, tags: 800, reading: 1000 };
const cap = (v, n) => String(v == null ? '' : v).slice(0, n);
const node = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
};
const btn = (label, action, value = '') => {
  const el = node('button', 'gb-hl-mini', label);
  el.type = 'button';
  el.dataset.researchAction = action;
  if (value) el.dataset.value = value;
  return el;
};
const cleanPath = (value) => {
  if (!value) return '';
  try {
    const u = new URL(value || '', location.origin);
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return '';
    return u.pathname.replace(/\/+$/, '') || '/';
  } catch { return ''; }
};
const stringKey = (entry) => entry.type + ':' + entry.id;
const distinct = (items, key) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const parse = (key, fallback) => {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; }
  catch { return fallback; }
};
const store = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
};
function wordBase(v) {
  return cap(v, 100).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').normalize('NFC')
    .replace(/[^а-яa-z0-9]+/g, '');
}
function stem(word) {
  if (word.length < 6) return word;
  return word.replace(/(иями|ями|ами|ому|ему|ого|его|ыми|ими|ение|ения|анию|ание|ость|ости|аться|иться|ать|ять|ями|иях|ией|ыми|ами|ой|ый|ий|ая|ое|ые|ие|ых|их|ов|ев|ам|ям|ах|ях|ом|ем|ою|ею|у|ю|а|я|ы|и|е|о|ь)$/u, '');
}
export function matchesResearch(value, query) {
  const tokens = cap(query, 180).trim().split(/\s+/).map(wordBase).filter(Boolean);
  if (!tokens.length) return true;
  const normalized = cap(value, 25000).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const words = normalized.split(/[^а-яa-z0-9]+/).filter(Boolean);
  return tokens.every((q) => {
    const base = stem(q);
    return words.some((w) => w.includes(q) || (base.length >= 4 && stem(w) === base));
  });
}
function safeTags(values) {
  if (!Array.isArray(values)) return [];
  return distinct(values.filter((x) => typeof x === 'string')
    .map((x) => x.trim().replace(/\s+/g, ' ').slice(0, 36))
    .filter(Boolean).slice(0, 20), (x) => x.toLocaleLowerCase('ru-RU'));
}
function objectMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function mergeUnique(existing, incoming, key, max) {
  const values = distinct(existing.concat(incoming), key);
  if (values.length > max) throw new Error('Превышен лимит записей (' + max + '). Удаление данных не производится.');
  return values;
}
function validateBackup(payload) {
  if (!payload || payload.format !== FORMAT || payload.version !== 3 || !payload.data) {
    throw new Error('Неподдерживаемый формат копии.');
  }
  const p = payload.data;
  for (const key of ['quotes', 'notes', 'favorites']) {
    if (!Array.isArray(p[key]) || p[key].length > MAX[key]) throw new Error('Некорректный список: ' + key);
  }
  const quote = p.quotes.map((x) => {
    if (!x || typeof x.id !== 'string' || typeof x.text !== 'string' || !x.text.trim() || x.text.length > 25000 || (x.url && !cleanPath(x.url)))
      throw new Error('Некорректная цитата.');
    return { ...x, id: cap(x.id, 110), text: x.text, articleTitle: cap(x.articleTitle, 260),
      url: cap(x.url, 2200), before: cap(x.before, 400), after: cap(x.after, 400), savedAt: Number(x.savedAt) || Date.now() };
  });
  const notes = p.notes.map((x) => {
    if (!x || typeof x.id !== 'string' || typeof x.text !== 'string' || x.text.length > 16000 || (x.url && !cleanPath(x.url)))
      throw new Error('Некорректная заметка.');
    return { ...x, id: cap(x.id, 110), text: x.text, articleTitle: cap(x.articleTitle, 260),
      quoteText: cap(x.quoteText, 1800), url: cap(x.url, 2200), savedAt: Number(x.savedAt) || Date.now() };
  });
  const fav = p.favorites.map((x) => {
    if (!x || !cleanPath(x.path || x.url)) throw new Error('Некорректная сохранённая статья.');
    return { ...x, path: cleanPath(x.path || x.url), title: cap(x.title, 240),
      description: cap(x.description, 500), addedAt: Number(x.addedAt) || Date.now() };
  });
  const tags = objectMap(p.tags);
  if (Object.keys(tags).length > MAX.tags || Object.values(tags).some((arr) => !Array.isArray(arr))) throw new Error('Некорректные метки.');
  const cleanTags = Object.create(null);
  for (const [key, value] of Object.entries(tags)) {
    if (key.length > 260 || !/^(quote|note|favorite):.{1,240}$/.test(key)) throw new Error('Некорректный ключ метки.');
    cleanTags[key] = safeTags(value);
  }
  const reading = objectMap(p.reading);
  if (Object.keys(reading).length > MAX.reading) throw new Error('Слишком много статусов чтения.');
  const cleanReading = {};
  for (const [path, value] of Object.entries(reading)) {
    if (!cleanPath(path) || !value || !['reading', 'finished', 'dismissed'].includes(value.state)) {
      throw new Error('Некорректное состояние чтения.');
    }
    cleanReading[cleanPath(path)] = { state: value.state, title: cap(value.title, 240),
      anchor: cap(value.anchor, 160), ratio: Math.max(0, Math.min(1, Number(value.ratio) || 0)),
      updatedAt: Math.min(Date.now(), Math.max(0, Number(value.updatedAt) || 0)) };
  }
  const revisit = objectMap(p.revisit);
  const suppressed = objectMap(revisit.suppressed);
  if (Object.keys(suppressed).length > 200) throw new Error('Некорректные исключения из повторения.');
  return {
    quotes: quote, notes, favorites: fav, tags: cleanTags, reading: cleanReading,
    revisit: { suppressed: Object.fromEntries(Object.keys(suppressed).map((id) => [cap(id, 160), true])),
      hiddenDate: cap(revisit.hiddenDate, 10) },
  };
}
function serializeCurrent() {
  const favoriteStore = window.GBFavoriteStore;
  return {
    quotes: Array.isArray(parse(KEYS.quotes, [])) ? parse(KEYS.quotes, []) : [],
    notes: Array.isArray(parse(KEYS.notes, [])) ? parse(KEYS.notes, []) : [],
    favorites: favoriteStore?.list ? favoriteStore.list({ persistMigration: false }) : parse(KEYS.favorites, []),
    tags: objectMap(parse(KEYS.tags, {})), reading: objectMap(parse(KEYS.reading, {})),
    revisit: objectMap(parse(KEYS.revisit, {})),
  };
}
function safeMerge(old, next) {
  const merged = {
    quotes: mergeUnique(old.quotes, next.quotes, (q) => cleanPath(q.url) + '\n' + String(q.text).replace(/\s+/g, ' ').toLocaleLowerCase(), MAX.quotes),
    notes: mergeUnique(old.notes, next.notes, (n) => n.id, MAX.notes),
    favorites: mergeUnique(old.favorites, next.favorites, (f) => cleanPath(f.path || f.url), MAX.favorites),
    tags: { ...next.tags, ...old.tags }, reading: { ...next.reading, ...old.reading },
    revisit: { ...next.revisit, ...old.revisit, suppressed: { ...next.revisit.suppressed, ...objectMap(old.revisit.suppressed) } },
  };
  for (const [key, values] of Object.entries(next.tags)) merged.tags[key] = safeTags((old.tags[key] || []).concat(values));
  if (Object.keys(merged.tags).length > MAX.tags || Object.keys(merged.reading).length > MAX.reading)
    throw new Error('Слишком много меток или статусов чтения.');
  return merged;
}
function atomicImport(merged) {
  const keys = Object.keys(KEYS);
  const before = Object.fromEntries(keys.map((key) => [KEYS[key], localStorage.getItem(KEYS[key])]));
  const serialized = Object.fromEntries(keys.map((key) => [KEYS[key], JSON.stringify(merged[key])]));
  const changed = [];
  try {
    for (const key of keys) {
      const storageKey = KEYS[key];
      if (serialized[storageKey] === before[storageKey]) continue;
      localStorage.setItem(storageKey, serialized[storageKey]);
      changed.push(storageKey);
    }
  } catch {
    // Revert only keys successfully written; the failed key and every later key remain untouched.
    // Reverse order returns storage usage toward its original state before each following restore.
    let rollbackFailed = false;
    for (const storageKey of changed.reverse()) {
      try {
        if (before[storageKey] === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, before[storageKey]);
      } catch { rollbackFailed = true; }
    }
    throw new Error(rollbackFailed
      ? 'Ошибка импорта и отката. Сохраните резервную копию текущих данных и проверьте хранилище.'
      : 'Импорт отменён. Исходные сохранения не изменены.');
  }
  window.GBFavoriteStore?.syncButtons?.();
  window.dispatchEvent(new CustomEvent('gb:favorites-changed', { detail: { source: 'library-import', items: merged.favorites } }));
}

export function createLibraryResearch({ overlay, getItems, notify, refresh, isOpen, renderItem }) {
  let topic = '', sortBy = 'new', tags = objectMap(parse(KEYS.tags, {}));
  let reading = objectMap(parse(KEYS.reading, {}));
  let revisit = objectMap(parse(KEYS.revisit, {}));
  let selectedItem = null, pendingImport = null;
  const h = (sel) => overlay.querySelector(sel);
  const panel = h('#gb-hl-panel'), header = h('#gb-hl-header');
  const manage = btn('⋯', 'manage');
  manage.id = 'gb-hl-manage';
  manage.setAttribute('aria-label', 'Резервные копии и управление');
  manage.setAttribute('aria-expanded', 'false');
  header.insertBefore(manage, h('#gb-hl-close'));
  const menu = node('section', 'gb-hl-manage-panel');
  menu.id = 'gb-hl-manage-panel';
  menu.hidden = true;
  const manageHead = node('strong', '', 'Данные библиотеки');
  const caption = node('p', '', 'Сохранения хранятся только в этом браузере. Скачайте резервную копию.');
  const jsonExport = btn('↓ Копия JSON', 'export-json');
  const jsonImport = btn('↑ Восстановить', 'import-json');
  const offline = node('p', 'gb-hl-info', 'При смене браузера или очистке данных копия поможет сохранить ваши записи.');
  const readingManager = node('div', 'gb-hl-reading-manager');
  menu.append(manageHead, caption, jsonExport, jsonImport, offline, readingManager);
  header.after(menu);
  const file = document.createElement('input');
  file.type = 'file'; file.id = 'gb-hl-json-file'; file.accept = 'application/json,.json'; file.hidden = true;
  menu.append(file);
  const confirmation = node('div', 'gb-hl-confirm');
  confirmation.id = 'gb-hl-import-confirm'; confirmation.hidden = true;
  confirmation.setAttribute('role', 'group');
  confirmation.setAttribute('aria-label', 'Подтверждение импорта');
  const prompt = node('p');
  const cancel = btn('Отмена', 'cancel-import');
  const confirm = btn('Добавить без замены', 'confirm-import');
  confirmation.append(prompt, cancel, confirm);
  menu.append(confirmation);

  const searchTools = h('#gb-hl-tools');
  const sort = document.createElement('select');
  sort.id = 'gb-hl-sort'; sort.setAttribute('aria-label', 'Сортировка');
  for (const [label, value] of [['Новые', 'new'], ['Старые', 'old'], ['По названию', 'title']]) sort.append(new Option(label, value));
  searchTools.append(sort);
  const topics = node('div', 'gb-hl-topics');
  topics.id = 'gb-hl-topics'; topics.setAttribute('aria-label', 'Фильтр по меткам');
  searchTools.after(topics);
  const tagEditor = node('div', 'gb-hl-tag-editor');
  tagEditor.hidden = true; tagEditor.id = 'gb-hl-tag-editor';
  const tagLabel = document.createElement('label'); tagLabel.htmlFor = 'gb-hl-tag-input'; tagLabel.textContent = 'Метки записи';
  const tagInput = document.createElement('input');
  tagInput.id = 'gb-hl-tag-input'; tagInput.maxLength = 36; tagInput.placeholder = 'Новая метка';
  const tagSave = btn('Добавить', 'save-tag'), tagCancel = btn('Закрыть', 'cancel-tag');
  tagEditor.append(tagLabel, tagInput, tagSave, tagCancel);
  topics.after(tagEditor);
  let extras = node('div', 'gb-hl-research-extras');

  function getTags(item) { return safeTags(tags[stringKey(item)]); }
  function setTag(item, text) {
    const label = cap(text.trim().replace(/\s+/g, ' '), 36);
    if (!label) return;
    const key = stringKey(item), prev = tags;
    tags = { ...prev, [key]: safeTags((prev[key] || []).concat(label)) };
    if (!store(KEYS.tags, tags)) { tags = prev; notify('Метки не сохранены: проверьте место в браузере.', true); return; }
    notify('Метка добавлена.'); refresh();
  }
  function getTopics() { return [...new Set(Object.values(tags).flatMap(safeTags))].sort((a, b) => a.localeCompare(b, 'ru')); }
  function renderTopics() {
    topics.replaceChildren();
    const values = getTopics();
    if (!values.length) { topics.hidden = true; return; }
    topics.hidden = false;
    const any = btn('Все темы', 'topic', '');
    any.setAttribute('aria-pressed', String(topic === '')); topics.append(any);
    for (const value of values) {
      const b = btn(value, 'topic', value); b.setAttribute('aria-pressed', String(topic === value)); topics.append(b);
    }
  }
  function itemMatches(item, search) {
    if (topic && !getTags(item).includes(topic)) return false;
    return matchesResearch([item.text, item.quoteText, item.title, item.before, item.after, ...getTags(item)].join(' '), search);
  }
  function orderItems(items) {
    return items.slice().sort((a, b) => sortBy === 'title'
      ? a.title.localeCompare(b.title, 'ru')
      : (sortBy === 'old' ? a.savedAt - b.savedAt : b.savedAt - a.savedAt));
  }
  function decorate(card, item, search) {
    if (item.type === 'quote' && (item.before || item.after)) {
      const action = btn('Контекст', 'context', stringKey(item));
      action.setAttribute('aria-expanded', 'false');
      card.querySelector('.gb-hl-meta')?.prepend(action);
    }
    const tagRow = node('div', 'gb-hl-tags');
    for (const tag of getTags(item)) tagRow.append(node('span', 'gb-hl-tag', tag));
    tagRow.append(btn('+ Метка', 'edit-tag', stringKey(item)));
    card.append(tagRow);
    if (search) {
      for (const root of card.querySelectorAll('.gb-hl-quote,.gb-hl-meta a,.gb-hl-related')) highlight(root, search);
    }
  }
  function highlight(root, search) {
    // Safe text-node highlights: never interpret stored user content as HTML.
    const tokens = cap(search, 180).split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((textNode) => {
      const content = textNode.nodeValue, normalized = content.toLocaleLowerCase('ru-RU');
      const hits = []; let start = 0;
      while (start < content.length && hits.length < 25) {
        const found = tokens.map((t) => ({ index: normalized.indexOf(t.toLocaleLowerCase('ru-RU'), start), len: t.length }))
          .filter((x) => x.index >= 0).sort((a, b) => a.index - b.index)[0];
        if (!found) break;
        hits.push(found); start = found.index + found.len;
      }
      if (!hits.length) return;
      const frag = document.createDocumentFragment(); let at = 0;
      hits.forEach((x) => { if (x.index > at) frag.append(document.createTextNode(content.slice(at, x.index)));
        frag.append(node('mark', 'gb-hl-hit', content.slice(x.index, x.index + x.len))); at = x.index + x.len; });
      if (at < content.length) frag.append(document.createTextNode(content.slice(at)));
      textNode.replaceWith(frag);
    });
  }
  function selectedQuote() {
    const items = getItems().filter((x) => x.type === 'quote' && !objectMap(revisit.suppressed)[x.id]);
    if (!items.length || revisit.hiddenDate === today()) return null;
    const index = today().split('').reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) >>> 0;
    return items[index % items.length];
  }
  function currentPath() { return cleanPath(location.pathname); }
  function currentStatus() { return reading[currentPath()] || null; }
  function updateReading(path, state, title) {
    const key = cleanPath(path);
    if (!key) return;
    const prev = reading, old = prev[key] || {};
    const record = { ...old, state, title: cap(title || old.title || document.title, 240),
      updatedAt: Date.now(), anchor: old.anchor || '', ratio: Number(old.ratio) || 0 };
    reading = { ...prev, [key]: record };
    if (!store(KEYS.reading, reading)) { reading = prev; notify('Не удалось записать статус чтения.', true); return; }
    notify(state === 'reading' ? 'Материал добавлен в «Читаю».' : state === 'finished'
      ? 'Отмечено как прочитанное. Больше не предлагаем.' : 'Материал скрыт из предложений.');
    refresh();
  }
  function eligibleCurrent() {
    const path = currentPath();
    return path !== '/' && !path.startsWith('/izbrannoe') &&
      Boolean(document.querySelector('article,main [data-pagefind-body],main article'));
  }
  function anchorAtScroll() {
    const headings = [...document.querySelectorAll('article h2[id],article h3[id],main [data-pagefind-body] h2[id],main [data-pagefind-body] h3[id]')];
    const cutoff = Math.max(90, Math.min(window.innerHeight * .35, 250));
    for (let i = headings.length - 1; i >= 0; i--) {
      if (headings[i].getBoundingClientRect().top <= cutoff) return headings[i].id;
    }
    return '';
  }
  let progressTimer = null;
  function rememberProgress() {
    if (isOpen() || currentStatus()?.state !== 'reading') return;
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    const record = { ...currentStatus(), anchor: anchorAtScroll(),
      ratio: Math.min(1, Math.max(0, window.scrollY / maxScroll)), updatedAt: Date.now() };
    const before = reading;
    reading = { ...before, [currentPath()]: record };
    if (!store(KEYS.reading, reading)) reading = before;
  }
  window.addEventListener('scroll', () => {
    if (currentStatus()?.state !== 'reading') return;
    clearTimeout(progressTimer); progressTimer = setTimeout(rememberProgress, 800);
  }, { passive: true });
  window.addEventListener('pagehide', rememberProgress);
  function resume(path) {
    const key = cleanPath(path), data = reading[key];
    if (!data || data.state !== 'reading') return;
    if (key !== currentPath()) {
      sessionStorage.setItem('gb-library-resume-once', key);
      location.assign(key);
      return;
    }
    const target = data.anchor ? document.getElementById(data.anchor) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else {
      const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      window.scrollTo(0, max * Math.min(1, Math.max(0, Number(data.ratio) || 0)));
    }
  }
  function autoResumeOnce() {
    try {
      const key = sessionStorage.getItem('gb-library-resume-once');
      if (key !== currentPath()) return;
      sessionStorage.removeItem('gb-library-resume-once');
      requestAnimationFrame(() => requestAnimationFrame(() => resume(key)));
    } catch {}
  }
  window.addEventListener('load', autoResumeOnce, { once: true });
  if (document.readyState === 'complete') autoResumeOnce();

  function fillManager() {
    readingManager.replaceChildren();
    const hidden = Object.entries(reading).filter(([, x]) => ['finished', 'dismissed'].includes(x.state));
    if (!hidden.length) return;
    readingManager.append(node('strong', '', 'Архив статусов чтения'));
    for (const [path, x] of hidden.slice(0, 50)) {
      const row = node('div', 'gb-hl-manage-row');
      row.append(node('span', '', (x.title || path) + ' · ' + (x.state === 'finished' ? 'Прочитано' : 'Не интересно')));
      row.append(btn('Вернуть в «Читаю»', 'start-reading', path));
      readingManager.append(row);
    }
  }
  function section() {
    extras.replaceChildren();
    if (eligibleCurrent()) {
      const key = currentPath(), record = currentStatus();
      const line = node('div', 'gb-hl-current');
      const text = node('span', '', record?.state === 'reading' ? 'Этот материал в списке «Читаю».'
        : record?.state === 'finished' ? 'Вы отметили эту статью как прочитанную.'
        : record?.state === 'dismissed' ? 'Вы не хотите продолжать эту статью.'
        : 'Читаете эту статью? Сохраните место для продолжения.');
      line.append(text);
      line.append(btn(record?.state === 'reading' ? 'Прочитано' : 'Читаю', record?.state === 'reading' ? 'finish-current' : 'start-current'));
      if (record?.state === 'reading') line.append(btn('Не интересно', 'dismiss-current'));
      extras.append(line);
    }
    const active = Object.entries(reading).filter(([, x]) => x.state === 'reading').sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    if (active.length) {
      const group = node('section', 'gb-hl-revisit-card');
      group.append(node('strong', 'gb-hl-overline', 'ПРОДОЛЖИТЬ ЧТЕНИЕ'));
      for (const [path, record] of active.slice(0, 3)) {
        const line = node('div', 'gb-hl-reading-row');
        const heading = node('span', 'gb-hl-reading-title', record.title || path);
        const actions = node('div', 'gb-hl-reading-actions');
        actions.append(btn('Продолжить', 'resume', path));
        actions.append(btn('Прочитано', 'finish-reading', path));
        actions.append(btn('Не интересно', 'dismiss-reading', path));
        line.append(heading, actions);
        group.append(line);
      }
      extras.append(group);
    }
    const quote = selectedQuote();
    if (quote) {
      const group = node('section', 'gb-hl-revisit-card gb-hl-daily');
      group.append(node('strong', 'gb-hl-overline', 'ПЕРЕЧИТАТЬ СЕГОДНЯ'));
      group.append(node('blockquote', 'gb-hl-daily-quote', quote.text));
      group.append(node('p', 'gb-hl-revisit-source', quote.title));
      const controls = node('div', 'gb-hl-reading-actions');
      if (quote.url) {
        const link = node('a', 'gb-hl-mini', 'Открыть источник');
        link.href = quote.url; controls.append(link);
      }
      controls.append(btn('Скрыть на сегодня', 'hide-today'));
      controls.append(btn('Не предлагать цитату', 'never-quote', quote.id));
      group.append(controls);
      extras.append(group);
    }
    return extras;
  }
  function decorateList(list, items, tab, searchTerm) {
    if (tab === 'all' && !searchTerm) list.prepend(section());
    else extras.remove();
    renderTopics();
  }
  function renderGroups(items, search) {
    const groups = new Map();
    for (const item of orderItems(items)) {
      const path = cleanPath(item.url) || item.title;
      if (!groups.has(path)) groups.set(path, []);
      groups.get(path).push(item);
    }
    const fragment = document.createDocumentFragment();
    for (const [path, entries] of groups) {
      const section = node('section', 'gb-hl-source-group');
      const header = node('header', 'gb-hl-source-header');
      header.append(node('strong', 'gb-hl-source-title', entries[0].title));
      header.append(node('span', 'gb-hl-source-count', entries.length + ' записей'));
      const actions = node('div', 'gb-hl-source-actions');
      if (path.startsWith('/')) {
        const link = node('a', 'gb-hl-mini', 'К статье');
        link.href = path; actions.append(link);
      }
      const state = reading[path]?.state;
      actions.append(btn(state === 'reading' ? 'Прочитано' : 'Читаю', state === 'reading' ? 'finish-reading' : 'start-reading', path));
      if (state === 'reading') actions.append(btn('Не интересно', 'dismiss-reading', path));
      header.append(actions); section.append(header);
      const body = node('div', 'gb-hl-source-entries');
      entries.forEach((entry) => { const card = renderItem(entry, new Set());
        if (card) { decorate(card, entry, search); body.append(card); } });
      section.append(body); fragment.append(section);
    }
    return fragment;
  }
  function onClick(e) {
    const b = e.target.closest('[data-research-action]');
    if (!b || !overlay.contains(b)) return;
    const action = b.dataset.researchAction, value = b.dataset.value || '';
    if (action === 'manage') {
      menu.hidden = !menu.hidden; manage.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) { fillManager(); jsonExport.focus({ preventScroll: true }); }
      return;
    }
    if (action === 'export-json') {
      const data = serializeCurrent();
      const blob = new Blob([JSON.stringify({ format: FORMAT, version: 3, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'gb-library-backup.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      notify('Полная резервная копия сохранена.'); return;
    }
    if (action === 'import-json') { file.click(); return; }
    if (action === 'cancel-import') { pendingImport = null; confirmation.hidden = true; return; }
    if (action === 'confirm-import') {
      if (!pendingImport) return;
      try {
        const merged = safeMerge(serializeCurrent(), pendingImport);
        atomicImport(merged);
        tags = merged.tags; reading = merged.reading; revisit = merged.revisit;
        pendingImport = null; confirmation.hidden = true; refresh();
        notify('Импорт завершён без замены существующих записей.');
      } catch (error) { notify(error.message, true); }
      return;
    }
    if (action === 'topic') { topic = value; refresh(); return; }
    if (action === 'edit-tag') {
      selectedItem = getItems().find((x) => stringKey(x) === value);
      if (!selectedItem) return;
      tagEditor.hidden = false; tagInput.value = ''; tagInput.focus({ preventScroll: true }); return;
    }
    if (action === 'cancel-tag') { tagEditor.hidden = true; selectedItem = null; return; }
    if (action === 'save-tag') {
      if (!selectedItem) return;
      setTag(selectedItem, tagInput.value);
      tagEditor.hidden = true; selectedItem = null; return;
    }
    if (action === 'context') {
      const card = b.closest('.gb-hl-item'), item = getItems().find((x) => stringKey(x) === value);
      if (!card || !item) return;
      const present = card.querySelector('.gb-hl-context');
      if (present) { present.remove(); b.setAttribute('aria-expanded', 'false'); return; }
      const detail = node('div', 'gb-hl-context');
      detail.append(node('strong', '', 'Контекст сохранённой цитаты'));
      if (item.before) detail.append(node('p', '', item.before));
      detail.append(node('blockquote', '', item.text));
      if (item.after) detail.append(node('p', '', item.after));
      card.querySelector('.gb-hl-meta')?.before(detail);
      b.setAttribute('aria-expanded', 'true'); return;
    }
    if (action === 'start-current') { updateReading(currentPath(), 'reading', document.title.split(' · ')[0]); rememberProgress(); return; }
    if (action === 'finish-current') { updateReading(currentPath(), 'finished', document.title.split(' · ')[0]); return; }
    if (action === 'dismiss-current') { updateReading(currentPath(), 'dismissed', document.title.split(' · ')[0]); return; }
    if (['start-reading', 'finish-reading', 'dismiss-reading'].includes(action)) {
      const state = action === 'start-reading' ? 'reading' : action === 'finish-reading' ? 'finished' : 'dismissed';
      updateReading(value, state, reading[value]?.title || getItems().find((x) => cleanPath(x.url) === value)?.title || value);
      fillManager(); return;
    }
    if (action === 'resume') { resume(value); return; }
    if (action === 'hide-today') {
      const previous = revisit; revisit = { ...previous, hiddenDate: today() };
      if (!store(KEYS.revisit, revisit)) revisit = previous;
      refresh(); return;
    }
    if (action === 'never-quote') {
      const previous = revisit;
      revisit = { ...previous, suppressed: { ...objectMap(previous.suppressed), [value]: true } };
      if (!store(KEYS.revisit, revisit)) revisit = previous;
      refresh();
    }
  }
  overlay.addEventListener('click', onClick);
  sort.addEventListener('change', () => { sortBy = sort.value; refresh(); });
  tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tagSave.click(); } });
  file.addEventListener('change', async () => {
    const input = file.files?.[0]; file.value = '';
    if (!input) return;
    if (input.size > 4 * 1024 * 1024) { notify('Файл больше 4 МБ.', true); return; }
    try {
      const json = JSON.parse(await input.text());
      pendingImport = validateBackup(json);
      prompt.textContent = 'В копии ' + pendingImport.quotes.length + ' цитат, '
        + pendingImport.notes.length + ' заметок, ' + pendingImport.favorites.length
        + ' статей. Существующие записи сохранятся; дубликаты будут пропущены.';
      confirmation.hidden = false; confirm.focus({ preventScroll: true });
    } catch (error) { pendingImport = null; confirmation.hidden = true; notify('Импорт отменён: ' + error.message, true); }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === KEYS.tags) { tags = objectMap(parse(KEYS.tags, {})); refresh(); }
    if (event.key === KEYS.reading) { reading = objectMap(parse(KEYS.reading, {})); refresh(); }
    if (event.key === KEYS.revisit) { revisit = objectMap(parse(KEYS.revisit, {})); refresh(); }
  });
  return Object.freeze({
    getTags, itemMatches, orderItems, decorate, renderGroups, decorateList,
    resetMenu() { menu.hidden = true; confirmation.hidden = true; tagEditor.hidden = true; manage.setAttribute('aria-expanded', 'false'); },
    handleEscape() {
      if (!confirmation.hidden) { confirmation.hidden = true; pendingImport = null; jsonImport.focus({ preventScroll: true }); return true; }
      if (!tagEditor.hidden) { tagEditor.hidden = true; selectedItem = null; h('#gb-hl-list')?.focus({ preventScroll: true }); return true; }
      if (!menu.hidden) { menu.hidden = true; manage.setAttribute('aria-expanded', 'false'); manage.focus({ preventScroll: true }); return true; }
      return false;
    },
    resetFilters() { topic = ''; },
    refreshState() { tags = objectMap(parse(KEYS.tags, {})); reading = objectMap(parse(KEYS.reading, {})); revisit = objectMap(parse(KEYS.revisit, {})); },
  });
}
