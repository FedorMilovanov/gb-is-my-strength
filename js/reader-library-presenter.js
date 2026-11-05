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

  function exportMarkdown(items, statusMessage) {
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

  function renderList({ list, items, titleCount, sourceSelect, overlay, tab, filter, searchTerm, shown, expanded }) {
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
      return filter;
    }
    for (const item of filtered.slice(0, shown)) list.append(renderItem(item, expanded));
    if (filtered.length > shown) list.append(button('more', 'Загрузить ещё записи', 'Показать ещё · ' + (filtered.length - shown)));
    return filter;
  }

  function trapTab(e, overlay) {
    const controls = [...overlay.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')]
      .filter((node) => !node.closest('[hidden]') && node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  }

export { renderList, renderItem, exportMarkdown, exportQuoteCard, trapTab };
