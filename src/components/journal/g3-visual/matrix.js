function bindG3Matrix(root) {
  if (root.dataset.gmBound) return;
  const controls = root.querySelector('.gm-filter');
  const query = root.querySelector('input');
  const year = root.querySelector('select');
  const reset = root.querySelector('button');
  const status = root.querySelector('.gm-status');
  if (!controls || !query || !year || !reset || !status) return;
  root.dataset.gmBound = 'true';
  const rows = [...root.querySelectorAll('.gm-row')];
  function update() {
    const term = query.value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е');
    let count = 0;
    rows.forEach(row => {
      const name = (row.querySelector('.gm-name')?.textContent || '').toLocaleLowerCase('ru-RU').replaceAll('ё','е');
      const selected = !year.value || (row.getAttribute('data-years') || '').split(' ').includes(year.value);
      row.hidden = !(name.includes(term) && selected);
      if (!row.hidden) count++;
    });
    status.textContent = count ? `Найдено имён: ${count}.` : 'Нет совпадений в этой подборке. Измените фильтр.';
  }
  controls.hidden = false; status.hidden = false;
  query.addEventListener('input', update); year.addEventListener('change', update);
  reset.addEventListener('click', () => { query.value = ''; year.value = ''; update(); query.focus(); });
  update();
  function restoreTarget(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    if (!id) return;
    const target = document.getElementById(id);
    const row = target?.closest('.gm-row');
    if (!row || !root.contains(row) || !row.hidden) return;
    query.value = ''; year.value = ''; update();
    target.focus({preventScroll:true}); target.scrollIntoView({block:'center'});
  }
  // Explicit local links are handled before native fragment navigation. Both history
  // events can follow later (notably WebKit); do not clear a newly entered filter
  // again for a destination already handled by this activation.
  let observedHash = location.hash;
  function reconcileHash() {
    const hash = location.hash;
    if (hash === observedHash) return;
    observedHash = hash;
    restoreTarget(hash);
  }
  const article = root.closest('[data-journal-source-navigation]');
  article?.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link || link.origin !== location.origin || link.pathname !== location.pathname ||
        link.search !== location.search || !link.hash || link.hasAttribute('download') ||
        (link.target && link.target !== '_self')) return;
    observedHash = link.hash;
    restoreTarget(link.hash);
  });
  window.addEventListener('popstate', reconcileHash);
  window.addEventListener('hashchange', reconcileHash);
  restoreTarget(observedHash);
}
document.querySelectorAll('[data-g3-matrix]').forEach(bindG3Matrix);
