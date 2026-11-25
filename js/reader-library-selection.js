/* Native selection surface. The synchronous anchor and transaction API remain in highlights.js. */
  const quoteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4V4z"/></svg>';
  const MARK_COLOR_NAMES = { amber: 'янтарный', sage: 'шалфейный', blue: 'голубой', lime: 'лаймовый', rose: 'розовый' };
export function createSelectionController({MARK_COLORS,penSvg,rememberSelection,selection,open,showEditor,hideToast,element,uid,currentTitle,normalizeText,transactionCall,gbHighlightKey,gbAddHighlight,gbHighlightPath,gbHighlightText,gbContextKey,GBReaderAnchors,locate,textIndex,paintMarks,sync,statusMessage,toast,quotes}) {
  function fragment(text) {
    const words = normalizeText(text).split(/\s+/);
    return words.length <= 14 ? 'text=' + encodeURIComponent(text)
      : 'text=' + encodeURIComponent(words.slice(0, 6).join(' ')) + ',' + encodeURIComponent(words.slice(-6).join(' '));
  }
  function sourceUrl(selected) {
    return location.origin + location.pathname + '#' +
      (selected.anchor ? encodeURIComponent(selected.anchor) : '') + ':~:' + fragment(selected.text);
  }
  // Both touch selection-bar notes and the native selection popup share
  // exactly one positional quote association. Text-only equivalence is never
  // sufficient: repeated words and old legacy links are ambiguous.
  function noteContextForSelection(selected) {
    if (!selected || selected.text.length < 8) return null;
    const context = { quoteText: selected.text, url: sourceUrl(selected), title: currentTitle() };
    if (!selected.positionalAnchor) return context;
    const article = document.querySelector('article.article-body') || document.querySelector('article');
    if (!article) return context;
    const resolve = GBReaderAnchors.resolution(article);
    const exact = resolve(selected.positionalAnchor);
    if (!exact) return context;
    const here = gbHighlightPath({url:location.href});
    const matches = quotes().filter(item => {
      if (item.annotation?.version !== 1 || gbHighlightPath(item) !== here) return false;
      const stored = resolve(item.annotation.anchor);
      return stored && GBReaderAnchors.sameRange(exact, stored);
    });
    // Keep a useful unlinked note if this occurrence is new, legacy, or
    // ambiguous. Never assign a quoteId from a coincidental text match.
    if (matches.length === 1) {
      context.quoteId = matches[0].id;
      context.quoteSnapshot = JSON.stringify(matches[0]);
    }
    return context;
  }
  function undoQuotes(written, previous, message) {
    return async () => {
      const result = await transactionCall('undoQuoteRecord',written,previous);
      if (!result.ok) {
        toast('Запись уже изменилась или недоступна. Отмена не выполнена.', { label: 'Повторить', run: undoQuotes(written, previous, message) });
        return;
      }
      paintMarks(); sync(); toast(message, null);
    };
  }

  async function saveSelectedQuote() {
    const selected = selection();
    if (selected.text.length < 8) { statusMessage('Сначала выделите текст.', true); return false; }
    const record = {
      id: uid('quote'), text: selected.text, articleTitle: currentTitle(),
      url: sourceUrl(selected), before: selected.before, after: selected.after, savedAt: Date.now(),
    };
    // A quote is an occurrence, not merely its string. The same words may
    // appear twice in one paragraph; keep both positional sources. Do not
    // assign an annotation to a legacy record whose position is unknown.
    if (selected.positionalAnchor) {
      record.annotation = { version: 1, kind: 'quote',
        anchor: selected.positionalAnchor, noteId: null };
    }
    const result = await transactionCall('saveQuoteRecord',record,gbAddHighlight);
    if (!result.ok) {
      statusMessage(result.reason === 'capacity'
        ? 'Сохранено 200 цитат — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.'
        : 'Не удалось безопасно сохранить цитату. Повторите попытку.', true);
      return false;
    }
    if (result.already) { statusMessage('Такая цитата уже сохранена.'); return true; }
    sync(); statusMessage('Цитата сохранена вместе с источником.');
    toast('Цитата сохранена', { label: 'Вернуть', run: undoQuotes(record, null, 'Цитата убрана') });
    return true;
  }
  /* Ключ фрагмента — страница + текст без контекста. По нему ищем запись,
     когда пользователь перекрашивает уже сохранённую цитату. */
  function gbFragmentKey(x) {
    const t = gbHighlightText(x);
    return !t ? '' : gbHighlightPath(x) + '\n' + t;
  }
  function findMarkerIndex(old,record) {
    const fragment = gbFragmentKey(record);
    const context = gbContextKey(record);
    const article = document.querySelector('article.article-body') || document.querySelector('article');
    const resolve = article && record.annotation ? GBReaderAnchors.resolution(article) : null;
    const exact = resolve?.(record.annotation.anchor);
    let legacyIndex = null;
    let existingIndex = -1;
    if (exact && article) {
      // A saved quote and its colored mark are ONE positional record. Reuse
      // its ID/anchor/noteId instead of losing the mark to duplicate-key
      // rejection. If legacy data already contains both, prefer the colored
      // record to avoid creating a second painter on the same DOM Range.
      const candidates = [];
      const here=gbHighlightPath(record);
      old.forEach((x, i) => {
        if (gbHighlightPath(x) !== here) return;
        const found = x.annotation?.version === 1
          ? resolve(x.annotation.anchor)
          : locate(legacyIndex ||= textIndex(article),x);
        if (GBReaderAnchors.sameRange(found, exact)) candidates.push(i);
      });
      existingIndex = candidates.find(i => Boolean(old[i].color || old[i].annotation?.color))
        ?? candidates[0] ?? -1;
    } else if (!record.annotation) {
      existingIndex = fragment ? old.findIndex((x) =>
        gbFragmentKey(x) === fragment && gbContextKey(x) === context) : -1;
    }

    return existingIndex;
  }

  async function saveMarker(color) {
    const selected = selection();
    if (selected.text.length < 3) { statusMessage('Сначала выделите текст.', true); return false; }
    const nextColor = MARK_COLORS.includes(color) ? color : 'amber';
    const record = {
      id: uid('mark'), kind: 'marker', color: nextColor,
      text: selected.text, articleTitle: currentTitle(),
      url: sourceUrl(selected), before: selected.before, after: selected.after, savedAt: Date.now(),
    };
    if (selected.positionalAnchor) {
      record.annotation = { version:1,kind:'marker',color:nextColor,
        anchor:selected.positionalAnchor,noteId:null };
    }
    /* Одна запись на (страница + текст): иначе gbAddHighlight молча отбрасывал
       вторую запись, а пользователь видел «Помета сохранена». Здесь тот же
       текст перекрашивается, а одинаковый цвет честно сообщается как уже
       применённый — без ложного успеха. */
    const key = gbHighlightKey(record);
    const mutation = await transactionCall('saveMarkerRecord',record,nextColor,findMarkerIndex,gbAddHighlight);
    if (!mutation.ok) {
      statusMessage(mutation.reason === 'capacity'
        ? 'Сохранено 200 помет — достигнут прежний лимит. Экспортируйте библиотеку перед удалением старых записей.'
        : 'Не удалось безопасно сохранить помету. Повторите попытку.', true);
      return false;
    }
    if (mutation.already) {
      statusMessage('Этот текст уже выделен этим цветом.');
      toast('Этот текст уже выделен этим цветом', null);
      return true;
    }
    if (mutation.previous) {
      const painted = paintMarks();
      sync();
      const wasMarker = mutation.previous.kind === 'marker';
      const storedKey = gbHighlightKey(mutation.written);
      const anchored = painted.supported && painted.placed && painted.placed.has(storedKey);
      const base = wasMarker ? 'Цвет пометы изменён' : 'Цитата выделена цветом';
      const message = !painted.supported
        ? (wasMarker ? 'Цвет пометы сохранён, подсветка недоступна' : 'Цвет сохранён, подсветка недоступна')
        : anchored ? base
          : (wasMarker ? 'Цвет пометы сохранён, но подсветить не удалось' : 'Цвет сохранён, но подсветить не удалось');
      statusMessage(message + '.');
      toast(message, { label: 'Вернуть', run: undoQuotes(mutation.written, mutation.previous, 'Цвет возвращён') });
      return true;
    }
    const result = paintMarks();
    sync();
    /* Честность сообщения: «подсвечена» говорим только если запись реально
       получила диапазон в тексте. Иначе пользователь видит успех при пустом
       экране (так было при выделении через границу абзацев). */
    const anchored = result.supported && result.placed && result.placed.has(key);
    const message = !result.supported
      ? 'Помета сохранена. Подсветка недоступна в этом браузере'
      : anchored
        ? 'Помета сохранена и подсвечена'
        : 'Помета сохранена, но этот фрагмент не удалось подсветить';
    statusMessage(message + (result.supported && !anchored ? '. Он останется в библиотеке.' : '.'));
    toast(message, { label: 'Вернуть', run: undoQuotes(record, null, 'Помета убрана') });
    return true;
  }

  // Selection toolbar and popup share one feedback intent, never a stale
  // asynchronous continuation from a previous text range.
  let activeAction = null, selectionFeedback = null;
  function liveRange() {
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    return [r.startContainer,r.startOffset,r.endContainer,r.endOffset,r.toString()];
  }
  function clearSelectionFeedback() {
    const previous = selectionFeedback;
    selectionFeedback = null;
    clearTimeout(selBarHideTimer);
    if (previous) previous.reset();
  }
  function beginSelectionAction(surface, visible) {
    clearSelectionFeedback();
    const range = liveRange(), url = location.href;
    const current = () => {
      const now = liveRange();
      return activeAction === current && surface.isConnected && visible() &&
        url === location.href && !!range && !!now && range.every((value,i)=>value===now[i]);
    };
    current.surface = surface;
    activeAction = current;
    return current;
  }
  function reconcileSelectionFeedback() {
    if (activeAction && !activeAction()) activeAction = null;
    if (selectionFeedback && !selectionFeedback.current()) clearSelectionFeedback();
  }
  function showSelectionFeedback(current, reset, finish, delay) {
    selectionFeedback = {current,reset};
    selBarHideTimer = setTimeout(() => {
      if (selectionFeedback?.current !== current) return;
      const stillCurrent = current();
      clearSelectionFeedback();
      if (stillCurrent) finish();
    },delay);
  }

  function bindSelectionButton(id, label, icon, handler, popup, created) {
    if (popup.querySelector('#' + id)) return;
    const b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = icon + '<span>' + (id === 'ss-save' ? 'Сохранить' : 'Заметка') + '</span>';
    created.push(b);
    b.addEventListener('click', handler);
    popup.append(b);
  }
  function selectionReturnTarget() {
    const sel = window.getSelection?.();
    if (!sel?.isCollapsed && sel?.rangeCount) {
      const host = sel.getRangeAt(0).commonAncestorContainer;
      const node = host.nodeType === 1 ? host : host.parentElement;
      const block = node?.closest('p,li,blockquote,h2,h3,h4,article');
      if (block?.closest('article,main [data-pagefind-body]')) return block;
    }
    return document.querySelector('article.article-body h1, article h1, main h1');
  }
  function mobileSelectionBar() {
    let bar = document.getElementById('gb-hl-selbar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'gb-hl-selbar';
    bar.className = 'gb-hl-selbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Действия с выделенным текстом');
    bar.setAttribute('aria-hidden', 'true');
    const colors = document.createElement('div');
    colors.className = 'gb-hl-selbar-colors';
    colors.setAttribute('role', 'group');
    colors.setAttribute('aria-label', 'Цвет пометы');
    for (const color of MARK_COLORS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'gb-hl-selbar-swatch';
      swatch.dataset.hlColor = color;
      const colorName = MARK_COLOR_NAMES[color] || color;
      swatch.setAttribute('aria-label', 'Выделить цветом: ' + colorName);
      swatch.title = 'Выделить цветом: ' + colorName;
      colors.appendChild(swatch);
    }
    const quote = document.createElement('button');
    quote.type = 'button';
    quote.id = 'gb-hl-selbar-quote';
    quote.setAttribute('aria-label', 'Сохранить выделенный текст как цитату');
    quote.textContent = 'Цитата';
    const note = document.createElement('button');
    note.type = 'button';
    note.id = 'gb-hl-selbar-note';
    note.setAttribute('aria-label', 'Добавить заметку к выделенному тексту');
    note.textContent = 'Заметка';
    bar.append(colors, quote, note);
    colors.addEventListener('click', async (e) => {
      const swatch = e.target.closest('[data-hl-color]');
      if (!swatch) return;
      const current = beginSelectionAction(bar,()=>bar.dataset.open==='true');
      if (await saveMarker(swatch.dataset.hlColor) && current()) dismissSelectionBar();
    });
    document.body.appendChild(bar);
    /* Pointerdown snapshots the selection without cancelling the native gesture.
       preventDefault on touchstart suppresses Chrome's compatibility click, so
       mobile swatch, Quote and Note taps must keep their default behavior.
       Cancelling mousedown preserves the text selection for mouse users. */
    for (const b of [quote, note, ...colors.querySelectorAll('button')]) {
      b.addEventListener('pointerdown', rememberSelection);
      b.addEventListener('mousedown', (event) => event.preventDefault(), { passive: false });
    }
    quote.addEventListener('click', async () => {
      const current = beginSelectionAction(bar,()=>bar.dataset.open==='true');
      if (await saveSelectedQuote() && current()) {
        quote.textContent = 'Сохранено';
        showSelectionFeedback(current,()=>{quote.textContent='Цитата';},dismissSelectionBar,700);
      }
    });
    note.addEventListener('click', () => {
      const s = selection();
      const context = noteContextForSelection(s);
      const returnTarget = selectionReturnTarget();
      hide();
      open(note,returnTarget).then((opened) => { if (opened) showEditor(context); });
    });
    return bar;
  }
  function hide() {
    const bar = document.getElementById('gb-hl-selbar');
    if (!bar) return;
    if (activeAction?.surface === bar) {
      activeAction = null;
      clearSelectionFeedback();
    }
    bar.dataset.open = 'false';
    bar.setAttribute('aria-hidden', 'true');
  }
  /* После действия выделение снимаем: если оставить его, следующий тап по тому
     же тексту Chrome трактует как перетаскивание уже выделенного фрагмента —
     mouseup не доходит, и тулбар для этого текста больше не открывается. */
  function collapseSelection() {
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
    } catch {}
  }
  function dismissSelectionBar() { hide(); collapseSelection(); }
  let selBarHideTimer = 0;
  function placeSelectionBar() {
    if (document.getElementById('npW57SelectionToolbar') || document.getElementById('selection-share-popup')) { hide(); return; }
    // A touchend can re-schedule this bar after the TOC trigger's pointerdown
    // hid it. Never project selection actions over an open reading sheet.
    if (document.querySelector('#partTocOverlay.is-open')) { hide(); return; }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hide(); return; }
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 8) { hide(); return; }
    const range = sel.getRangeAt(0);
    const host = range.commonAncestorContainer;
    const node = host.nodeType === 1 ? host : host.parentElement;
    if (!node || node.closest('#gb-hl-panel, #gb-hl-selbar, input, textarea, [contenteditable="true"]')) { hide(); return; }
    if (!node.closest('article, main, .article-body')) { hide(); return; }
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) { hide(); return; }
    const bar = mobileSelectionBar();
    reconcileSelectionFeedback();
    bar.dataset.open = 'true';
    bar.setAttribute('aria-hidden', 'false');
    const bw = bar.offsetWidth || 180;
    const bh = bar.offsetHeight || 56;
    const clampX = Math.min(Math.max(8, rect.left + rect.width / 2 - bw / 2), window.innerWidth - bw - 8);
    /* Нижняя панель читалки фиксирована и выше тулбара по z-index, поэтому
       при размещении под выделением её высоту нужно вычитать — иначе тулбар
       уезжает под панель и до кнопок не достать. */
    const bottomBar = document.querySelector('.mobile-bottom-bar, .gbs2-bbar');
    const bottomInset = bottomBar
      ? Math.max(0, Math.round(window.innerHeight - bottomBar.getBoundingClientRect().top)) : 0;
    const maxBottom = window.innerHeight - bottomInset - 8;
    let top = rect.top - bh - 10;
    if (top < 68) {
      top = rect.bottom + 10;
      if (top + bh > maxBottom) top = Math.max(68, rect.top - bh - 10);
      top = Math.min(top, maxBottom - bh);
    }
    bar.style.left = Math.round(clampX) + 'px';
    bar.style.top = Math.round(Math.max(8, top)) + 'px';
  }
  let fallbackCleanup = null;
  function attachSelection() {
    reconcileSelectionFeedback();
    const popup = document.getElementById('selection-share-popup');
    if (!popup) {
      if (fallbackCleanup) return;
      const bindings = [];
      let pending = 0;
      let active = true;
      const listen = (target, type, handler, options) => {
        const guarded = event => { if (active) handler(event); };
        bindings.push(() => target.removeEventListener(type, guarded, options));
        target.addEventListener(type, guarded, options);
      };
      const schedule = () => {
        clearTimeout(pending);
        pending = setTimeout(() => { if (active) placeSelectionBar(); }, 40);
      };
      const cleanup = () => {
        active = false;
        clearTimeout(pending);
        clearSelectionFeedback();
        activeAction = null;
        for (const remove of bindings) remove();
        const quote = document.getElementById('gb-hl-selbar-quote');
        if (quote) quote.textContent = 'Цитата';
        fallbackCleanup = null;
      };
      try {
        listen(document, 'selectionchange', schedule, { passive: true });
        listen(document, 'mouseup', schedule, { passive: true });
        listen(document, 'touchend', schedule, { passive: true });
        listen(window, 'scroll', hide, { passive: true, capture: true });
        listen(window, 'resize', hide, { passive: true });
        listen(document, 'keydown', e => { if (e.key === 'Escape') hide(); });
        listen(document, 'pointerdown', e => {
          if (!e.target.closest('#gb-hl-selbar')) hide();
        }, { passive: true });
        listen(document, 'click', e => {
          if (e.target.closest('#mobPartTocBtn, [data-gill-marginalia-open]')) { hide(); hideToast(); }
        }, true);
      } catch (error) {
        cleanup();
        throw error;
      }
      fallbackCleanup = cleanup;
      return;
    }
    fallbackCleanup?.();
    hide();
    const hasSave=popup.querySelector('#ss-save'),hasNote=popup.querySelector('#ss-note');
    if (hasSave && hasNote) return;
    const created=[];
    try {
      if (!hasSave && !hasNote) {
        const separator=element('span','ss-sep');
        created.push(separator);
        popup.append(separator);
      }
      bindSelectionButton('ss-save', 'Сохранить выделенный текст как цитату', quoteSvg, async () => {
        const current = beginSelectionAction(popup,()=>popup.classList.contains('ss-visible'));
        if (await saveSelectedQuote() && current()) {
          const label = popup.querySelector('#ss-save span');
          if (label) label.textContent = 'Сохранено';
          popup.classList.add('gb-hl-selection-saved');
          showSelectionFeedback(current,()=>{
            if (label?.isConnected) label.textContent='Сохранить';
            popup.classList.remove('gb-hl-selection-saved');
          },()=>{
            popup.classList.remove('ss-visible');
            popup.setAttribute('aria-hidden','true');
          },660);
        }
      }, popup, created);
      bindSelectionButton('ss-note', 'Добавить заметку к выделенному тексту', penSvg, () => {
        const s = selection();
        const context = noteContextForSelection(s);
        const returnTarget = selectionReturnTarget();
        activeAction = null;
        clearSelectionFeedback();
        popup.classList.remove('ss-visible');
        popup.setAttribute('aria-hidden', 'true');
        open(document.getElementById('ss-note'),returnTarget).then((opened) => { if (opened) showEditor(context); });
      }, popup, created);
    } catch (error) {
      for (const node of created) node.remove();
      throw error;
    }
  }
  return Object.freeze({attachSelection,hide,placeSelectionBar});
}
