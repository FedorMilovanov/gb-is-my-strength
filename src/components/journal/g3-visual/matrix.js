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
  function restoreTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const row = target?.closest('.gm-row');
    if (!row || !root.contains(row) || !row.hidden) return;
    query.value = ''; year.value = ''; update();
    target.focus({preventScroll:true}); target.scrollIntoView({block:'center'});
  }
  const article = root.closest('[data-journal-source-navigation]');
  article?.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link || link.origin !== location.origin || link.pathname !== location.pathname ||
        link.search !== location.search || !link.hash || link.hash !== location.hash) return;
    restoreTarget();
  });
  window.addEventListener('hashchange', restoreTarget);
  restoreTarget();
}
document.querySelectorAll('[data-g3-matrix]').forEach(bindG3Matrix);
