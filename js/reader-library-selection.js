/* Native selection surface. The synchronous anchor and transaction API remain in highlights.js. */
  const quoteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4V4z"/></svg>';
  const MARK_COLOR_NAMES = { amber: 'янтарный', sage: 'шалфейный', blue: 'голубой', lime: 'лаймовый', rose: 'розовый' };
export function createSelectionController({MARK_COLORS,penSvg,rememberSelection,selection,noteContextForSelection,saveMarker,saveSelectedQuote,open,showEditor,hideToast,element}) {
  function bindSelectionButton(id, label, icon, handler, popup) {
    if (popup.querySelector('#' + id)) return;
    const b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = icon + '<span>' + (id === 'ss-save' ? 'Сохранить' : 'Заметка') + '</span>';
    popup.append(b);
    b.addEventListener('click', handler);
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
      if (await saveMarker(swatch.dataset.hlColor)) dismissSelectionBar();
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
      if (await saveSelectedQuote()) {
        quote.textContent = 'Сохранено';
        clearTimeout(selBarHideTimer);
        selBarHideTimer = setTimeout(() => { quote.textContent = 'Цитата'; dismissSelectionBar(); }, 700);
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
    /* Сброс «отложенного» скрытия: таймер от предыдущего действия не должен
       гасить тулбар, который только что открылся для нового выделения. */
    clearTimeout(selBarHideTimer);
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
  let fallbackAttached = false;
  function attachSelection() {
    const popup = document.getElementById('selection-share-popup');
    if (!popup) {
      if (fallbackAttached) return;
      fallbackAttached = true;
      let pending = 0;
      const schedule = () => { clearTimeout(pending); pending = setTimeout(placeSelectionBar, 40); };
      document.addEventListener('selectionchange', schedule, { passive: true });
      document.addEventListener('mouseup', schedule, { passive: true });
      document.addEventListener('touchend', schedule, { passive: true });
      window.addEventListener('scroll', hide, { passive: true, capture: true });
      window.addEventListener('resize', hide, { passive: true });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
      document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('#gb-hl-selbar')) hide();
      }, { passive: true });
      // Sheet navigation supersedes the short-lived save confirmation. Keep
      // Undo in storage; only dismiss its transient toast and selection bar.
      document.addEventListener('click', (e) => {
        if (e.target.closest('#mobPartTocBtn, [data-gill-marginalia-open]')) { hide(); hideToast(); }
      }, true);
      return;
    }
    hide();
    if (popup.querySelector('#ss-save')) return;
    popup.append(element('span', 'ss-sep'));
    bindSelectionButton('ss-save', 'Сохранить выделенный текст как цитату', quoteSvg, async () => {
      if (await saveSelectedQuote()) {
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
      const context = noteContextForSelection(s);
      const returnTarget = selectionReturnTarget();
      popup.classList.remove('ss-visible');
      popup.setAttribute('aria-hidden', 'true');
      open(document.getElementById('ss-note'),returnTarget).then((opened) => { if (opened) showEditor(context); });
    }, popup);
  }
  return Object.freeze({attachSelection,hide,placeSelectionBar});
}
