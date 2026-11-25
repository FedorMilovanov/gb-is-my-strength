/* On-demand rendering and export layer for the unified reader library.
 * Pure DOM presentation + user-invoked downloads; does not own persistent data.
 * Import on opening the library to keep quote storage/bootstrap lightweight.
 */
function normalizeText(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
function savedDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function element(tag, cls, value) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value != null) node.textContent = value;
  return node;
}
function button(action, label, text) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.libraryAction = action;
  b.setAttribute('aria-label', label);
  b.textContent = text;
  return b;
}

  function renderItem(item, expanded) {
    const card = element('article', 'gb-hl-item');
    card.dataset.type = item.type; card.dataset.id = item.id;
    /* P2: помета остаётся записью типа quote, но в списке она должна читаться
       как помета и нести свой цвет — иначе в библиотеке всё выглядит цитатой. */
    const marker = item.type === 'quote' && item.kind === 'marker';
    const COLORS = { amber: 'янтарный', sage: 'шалфейный', blue: 'голубой', lime: 'лаймовый', rose: 'розовый' };
    const typeRow = element('div', 'gb-hl-type',
      (item.type === 'favorite' ? 'Статья' : marker ? 'Помета' : item.type === 'quote' ? 'Цитата' : 'Заметка') +
      (item.savedAt ? ' · ' + savedDate(item.savedAt) : ''));
    /* Цвет может быть и у цитаты (пользователь выделил уже сохранённую
       цитату) — точка показывается всегда, когда цвет есть. */
    if (item.color) {
      const dot = element('span', 'gb-hl-mark-dot');
      dot.dataset.color = item.color;
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', 'Цвет пометы: ' + (COLORS[item.color] || item.color));
      typeRow.prepend(dot);
    }
    card.append(typeRow);
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
    if (item.type === 'favorite') meta.append(button('remove-favorite', 'Убрать статью из избранного', 'Убрать'));
    else meta.append(button('delete', 'Удалить запись', 'Удалить'));
    card.append(meta);
    return card;
  }

  let favoriteUndoTimer = null, favoriteUndoGeneration = 0, favoriteUndoButton = null;
  function clearFavoriteUndo() {
    favoriteUndoGeneration++;
    clearTimeout(favoriteUndoTimer);
    favoriteUndoTimer = null;
    favoriteUndoButton?.remove();
    favoriteUndoButton = null;
  }
  async function removeFavorite(item, statusMessage) {
    clearFavoriteUndo();
    const generation = favoriteUndoGeneration;
    const store = window.GBFavoriteStore;
    if (!store?.remove || !store?.restore || !store?.get) {
      statusMessage('Хранилище избранного недоступно. Повторите попытку.', true); return;
    }
    const previous = store.get(item.id);
    if (!previous) { statusMessage('Статья уже отсутствует в избранном.'); return; }
    const result = await store.remove(item.id, { source: 'reader-library' });
    if (generation !== favoriteUndoGeneration) return;
    if (result.saved || result.error || !result.receipt) {
      statusMessage('Не удалось убрать статью. Сохранённые данные не изменены.', true); return;
    }
    clearTimeout(favoriteUndoTimer);
    statusMessage('Статья убрана из избранного.');
    const host = document.querySelector('#gb-hl-status');
    const undo = button('undo-favorite', 'Восстановить статью в избранном', 'Отменить');
    favoriteUndoButton = undo;
    host.append(undo);
    undo.focus({ preventScroll: true });
    undo.addEventListener('click', async () => {
      if (generation !== favoriteUndoGeneration || undo.disabled || !undo.isConnected) return;
      undo.disabled=true;
      const restored = await store.restore(result.receipt, { source: 'reader-library-undo' });
      if (generation !== favoriteUndoGeneration) return;
      if (!restored.saved || restored.error) {
        if (restored.error === 'storage-changed') {
          clearFavoriteUndo();
          statusMessage('Данные библиотеки изменились. Прежняя отмена недоступна.', true);
          return;
        }
        statusMessage('Не удалось восстановить статью. Возможно, она уже сохранена.', true);
        const retryHost=document.querySelector('#gb-hl-status');
        retryHost?.append(undo);undo.disabled=false;return;
      }
      clearFavoriteUndo();
      statusMessage('Статья восстановлена.');
      document.querySelector('#gb-hl-list')?.focus({ preventScroll: true });
    });
    favoriteUndoTimer = setTimeout(() => {
      if (generation !== favoriteUndoGeneration) return;
      const stillOwned = undo.parentNode === host;
      clearFavoriteUndo();
      // Do not hide a newer status message that replaced this action.
      if (stillOwned) host.classList.remove('is-visible');
    }, 5000);
  }

  function exportMarkdown(items, statusMessage) {
    if (!items.length) { statusMessage('Библиотека пуста.'); return; }
    const lines = ['# Моя библиотека · Господь Бог — Сила Моя', ''];
    for (const x of items) {
      const COLORS = { amber: 'янтарный', sage: 'шалфейный', blue: 'голубой', lime: 'лаймовый', rose: 'розовый' };
      const kindLabel = x.type === 'note' ? 'Заметка'
        : x.type === 'quote' ? (x.kind === 'marker' ? 'Помета' : 'Цитата')
        : 'Статья';
      const colorLabel = x.type === 'quote' && x.color ? ' (' + (COLORS[x.color] || x.color) + ')' : '';
      lines.push('## ' + kindLabel + colorLabel + ' — ' + x.title);
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
  function exportQuoteCard(item, statusMessage) {
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
      let rest = word;
      while (rest && ctx.measureText(rest).width > 875) {
        if (current) { lines.push(current); current = ''; }
        let piece = '';
        for (const character of rest) {
          if (piece && ctx.measureText(piece + character).width > 875) break;
          piece += character;
        }
        lines.push(piece);
        rest = rest.slice(piece.length);
      }
      if (!rest) continue;
      const next = current ? current + ' ' + rest : rest;
      if (current && ctx.measureText(next).width > 875) {
        lines.push(current); current = rest;
      } else current = next;
    }
    if (current) lines.push(current);
    const lineHeight = size * 1.42, maxLines = Math.floor((1110 - 170) / lineHeight);
    const visible = lines.slice(0, maxLines);
    const shortened = lines.length > maxLines;
    if (shortened) {
      let tail = visible[visible.length - 1];
      while (tail && ctx.measureText(tail + '…').width > 875) tail = tail.slice(0, -1);
      visible[visible.length - 1] = tail + '…';
    }
    const top = Math.max(180, 630 - (visible.length - 1) * lineHeight / 2);
    visible.forEach((line, index) => ctx.fillText(line, 98, top + index * lineHeight));
    if (shortened) {
      ctx.font = '22px Georgia, serif';
      ctx.fillStyle = dark ? '#caa87e' : '#7c5c3b';
      ctx.fillText('Фрагмент цитаты · полный текст в библиотеке', 98, 1155);
      statusMessage('На карточке — фрагмент. Полная цитата сохранена в библиотеке.');
    }
    ctx.font = '30px Georgia, serif';
    ctx.fillStyle = dark ? '#caa87e' : '#7c5c3b';
    let caption = item.title;
    while (caption.length > 1 && ctx.measureText(caption).width > 875) caption = caption.slice(0, -2) + '…';
    ctx.fillText(caption, 98, 1210);
    ctx.fillText('Господь Бог — Сила Моя', 98, 1290);
    canvas.toBlob((blob) => {
      if (!blob) { statusMessage('Не удалось создать PNG-карточку.', true); return; }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'gb-citata.png';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }

  function renderList({ list, items, titleCount, sourceSelect, overlay, tab, filter, searchTerm, shown, expanded, research }) {
    titleCount.textContent = '· ' + items.length;
    const labels = [...new Set(items.map((x) => x.title))].sort((a, b) => a.localeCompare(b, 'ru'));
    if (filter !== 'all' && !labels.includes(filter)) filter = 'all';
    sourceSelect.replaceChildren(new Option('Все статьи', 'all'));
    for (const label of labels) sourceSelect.append(new Option(label, label));
    sourceSelect.value = filter;
    overlay.querySelectorAll('[data-library-tab]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.libraryTab === tab)));
    const filtered = items.filter((x) =>
      (tab === 'all' || tab === 'source' || tab === x.type) &&
      (filter === 'all' || filter === x.title) &&
      (research ? research.itemMatches(x, searchTerm) :
        (!searchTerm || (x.text + ' ' + x.quoteText + ' ' + x.title).toLocaleLowerCase().includes(searchTerm))));
    const ordered = research ? research.orderItems(filtered) : filtered;
    list.replaceChildren();
    if (!filtered.length) {
      const empty = element('div', 'gb-hl-empty');
      empty.append(element('strong', 'gb-hl-empty-title', items.length
        ? 'Пока ничего не найдено' : 'Ваша библиотека ждёт первую запись'));
      empty.append(element('p', '', items.length
        ? 'Попробуйте другую тему или сбросьте фильтры.'
        : 'Выделите цитату, сохраните статью или создайте заметку.'));
      if (items.length) empty.append(button('clear-filters', 'Очистить поиск и фильтры', 'Сбросить фильтры'));
      list.append(empty);
      research?.decorateList(list, items, tab, searchTerm);
      return filter;
    }
    if (tab === 'source' && research) {
      list.append(research.renderGroups(ordered.slice(0, shown), searchTerm));
    } else {
      for (const item of ordered.slice(0, shown)) {
        const card = renderItem(item, expanded);
        research?.decorate(card, item, searchTerm);
        list.append(card);
      }
    }
    if (ordered.length > shown) list.append(button('more', 'Загрузить ещё записи', 'Показать ещё · ' + (ordered.length - shown)));
    research?.decorateList(list, items, tab, searchTerm);
    return filter;
  }

  function trapTab(e, overlay) {
    const controls = [...overlay.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')]
      .filter((node) => !node.closest('[hidden]') && node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  }

  function navigateQuotedSource(e, link, {quotes,GBReaderAnchors,statusMessage,close,hideToast,hide}) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey ||
        e.altKey || e.shiftKey || link.target || link.hasAttribute('download')) return false;
    const card = link.closest('.gb-hl-item[data-type="quote"]');
    const item = card && quotes().find(x => x.id === card.dataset.id);
    // Legacy/cross-page links retain their original openable href; only a
    // verified positional anchor on the CURRENT article can be handled here.
    if (item?.annotation?.version !== 1) return false;
    let destination;
    try { destination = new URL(link.href, location.href); } catch (_) { return false; }
    const normalizePath = p => p.replace(/\/+$/, '') || '/';
    if (destination.origin !== location.origin ||
        normalizePath(destination.pathname) !== normalizePath(location.pathname)) return false;
    const article = document.querySelector('article.article-body') || document.querySelector('article');
    if (!article) return false;
    const first = GBReaderAnchors.resolve(article, item.annotation.anchor);
    e.preventDefault();
    if (!first) {
      statusMessage('Точное место цитаты не найдено. Исходная ссылка остаётся доступной для копирования.', true);
      return true;
    }
    // A same-page anchor cannot scroll while Library retains the page lock.
    // Reuse W63's one-owner exit, then center the exact Range (not the first
    // identical text fragment) and hand keyboard focus to its authored block.
    close();
    // The confirmation toast belongs to the previous save action; the exact
    // reading destination must not be obscured by it after navigation.
    hideToast();
    hide();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const range = GBReaderAnchors.resolve(article, item.annotation.anchor);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      const scrollTop = Math.max(0, window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2);
      window.scrollTo({top: scrollTop, behavior: 'auto'});
      const target = range.startContainer.parentElement?.closest('p,li,blockquote,.manuscript-quote--bilingual');
      if (target instanceof HTMLElement) {
        const hadTabindex = target.hasAttribute('tabindex');
        if (!hadTabindex) target.setAttribute('tabindex', '-1');
        target.focus({preventScroll:true});
        if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once:true});
        target.classList.add('is-search-target');
        window.setTimeout(() => target.classList.remove('is-search-target'), 1600);
      }
    }));
    return true;
  }
  function handleLibraryClick(e, actions) {
    const {all,expanded,deleteItem,clearUndo,statusMessage,showEditor,more,clearFilters}=actions;
    const source = e.target.closest('.gb-hl-item[data-type="quote"] .gb-hl-meta a[href]');
    if (source && navigateQuotedSource(e, source, actions)) return;
    const b = e.target.closest('[data-library-action]');
    if (!b) return;
    const action = b.dataset.libraryAction;
    if (action === 'more') { more(); return; }
    if (action === 'clear-filters') { clearFilters(); return; }
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
    if (action === 'remove-favorite') { clearUndo(); removeFavorite(item, statusMessage); }
    if (action === 'edit-note') showEditor(null, item);
    if (action === 'note-for-quote') showEditor({ quoteId: item.id, quoteSnapshot: item.recordSnapshot, quoteText: item.text, title: item.title, url: item.url });
    if (action === 'card') exportQuoteCard(item, statusMessage);
  }

  const closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>';
  const searchSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';

  function createLibraryPanel(penSvg) {
    const overlay = document.createElement('div');
    overlay.id = 'gb-hl-backdrop';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    overlay.innerHTML = [
      '<section id="gb-hl-panel" role="dialog" aria-modal="true" aria-labelledby="gb-hl-title" tabindex="-1">',
      '<div id="gb-hl-handle" aria-hidden="true"></div>',
      '<header id="gb-hl-header"><div class="gb-hl-heading"><span class="gb-hl-eyebrow">ЛИЧНОЕ СОБРАНИЕ <span id="gb-hl-count"></span></span>',
      '<h2 id="gb-hl-title">Моя библиотека</h2></div>',
      '<button type="button" id="gb-hl-export" aria-label="Скачать материалы библиотеки" title="Цитаты, заметки и ссылки в текстовом файле (.md)">↓ Скачать</button>',
      '<button type="button" id="gb-hl-close" aria-label="Закрыть библиотеку">' + closeSvg + '</button></header>',
      '<nav id="gb-hl-tabs" aria-label="Тип сохранений">',
      '<button type="button" data-library-tab="all" aria-pressed="true">Все</button>',
      '<button type="button" data-library-tab="source" aria-pressed="false">Источники</button>',
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
    const panel = overlay.querySelector('#gb-hl-panel');
    const list = overlay.querySelector('#gb-hl-list');
    const titleCount = overlay.querySelector('#gb-hl-count');
    const search = overlay.querySelector('#gb-hl-search');
    const sourceSelect = overlay.querySelector('#gb-hl-source');
    const status = overlay.querySelector('#gb-hl-status');
    const editor = overlay.querySelector('#gb-hl-editor');
    const textArea = overlay.querySelector('#gb-hl-note-text');
    return {overlay,panel,list,titleCount,search,sourceSelect,status,editor,textArea};
  }

  function createLibraryEditor({overlay,panel,status,editor,textArea,uid,currentTitle,transactionCall,restoreDeleted,NOTES_KEY,render,sync,selectNotes}) {
  let draft = null, pendingUndo = null;
  function statusMessage(message, error) {
    if (!status) return;
    status.replaceChildren(element('span', '', message));
    status.classList.add('is-visible');
    status.classList.toggle('is-error', Boolean(error));
    clearTimeout(statusMessage.timer);
    statusMessage.timer = setTimeout(() => { if (!pendingUndo) status.classList.remove('is-visible'); }, 5000);
  }
  function showEditor(context = null, editing = null) {
    // The opened record itself is the version this editor may overwrite.
    draft = { context, editing, saving:false };
    textArea.readOnly = false;
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
    editor.hidden = true; draft = null; textArea.readOnly = false;
    panel.classList.remove('is-editing');
    if (focus) overlay.querySelector('#gb-hl-new-note').focus({ preventScroll: true });
  }
  async function saveNote(e) {
    e.preventDefault();
    const activeDraft=draft;
    if(!activeDraft||activeDraft.saving)return;
    const text = textArea.value.trim();
    if (!text) { statusMessage('Сначала напишите заметку.', true); return; }
    activeDraft.saving=true;
    textArea.readOnly=true;
    const context=activeDraft.context, editing=activeDraft.editing;
    const created = {
      id: uid('note'), text, ...(context?.quoteId != null ? {quoteId: context.quoteId} : {}), quoteText: context && context.quoteText || '',
      articleTitle: context && context.title || currentTitle(),
      url: context && context.url || location.origin + location.pathname,
      savedAt: Date.now(),
    };
    let result;
    try { result = await transactionCall('saveNoteRecord',{context,editing,created,text}); } catch { result={ok:false}; }
    finally {
      activeDraft.saving=false;
      if(draft===activeDraft)textArea.readOnly=false;
    }
    // A late save must never close or replace a newer editor.
    if(draft!==activeDraft)return;
    if (result.conflict && editing) {
      const live = result.current.find(x => x && String(x.id) === String(editing.id));
      statusMessage(live
        ? 'Заметка изменена в другом редакторе. Черновик не сохранён; скопируйте его перед повторным открытием заметки.'
        : 'Заметка удалена в другом редакторе. Черновик не сохранён; скопируйте его перед закрытием редактора.', true);
      return;
    }
    if (!result.ok) {
      const message = result.reason === 'capacity'
        ? 'Достигнут лимит заметок. Экспортируйте библиотеку перед удалением старых записей.'
        : result.reason === 'link-conflict'
          ? 'Цитата или её связь изменилась. Откройте её заново; черновик остаётся в редакторе.'
          : 'Не удалось безопасно сохранить заметку. Черновик остаётся в редакторе; повторите попытку.';
      statusMessage(message, true); return;
    }
    // Only the editor that initiated this completed save may be closed.
    applySavedNote(editing);
  }
  function applySavedNote(editing) {
    hideEditor(false);
    selectNotes();
    render(); sync();
    statusMessage(editing ? 'Заметка обновлена.' : 'Заметка сохранена.');
  }
  function clearUndo() {
    clearFavoriteUndo();
    if (pendingUndo) clearTimeout(pendingUndo.timer);
    pendingUndo = null;
    if (status) { status.replaceChildren(); status.classList.remove('is-visible'); }
  }
  async function deleteItem(item) {
    const deleted = await transactionCall('deleteRecord',item);
    if (!deleted.ok) {
      statusMessage(deleted.reason === 'duplicate'
        ? 'Найдено несколько версий этой записи. Сначала сохраните резервную копию библиотеки; удаление отменено.'
        : deleted.reason === 'partial-write'
          ? 'Ошибка удаления и восстановления связи. Экспортируйте текущие данные и проверьте библиотеку.'
          : 'Не удалось безопасно удалить запись. Обновите библиотеку и повторите.', true);
      return;
    }
    clearUndo();
    pendingUndo = deleted.receipt;
    render(); sync();
    const u = pendingUndo;
    let restoring = false;
    function showUndo(message, allowCopy = false) {
      if (pendingUndo !== u) return;
      const undoButton = button('undo', 'Отменить удаление', 'Отменить');
      const controls = [element('span', '', message), undoButton];
      undoButton.addEventListener('click', () => restore(false));
      if (allowCopy) {
        const copyButton = button('undo-copy', 'Сохранить удалённую версию с отдельным ID', 'Сохранить копию');
        copyButton.addEventListener('click', () => restore(true));
        controls.push(copyButton);
      }
      status.replaceChildren(...controls);
      status.classList.add('is-visible');
      status.classList.remove('is-error');
    }
    async function restore(copy) {
      if (pendingUndo !== u || restoring) return;
      restoring = true;
      clearTimeout(u.timer);
      const result = await restoreDeleted(u, copy ? uid(u.key === NOTES_KEY ? 'note' : 'quote') : null);
      restoring = false;
      if (pendingUndo !== u) { if (result.ok) { render(); sync(); } return; }
      if (result.ok) {
        clearUndo(); render(); sync();
        statusMessage(copy ? 'Версия сохранена отдельной копией без прежней связи.' : 'Запись восстановлена.');
        return;
      }
      const collision = ['id-collision','link-conflict'].includes(result.reason);
      const message = result.reason === 'capacity'
        ? 'Лимит библиотеки достигнут. Освободите место или сохраните экспорт.'
        : result.reason === 'partial-write'
          ? 'Ошибка восстановления. Сохраните экспорт и проверьте библиотеку.'
          : collision
            ? 'Запись или её связь уже изменилась. Можно сохранить отдельную копию без прежней связи.'
            : 'Восстановление не удалось. Повторите попытку.';
      showUndo(message, collision);
      u.timer = setTimeout(clearUndo, 30000);
    }
    showUndo('Запись удалена');
    pendingUndo.timer = setTimeout(clearUndo, 6000);
  }
  return Object.freeze({showEditor,hideEditor,saveNote,clearUndo,deleteItem,statusMessage});
  }

  // No pending intent state here: the bootstrap alone owns cancellation.
  function createMountedLifecycle({overlay,editor,research,editorController,reset,render,close}) {
    const ownerId='reader-library';
    let layerRuntime=null;
    // Runtime recovery may close a registered layer without requesting it.
    // Reconcile the library's visual/editor state through its existing owner.
    document.addEventListener('gb:overlay-close',event=>{
      if(layerRuntime&&event.detail?.ownerId===ownerId)close();
    });
    function activate(fab,opener) {
      reset();
      overlay.removeAttribute('inert');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      fab.setAttribute('aria-expanded', 'true');
      if (opener !== fab && opener?.getAttribute?.('aria-haspopup') === 'dialog') {
        opener.setAttribute('aria-controls','gb-hl-panel');
        opener.setAttribute('aria-expanded','true');
      }
      // Participate in the canonical overlay/print lock authority. The library
      // retains its nested editor Escape/Tab and bootstrap focus-return policy.
      layerRuntime=window.OverlayRuntime?.open&&window.OverlayRuntime?.close?window.OverlayRuntime:null;
      if(layerRuntime)layerRuntime.open(ownerId,{element:overlay,opener,
        focusTarget:()=>overlay.querySelector('#gb-hl-close'),closeOnEscape:false,
        trapFocus:false,restoreFocus:false,lockScroll:true,
        onRequestClose:()=>{close();return false;}});
      else if (window.SiteUtils && window.SiteUtils.lockScroll) window.SiteUtils.lockScroll('highlights');
      else document.body.classList.add('no-scroll');
      overlay.querySelector('#gb-hl-close').focus({ preventScroll: true });
      render();
    }
    function deactivate(fab,opener) {
    editorController.hideEditor(false);
    editorController.clearUndo();
    research?.resetMenu();
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    fab.setAttribute('aria-expanded', 'false');
    if (opener !== fab && opener?.getAttribute?.('aria-haspopup') === 'dialog') opener.setAttribute('aria-expanded','false');
    if(layerRuntime){const runtime=layerRuntime;layerRuntime=null;runtime.close(ownerId,'library-close',{restoreFocus:false});}
    else if (window.SiteUtils && window.SiteUtils.unlockScroll) window.SiteUtils.unlockScroll('highlights');
    else document.body.classList.remove('no-scroll');
    }
    function keydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!editor.hidden) editorController.hideEditor();
      else if (!research?.handleEscape()) close();
    }
    else if (e.key === 'Tab' ) trapTab(e, overlay);
    }
    return {activate,deactivate,keydown};
  }

  // The mounted view owns all list state and event bindings. Opening intent
  // and scroll/focus ownership remain with the synchronous bootstrap.
  function createLibraryView({penSvg,uid,currentTitle,transactionCall,restoreDeleted,NOTES_KEY,all,quotes,GBReaderAnchors,statusMessage,close,hideToast,hide,sync,normalizeText,BATCH_SIZE,createResearch,isOpen}) {
    const {overlay,panel,list,titleCount,search,sourceSelect,status,editor,textArea}=createLibraryPanel(penSvg);
    let tab='all',filter='all',searchTerm='',shown=BATCH_SIZE;
    const expanded=new Set();
    let research;
    function reset() {
      tab='all';filter='all';searchTerm='';shown=BATCH_SIZE;search.value='';
      research?.refreshState?.();
    }
    function render() {
      const items=all();
      research?.reconcileTopic?.(items);
      filter=renderList({list,items,titleCount,sourceSelect,overlay,tab,filter,searchTerm,shown,expanded,research});
    }
    try {
    const editorController=createLibraryEditor({overlay,panel,status,editor,textArea,uid,currentTitle,transactionCall,restoreDeleted,NOTES_KEY,render,sync,
      selectNotes:()=>{tab='note';filter='all';shown=BATCH_SIZE;}
    });
      overlay.querySelector('#gb-hl-close').addEventListener('click',close);
      overlay.querySelector('#gb-hl-export').addEventListener('click',()=>{
        try {exportMarkdown(all(),statusMessage);}
        catch {statusMessage('Не удалось подготовить экспорт. Повторите попытку.',true);}
      });
      overlay.querySelector('#gb-hl-new-note').addEventListener('click',()=>editorController.showEditor());
      overlay.querySelector('#gb-hl-note-cancel').addEventListener('click',editorController.hideEditor);
      overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
      overlay.querySelector('#gb-hl-tabs').addEventListener('click',e=>{
        const b=e.target.closest('[data-library-tab]');
        if(!b)return;
        tab=b.dataset.libraryTab;shown=BATCH_SIZE;render();
      });
      search.addEventListener('input',()=>{searchTerm=normalizeText(search.value).toLocaleLowerCase();shown=BATCH_SIZE;render();});
      sourceSelect.addEventListener('change',()=>{filter=sourceSelect.value;shown=BATCH_SIZE;render();});
      list.addEventListener('click',e=>handleLibraryClick(e,{
        quotes,GBReaderAnchors,statusMessage,close,hideToast,hide,all,expanded,
        deleteItem:editorController.deleteItem,clearUndo:editorController.clearUndo,showEditor:editorController.showEditor,
        more:()=>{shown+=BATCH_SIZE;render();},
        clearFilters:()=>{searchTerm='';search.value='';filter='all';research?.resetFilters();shown=BATCH_SIZE;render();}
      }));
      editor.addEventListener('submit',editorController.saveNote);
      research=createResearch({overlay,getItems:all,notify:statusMessage,refresh:render,isOpen,renderItem,
        exitForResume:scrollToSavedPosition=>{close();requestAnimationFrame(()=>requestAnimationFrame(scrollToSavedPosition));}
      });
      const lifecycle=createMountedLifecycle({overlay,editor,research,editorController,reset,render,close});
      return Object.freeze({overlay,editorController,reset,render,...lifecycle});
    } catch(error) {
      overlay.remove();
      throw error;
    }
  }

export { createLibraryView, createLibraryEditor, createLibraryPanel, renderList, renderItem, exportMarkdown, exportQuoteCard, removeFavorite, trapTab, handleLibraryClick };
