/* Reader Library v3: opt-in research tools. Keeps legacy content owners and keys intact. */
'use strict';

// Canonical js/ asset path keeps source revision auditing and Node contracts aligned.
import { KEYS, cap, cleanPath, parse, objectMap, exact, mutateResearch, updateProgress, warmReadingProgress } from '../js/reader-library-research-core.js?v=58d66b97';

function changeReading(map,key,state,title,at) {
  const old=Object.hasOwn(map,key)?map[key]:{};
  if(!old||typeof old!=='object'||Array.isArray(old)) return {reason:'invalid-record'};
  if(old.updatedAt!=null && (!Number.isFinite(Number(old.updatedAt))||Number(old.updatedAt)>at))
    return {reason:'conflict'};
  const record={...old,state,title:cap(title||old.title,240),
    updatedAt:at,anchor:old.anchor||'',ratio:Number(old.ratio)||0};
  return {value:{...map,[key]:record}};
}

const FORMAT = 'gospod-bog-reader-library';
const RECOVERY_FORMAT = 'gospod-bog-reader-library-recovery';
const BACKUP_MAX_BYTES = 4 * 1024 * 1024;
const RECOVERY_MAX_BYTES = 32 * 1024 * 1024;
const MAX = { quotes: 200, notes: 500, favorites: 50, tags: 800, tagsPerItem: 20, reading: 1000 };
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
  // A repeated imported tag must not evict the twentieth distinct value.
  return distinct(values.filter((x) => typeof x === 'string')
    .map((x) => x.trim().replace(/\s+/g, ' ').slice(0, 36))
    .filter(Boolean), (x) => x.toLocaleLowerCase('ru-RU'));
}
function boundedTags(values) {
  const result = safeTags(values);
  if (result.length > MAX.tagsPerItem)
    throw new Error('Больше 20 уникальных меток у одной записи. Импорт отменён без изменения данных.');
  return result;
}
const hasId = id => (typeof id === 'string' && id.length > 0 && id.length <= 110) ||
  (typeof id === 'number' && Number.isSafeInteger(id) && id !== 0);
const sameId = (a,b) => a != null && b != null && String(a) === String(b);
function recordKey(row, quote) {
  if (row && row.id != null && String(row.id)) return 'id:' + String(row.id);
  return quote && row && typeof row.text === 'string'
    ? 'legacy:' + JSON.stringify([row.url,row.text,row.before,row.after]) : null;
}
// Keep every preexisting row, including legacy duplicates; refuse ambiguous
// or divergent identities rather than silently selecting one version.
function mergeRecords(existing, incoming, quote, max) {
  const result = existing.slice(), added = [];
  for (const row of incoming) {
    const key = recordKey(row,quote);
    if (!key) throw new Error('У записи нет безопасного идентификатора.');
    const matches = result.filter(x => recordKey(x,quote) === key);
    if (matches.length > 1 || (matches.length === 1 && !exact(matches[0],row)))
      throw new Error('Конфликт идентификаторов цитат или заметок. Импорт отменён без изменения данных.');
    if (!matches.length) { result.push(row); added.push(row); }
  }
  if (result.length > max && result.length > existing.length)
    throw new Error('Превышен лимит записей (' + max + '). Удаление данных не производится.');
  return { result, added };
}
function favoriteKey(row) {
  const value=typeof row==='string'?row:row?.path||row?.routePath||row?.url;
  const path=cleanPath(value);
  if(!path)return '';
  // Match the canonical Favorite Store path aliases without invoking its
  // migration side effects. Existing raw records remain untouched.
  try {
    return decodeURIComponent(path).replace(/index\.html$/i,'').replace(/\/{2,}/g,'/').replace(/\/+$/,'')||'/';
  } catch { return ''; }
}
function mergeFavorites(existing,incoming) {
  const result=existing.slice();
  for (const row of incoming) {
    const key=favoriteKey(row);
    if (!key) throw new Error('Некорректная сохранённая статья.');
    if (!result.some(x=>favoriteKey(x)===key)) result.push(row);
  }
  if(result.length>MAX.favorites && result.length>existing.length)
    throw new Error('Превышен лимит сохранённых статей. Импорт отменён.');
  return result;
}
function checkImportedLinks(quotes,notes,addedQuotes,addedNotes) {
  const conflict=()=>{throw new Error('Конфликт связей заметок и цитат. Импорт отменён без изменения данных.');};
  for(const note of addedNotes) {
    const forward=quotes.filter(q=>sameId(q?.annotation?.noteId,note.id));
    if(forward.length>1 || (forward.length===1 && note.quoteId!=null && !sameId(forward[0].id,note.quoteId))) conflict();
    // Completing a legacy forward link must not compete with another reverse link.
    if(forward.some(q=>notes.some(n=>n!==note && sameId(n?.quoteId,q.id)))) conflict();
    if(note.quoteId!=null) {
      const targets=quotes.filter(q=>sameId(q?.id,note.quoteId));
      if(targets.length>1 || notes.some(n=>n!==note&&sameId(n?.quoteId,note.quoteId))) conflict();
      if(targets[0]?.annotation?.noteId!=null && !sameId(targets[0].annotation.noteId,note.id)) conflict();
    }
  }
  for(const quote of addedQuotes) {
    const reverse=notes.filter(n=>sameId(n?.quoteId,quote.id));
    const explicit=quote.annotation?.noteId;
    if(reverse.length>1) conflict();
    // Completing a legacy reverse link must not give one note to another quote.
    if(reverse.some(n=>quotes.some(q=>q!==quote && sameId(q?.annotation?.noteId,n.id)))) conflict();
    if(explicit!=null) {
      const targets=notes.filter(n=>sameId(n?.id,explicit));
      if(targets.length>1 || (reverse.length && !sameId(reverse[0].id,explicit)) ||
        quotes.some(q=>q!==quote&&sameId(q?.annotation?.noteId,explicit))) conflict();
      if(targets[0]?.quoteId!=null&&!sameId(targets[0].quoteId,quote.id)) conflict();
    }
  }
}
function validateBackup(payload) {
  if (!payload || payload.format !== FORMAT || payload.version !== 3 || !payload.data) {
    throw new Error('Неподдерживаемый формат копии.');
  }
  const p = payload.data;
  const isMap = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  if(!isMap(p)) throw new Error('Некорректная структура копии.');
  for(const key of ['tags','reading','revisit'])
    if(Object.hasOwn(p,key)&&!isMap(p[key])) throw new Error('Некорректный раздел: '+key);
  if(p.revisit && Object.hasOwn(p.revisit,'suppressed')&&!isMap(p.revisit.suppressed))
    throw new Error('Некорректные исключения из повторения.');
  for (const key of ['quotes', 'notes', 'favorites']) {
    if (!Array.isArray(p[key]) || p[key].length > MAX[key]) throw new Error('Некорректный список: ' + key);
  }
  // Validate without truncating stored metadata, inventing timestamps or
  // coercing legacy numeric IDs.
  const quote = p.quotes.map((x) => {
    if (!x || !hasId(x.id) || typeof x.text !== 'string' || !x.text.trim() || x.text.length > 25000 ||
        (x.url && (typeof x.url !== 'string' || !cleanPath(x.url))) ||
        (x.annotation?.noteId != null && !hasId(x.annotation.noteId)))
      throw new Error('Некорректная цитата.');
    return { ...x };
  });
  const notes = p.notes.map((x) => {
    if (!x || !hasId(x.id) || typeof x.text !== 'string' || x.text.length > 16000 ||
        (x.url && (typeof x.url !== 'string' || !cleanPath(x.url))) ||
        (x.quoteId != null && !hasId(x.quoteId)))
      throw new Error('Некорректная заметка.');
    return { ...x };
  });
  const fav = p.favorites.map((x) => {
    if (!x || typeof x!=='object' || !favoriteKey(x)) throw new Error('Некорректная сохранённая статья.');
    return { ...x, path: favoriteKey(x), title: cap(x.title, 240),
      description: cap(x.description, 500), addedAt: Number(x.addedAt) || Date.now() };
  });
  const tags = objectMap(p.tags);
  if (Object.keys(tags).length > MAX.tags || Object.values(tags).some((arr) => !Array.isArray(arr))) throw new Error('Некорректные метки.');
  const cleanTags = Object.create(null);
  for (const [key, value] of Object.entries(tags)) {
    if (key.length > 260 || !/^(quote|note|favorite):.{1,240}$/.test(key)) throw new Error('Некорректный ключ метки.');
    cleanTags[key] = boundedTags(value);
  }
  const reading = objectMap(p.reading);
  if (Object.keys(reading).length > MAX.reading) throw new Error('Слишком много статусов чтения.');
  const cleanReading = {}, readingNow = Date.now();
  for (const [path, value] of Object.entries(reading)) {
    if (!cleanPath(path) || !value || !['reading', 'finished', 'dismissed'].includes(value.state)) {
      throw new Error('Некорректное состояние чтения.');
    }
    const canonicalPath = cleanPath(path);
    const normalized = { state: value.state, title: cap(value.title, 240),
      anchor: cap(value.anchor, 160), ratio: Math.max(0, Math.min(1, Number(value.ratio) || 0)),
      updatedAt: Math.min(readingNow, Math.max(0, Number(value.updatedAt) || 0)) };
    if (Object.hasOwn(cleanReading, canonicalPath) && !exact(cleanReading[canonicalPath], normalized))
      throw new Error('Конфликт адресов статей в резервной копии. Импорт отменён без изменения данных.');
    cleanReading[canonicalPath] = normalized;
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
function validateRecovery(payload) {
  const raw=payload?.raw,keys=Object.values(KEYS);
  if(payload?.format!==RECOVERY_FORMAT||payload.version!==1||!raw||typeof raw!=='object'||Array.isArray(raw)||
    Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k)||(raw[k]!==null&&typeof raw[k]!=='string')))
    throw new Error('Некорректная аварийная копия.');
  return {...raw};
}
async function serializeRecovery() {
  const result=await window.GBHighlights?.snapshotRaw?.();
  if(!result?.ok)throw new Error('Не удалось прочитать исходные данные. Аварийная копия не создана.');
  return {format:RECOVERY_FORMAT,version:1,exportedAt:new Date().toISOString(),raw:result.raw};
}
async function atomicRecovery(raw,shouldContinue=()=>true) {
  const result=await window.GBHighlights?.restoreRaw?.(raw,shouldContinue);
  if(!result?.ok)throw new Error(result?.reason==='conflict'
    ? 'Аварийная копия отличается от существующих данных. Восстановление без замены невозможно.'
    : result?.reason==='invalid-recovery'
      ? 'В копии есть повреждённый раздел. Сохраните файл для ручного восстановления.'
      : result?.reason==='partial-write'
        ? 'Ошибка восстановления и отката. Сохраните обе копии и проверьте данные.'
        : 'Аварийное восстановление не завершено.');
  try{window.GBFavoriteStore?.notifyImport?.();}catch{}
  return result.restored;
}
async function serializeCurrent() {
  const owner=window.GBHighlights;
  if(typeof owner?.mutateLibrary!=='function') throw new Error('Безопасный экспорт недоступен. Обновите страницу.');
  const names=Object.keys(KEYS);
  const result=await owner.mutateLibrary(Object.values(KEYS),stores=>({
    changes:{},result:{data:Object.fromEntries(names.map(name=>[name,stores[KEYS[name]]]))}
  }));
  if(!result.ok) throw new Error('Не удалось безопасно прочитать все разделы библиотеки. Экспорт отменён, данные не изменены.');
  return result.data;
}
function appendTag(map,key,label) {
  const prior=Object.hasOwn(map,key)?map[key]:[];
  if(!Array.isArray(prior)||prior.some(x=>typeof x!=='string')) return {reason:'invalid-record'};
  const current=safeTags(prior), id=label.toLocaleLowerCase('ru-RU');
  if(current.some(x=>x.toLocaleLowerCase('ru-RU')===id)) return {reason:'duplicate'};
  if(current.length>=MAX.tagsPerItem) return {reason:'capacity'};
  return {value:{...map,[key]:prior.concat(label)}};
}
function updateRevisit(map,action,value) {
  if(action==='hide-today') return {value:{...map,hiddenDate:value}};
  if(action!=='never-quote') return {reason:'invalid-action'};
  const prior=Object.hasOwn(map,'suppressed')?map.suppressed:{};
  if(!prior||typeof prior!=='object'||Array.isArray(prior)) return {reason:'invalid-record'};
  if(Object.hasOwn(prior,value)) return {value:map};
  if(Object.keys(prior).length>=200) return {reason:'capacity'};
  return {value:{...map,suppressed:{...prior,[value]:true}}};
}
function safeMerge(old, next) {
  const quotes=mergeRecords(old.quotes,next.quotes,true,MAX.quotes);
  const notes=mergeRecords(old.notes,next.notes,false,MAX.notes);
  // Newly imported positional records obey the canonical highlight identity.
  // Existing rows are never deduplicated or rewritten here.
  for (const quote of quotes.added) {
    const anchor=quote?.annotation?.version===1 && quote.annotation.anchor;
    if (!anchor || !Number.isInteger(anchor.start) || !Number.isInteger(anchor.end) || typeof anchor.exact!=='string') continue;
    const owner=window?.GBHighlights;
    if(typeof owner?.highlightKey!=='function') throw new Error('Безопасная проверка пометок недоступна. Импорт отменён.');
    const key=owner.highlightKey(quote);
    if(!key || quotes.result.some(other=>other!==quote && owner.highlightKey(other)===key))
      throw new Error('Конфликт позиций пометок. Импорт отменён без изменения данных.');
  }
  checkImportedLinks(quotes.result,notes.result,quotes.added,notes.added);
  const merged = {
    quotes: quotes.result, notes: notes.result,
    favorites: mergeFavorites(old.favorites,next.favorites),
    tags: { ...old.tags }, reading: { ...old.reading },
    revisit: { ...old.revisit },
  };
  for(const [key,value] of Object.entries(next.reading)) {
    if(Object.keys(old.reading).some(prior => prior !== key && cleanPath(prior) === key))
      throw new Error('Конфликт адресов статей в сохранённой библиотеке. Импорт отменён без изменения данных.');
    if(!Object.hasOwn(old.reading,key)) merged.reading[key]=value;
  }
  for (const [key,incoming] of Object.entries(next.tags)) {
    if (!Array.isArray(incoming)) throw new Error('Некорректный список меток. Импорт отменён.');
    const prior=Object.hasOwn(old.tags,key)?old.tags[key]:[];
    if (!Array.isArray(prior) || prior.some(x=>typeof x!=='string'))
      throw new Error('Некорректный список меток. Импорт отменён.');
    const added=prior.slice(), known=new Set(safeTags(prior).map(x=>x.toLocaleLowerCase('ru-RU')));
    for(const label of safeTags(incoming)) {
      const id=label.toLocaleLowerCase('ru-RU');
      if(!known.has(id)){known.add(id);added.push(label);}
    }
    if(known.size>MAX.tagsPerItem) throw new Error('Больше 20 уникальных меток у одной записи. Импорт отменён без изменения данных.');
    if(added.length || Object.hasOwn(old.tags,key)) merged.tags[key]=added;
  }
  const incomingSuppressed=objectMap(next.revisit?.suppressed);
  if(Object.keys(incomingSuppressed).length) {
    if(Object.hasOwn(old.revisit,'suppressed') && (!old.revisit.suppressed || typeof old.revisit.suppressed!=='object' || Array.isArray(old.revisit.suppressed)))
      throw new Error('Некорректные сохранённые исключения из повторения.');
    const prior=objectMap(old.revisit?.suppressed);
    merged.revisit.suppressed={...prior};
    for(const key of Object.keys(incomingSuppressed))
      if(!Object.hasOwn(prior,key)) Object.defineProperty(merged.revisit.suppressed,key,{value:incomingSuppressed[key],enumerable:true,writable:true,configurable:true});
    if(Object.keys(merged.revisit.suppressed).length>200 &&
      Object.keys(merged.revisit.suppressed).length>Object.keys(prior).length)
      throw new Error('Слишком много исключений из повторения.');
  }
  if(!Object.hasOwn(old.revisit,'hiddenDate')&&next.revisit?.hiddenDate)
    merged.revisit.hiddenDate=next.revisit.hiddenDate;
  if ((Object.keys(merged.tags).length > MAX.tags && Object.keys(merged.tags).length>Object.keys(old.tags).length) ||
      (Object.keys(merged.reading).length > MAX.reading && Object.keys(merged.reading).length>Object.keys(old.reading).length))
    throw new Error('Слишком много меток или статусов чтения.');
  return merged;
}
async function atomicImport(next, shouldContinue = () => true) {
  const owner=window.GBHighlights;
  if(typeof owner?.mutateLibrary!=='function') throw new Error('Безопасный импорт недоступен. Обновите страницу.');
  const names=Object.keys(KEYS), keys=Object.values(KEYS);
  let explanation='';
  const result=await owner.mutateLibrary(keys,stores=>{
    if(!shouldContinue()) return {reason:'cancelled'};
    const old=Object.fromEntries(names.map(name=>[name,stores[KEYS[name]]]));
    let merged;
    try { merged=safeMerge(old,next); }
    catch(error) { explanation=error.message;return {reason:'import-conflict'}; }
    const changes=Object.fromEntries(names.filter(name=>!exact(old[name],merged[name]))
      .map(name=>[KEYS[name],merged[name]]));
    return {changes,result:{merged,favoritesChanged:Object.hasOwn(changes,KEYS.favorites)}};
  });
  if(!result.ok) throw new Error(explanation || (result.reason==='partial-write'
    ? 'Ошибка импорта и отката. Сохраните резервную копию текущих данных и проверьте хранилище.'
    : 'Импорт не завершён. Проверьте хранилище и повторите попытку.'));
  if(result.favoritesChanged) {
    try {
      if(window.GBFavoriteStore?.notifyImport) window.GBFavoriteStore.notifyImport();
      else window.dispatchEvent(new CustomEvent('gb:favorites-changed', {detail:{source:'library-import',items:result.merged.favorites}}));
    } catch { /* notifications cannot turn a committed import into failure */ }
  }
  return result.merged;
}

export function createLibraryResearch({ overlay, getItems, notify, refresh, isOpen, renderItem, exitForResume }) {
  let progress;
  let topic = '', sortBy = 'new', tags = objectMap(parse(KEYS.tags, {}));
  let reading = objectMap(parse(KEYS.reading, {}));
  let revisit = objectMap(parse(KEYS.revisit, {}));
  let selectedItem = null, pendingImport = null;
  let importGeneration = 0, importInFlight = false;
  function invalidateImport() {
    importGeneration++;
    pendingImport = null;
    confirmation.hidden = true;
  }
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
  const rawExport = btn('↓ Точная копия', 'export-recovery');
  const jsonImport = btn('↑ Восстановить', 'import-json');
  const offline = node('p', 'gb-hl-info', 'Обычная копия объединяет записи. Точная копия хранит исходные разделы, включая устаревшие данные; восстановление возможно только без замены отличающихся данных.');
  const readingManager = node('div', 'gb-hl-reading-manager');
  menu.append(manageHead, caption, jsonExport, rawExport, jsonImport, offline, readingManager);
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
  async function setTag(item, text) {
    const label = cap(String(text || '').trim().replace(/\s+/g, ' '), 36);
    if (!label) { notify('Введите название метки.', true); return false; }
    const result=await mutateResearch('tags',map=>appendTag(map,stringKey(item),label));
    if(!result.ok) {
      notify(result.reason==='duplicate'?'Такая метка уже есть у записи.':
        result.reason==='capacity'?'Достигнут лимит меток.':
        'Метки не сохранены: данные изменились или хранилище недоступно.',true);
      return false;
    }
    tags=objectMap(parse(KEYS.tags,{}));
    notify('Метка добавлена.');refresh();return true;
  }
  function getTopics(items = getItems()) {
    // Preserve orphan data for Undo/import; do not display orphan-only filters.
    const live = new Set(items.map(stringKey));
    return [...new Set(Object.entries(tags).filter(([key]) => live.has(key))
      .flatMap(([, values]) => safeTags(values)))].sort((a, b) => a.localeCompare(b, 'ru'));
  }
  function reconcileTopic(items) {
    // Filter state must be validated before renderList filters the records:
    // a deleted note may remove the last owner of the selected topic.
    if (topic && !getTopics(items).includes(topic)) topic = '';
  }
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
  async function updateReading(path, state, title) {
    const key=cleanPath(path);
    if(!key)return false;
    const at=Date.now(), fallbackTitle=title||document.title;
    const result=await mutateResearch('reading',map=>changeReading(map,key,state,fallbackTitle,at));
    reading=objectMap(parse(KEYS.reading,{}));
    if(!result.ok){notify('Не удалось безопасно записать статус чтения. Повторите попытку.',true);return false;}
    notify(state === 'reading' ? 'Материал добавлен в «Читаю».' : state === 'finished'
      ? 'Отмечено как прочитанное. Больше не предлагаем.' : 'Материал скрыт из предложений.');
    refresh();return true;
  }
  function eligibleCurrent() {
    const path = currentPath();
    return path !== '/' && !path.startsWith('/izbrannoe') &&
      Boolean(document.querySelector('article,main [data-pagefind-body],main article'));
  }


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
  async function onClick(e) {
    const b = e.target.closest('[data-research-action]');
    if (!b || !overlay.contains(b)) return;
    const action = b.dataset.researchAction, value = b.dataset.value || '';
    if (action === 'manage') {
      menu.hidden = !menu.hidden; manage.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) { fillManager(); jsonExport.focus({ preventScroll: true }); }
      return;
    }
    if (action === 'export-json' || action==='export-recovery') {
      let payload;
      const raw=action==='export-recovery';
      try { payload=raw?await serializeRecovery():{format:FORMAT,version:3,exportedAt:new Date().toISOString(),data:await serializeCurrent()}; }
      catch(error) { notify(error.message,true);return; }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      if (blob.size > (raw ? RECOVERY_MAX_BYTES : BACKUP_MAX_BYTES)) {
        notify(raw ? 'Точная копия больше 32 МБ. Файл не создан.' : 'Копия для объединения больше 4 МБ. Используйте «Точная копия». Файл не создан.', true);
        return;
      }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = raw?'gb-library-recovery.json':'gb-library-backup.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      notify(raw?'Точная аварийная копия сохранена.':'Копия для объединения сохранена.'); return;
    }
    if (action === 'import-json') { file.click(); return; }
    if (action === 'cancel-import') { invalidateImport(); return; }
    if (action === 'confirm-import') {
      if (!pendingImport || importInFlight) return;
      const generation=importGeneration, next=pendingImport;
      importInFlight=true; confirm.disabled=true;
      try {
        const current=()=>generation===importGeneration && pendingImport===next;
        if(next.recovery) await atomicRecovery(next.raw,current);
        else await atomicImport(next.data,current);
        // A commit receipt describes its own transaction, not the current
        // storage after another tab clears or changes it before completion.
        tags=objectMap(parse(KEYS.tags,{}));reading=objectMap(parse(KEYS.reading,{}));revisit=objectMap(parse(KEYS.revisit,{}));
        if(generation===importGeneration) {
          pendingImport=null; confirmation.hidden=true;
          notify(next.recovery?'Точное восстановление завершено без замены данных.':'Импорт завершён без замены существующих записей.');
        }
        refresh();
      } catch(error) { if(generation===importGeneration) notify(error.message,true); }
      finally { importInFlight=false;confirm.disabled=false; }
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
      const item=selectedItem, text=tagInput.value;
      if(tagSave.disabled)return;
      tagSave.disabled=true;
      try {
        if(await setTag(item,text) && selectedItem===item && tagInput.value===text) {
          tagEditor.hidden=true;selectedItem=null;
        }
      } finally {tagSave.disabled=false;}
      return;
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
    if (action === 'start-current') { if(await updateReading(currentPath(), 'reading', document.title.split(' · ')[0])) await progress.rememberProgress(); return; }
    if (action === 'finish-current') { await updateReading(currentPath(), 'finished', document.title.split(' · ')[0]); return; }
    if (action === 'dismiss-current') { await updateReading(currentPath(), 'dismissed', document.title.split(' · ')[0]); return; }
    if (['start-reading', 'finish-reading', 'dismiss-reading'].includes(action)) {
      const state = action === 'start-reading' ? 'reading' : action === 'finish-reading' ? 'finished' : 'dismissed';
      await updateReading(value, state, reading[value]?.title || getItems().find((x) => cleanPath(x.url) === value)?.title || value);
      fillManager(); return;
    }
    if (action === 'resume') { progress.resume(value,notify); return; }
    if (action === 'hide-today' || action === 'never-quote') {
      const choice=action==='hide-today'?today():value;
      const result=await mutateResearch('revisit',map=>updateRevisit(map,action,choice));
      revisit=objectMap(parse(KEYS.revisit,{}));
      if(!result.ok)notify('Не удалось безопасно сохранить исключение. Повторите попытку.',true);
      refresh();
    }
  }
  overlay.addEventListener('click', onClick);
  sort.addEventListener('change', () => { sortBy = sort.value; refresh(); });
  tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tagSave.click(); } });
  file.addEventListener('change', async () => {
    const input = file.files?.[0]; file.value = '';
    invalidateImport();
    const generation = importGeneration;
    if (!input) return;
    if (input.size > RECOVERY_MAX_BYTES) { notify('Файл больше 32 МБ.', true); return; }
    try {
      const contents = await input.text();
      if (generation !== importGeneration) return;
      const json = JSON.parse(contents);
      if(json?.format===RECOVERY_FORMAT) {
        pendingImport={recovery:true,raw:validateRecovery(json)};
        prompt.textContent='Точная копия: будут восстановлены только отсутствующие разделы. Если хотя бы один существующий раздел отличается, операция будет отменена. Повреждённый JSON автоматически не восстанавливается.';
      } else {
        if(input.size>BACKUP_MAX_BYTES)throw new Error('Обычная копия больше 4 МБ.');
        const data=validateBackup(json);
        pendingImport={recovery:false,data};
        prompt.textContent = 'В копии ' + data.quotes.length + ' цитат, '
          + data.notes.length + ' заметок, ' + data.favorites.length
          + ' статей. Существующие записи сохранятся; одинаковые записи не добавятся повторно, при конфликте импорт будет отменён.';
      }
      confirmation.hidden = false;
      requestAnimationFrame(() => {
        if (generation !== importGeneration || confirmation.hidden) return;
        confirmation.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        confirm.focus({ preventScroll: true });
      });
    } catch (error) { if (generation !== importGeneration) return; invalidateImport(); notify('Импорт отменён: ' + error.message, true); }
  });
  function onStorage(event) {
    if (event.storageArea !== localStorage) return;
    const cleared = event.key === null;
    if (cleared) {
      invalidateImport();
      // A stale tag target is not a new record; keep typed input but revoke
      // its old target. The note editor is owned separately and stays open.
      selectedItem = null;
      if (!tagEditor.hidden) {
        tagEditor.hidden = true;
        if (tagEditor.contains(document.activeElement)) h('#gb-hl-list')?.focus({preventScroll:true});
      }
    }
    if (cleared || event.key === KEYS.tags) tags = objectMap(parse(KEYS.tags, {}));
    if (cleared || event.key === KEYS.reading) reading = objectMap(parse(KEYS.reading, {}));
    if (cleared || event.key === KEYS.revisit) revisit = objectMap(parse(KEYS.revisit, {}));
    if (cleared || [KEYS.tags,KEYS.reading,KEYS.revisit].includes(event.key)) {
      if (!menu.hidden) fillManager();
      refresh();
    }
  }
  const controller = Object.freeze({
    getTags, itemMatches, orderItems, decorate, renderGroups, decorateList, reconcileTopic,
    resetMenu() { invalidateImport(); menu.hidden = true; confirmation.hidden = true; tagEditor.hidden = true; manage.setAttribute('aria-expanded', 'false'); },
    handleEscape() {
      importGeneration++;
      if (!confirmation.hidden) { confirmation.hidden = true; pendingImport = null; jsonImport.focus({ preventScroll: true }); return true; }
      if (!tagEditor.hidden) { tagEditor.hidden = true; selectedItem = null; h('#gb-hl-list')?.focus({ preventScroll: true }); return true; }
      if (!menu.hidden) { menu.hidden = true; manage.setAttribute('aria-expanded', 'false'); manage.focus({ preventScroll: true }); return true; }
      return false;
    },
    flushProgressBeforeOpen() { progress.flushBeforeOpen(); },
    resetFilters() { topic = ''; },
    refreshState() { tags = objectMap(parse(KEYS.tags, {})); reading = objectMap(parse(KEYS.reading, {})); revisit = objectMap(parse(KEYS.revisit, {})); },
  });
  // Publish global side effects only after all DOM bindings and the controller
  // are ready. A partially registered factory must not survive a failed mount.
  const lifetime = new AbortController();
  const {signal} = lifetime;
  try {
    window.addEventListener('storage', onStorage, {signal});
    progress = warmReadingProgress({isOpen,exitForResume});
  } catch (error) {
    lifetime.abort();
    throw error;
  }
  return controller;
}

// Pure fail-closed backup contract functions (Node regression tests).
export { safeTags, boundedTags, safeMerge, validateBackup, atomicImport, serializeCurrent, mutateResearch, appendTag, changeReading, updateProgress, updateRevisit, validateRecovery, serializeRecovery, atomicRecovery };
