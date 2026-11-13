const OWNER = 'native-v1';
const TABLE_SELECTOR = 'article table, main table, .manuscript-table, .compare-table';

function cleanText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function findHeadingLabel(node) {
  let cursor = node;
  while (cursor && cursor !== document.body) {
    let prev = cursor.previousElementSibling;
    while (prev) {
      if (/^H[2-6]$/u.test(prev.tagName)) {
        const clone = prev.cloneNode(true);
        clone.querySelectorAll('.heading-anchor, [aria-hidden="true"]').forEach((el) => el.remove());
        const text = cleanText(clone.textContent);
        if (text) return `Таблица: ${text}`;
      }
      prev = prev.previousElementSibling;
    }
    cursor = cursor.parentElement;
  }
  return 'Таблица данных';
}

function deriveTableLabel(table, scroller) {
  const caption = cleanText(table.querySelector('caption')?.textContent);
  const base = caption || findHeadingLabel(scroller);
  if (scroller !== table) {
    return `${base} (прокрутите стрелками влево и вправо)`;
  }
  return caption ? null : base;
}

function resolveScroller(table) {
  const parent = table.parentElement;
  if (parent && parent !== document.body && parent.tagName !== 'ARTICLE' && parent.tagName !== 'MAIN' && parent.tagName !== 'SECTION') {
    if (
      parent.classList.contains('table-scroll') ||
      parent.classList.contains('overflow-x-auto') ||
      parent.hasAttribute('data-table-scroll')
    ) {
      return parent;
    }
    const overflowX = window.getComputedStyle?.(parent)?.overflowX || '';
    if (overflowX === 'auto' || overflowX === 'scroll') {
      return parent;
    }
  }
  return table;
}

function isHorizontallyOverflowing(scroller) {
  const clientWidth = Number(scroller.clientWidth) || 0;
  const scrollWidth = Number(scroller.scrollWidth) || 0;
  return clientWidth > 0 && scrollWidth > clientWidth + 1;
}

function deactivateScroller(scroller) {
  delete scroller.dataset.gbTableScrollActive;
  if (scroller.dataset.gbTableScrollManagedTabindex === '1') {
    scroller.removeAttribute('tabindex');
    delete scroller.dataset.gbTableScrollManagedTabindex;
  }
  if (scroller.dataset.gbTableScrollManagedRole === '1') {
    scroller.removeAttribute('role');
    delete scroller.dataset.gbTableScrollManagedRole;
  }
  if (scroller.dataset.gbTableScrollManagedLabel === '1') {
    scroller.removeAttribute('aria-label');
    delete scroller.dataset.gbTableScrollManagedLabel;
  }
}

function activateScroller(scroller, table) {
  scroller.dataset.gbTableScrollActive = '1';
  if (!scroller.hasAttribute('tabindex')) {
    scroller.setAttribute('tabindex', '0');
    scroller.dataset.gbTableScrollManagedTabindex = '1';
  }
  // Never override native <table> semantics with role="region"; apply role="region" only to non-table scroll wrappers.
  if (scroller.tagName !== 'TABLE' && !scroller.hasAttribute('role')) {
    scroller.setAttribute('role', 'region');
    scroller.dataset.gbTableScrollManagedRole = '1';
  }
  if (!scroller.hasAttribute('aria-label') && !scroller.hasAttribute('aria-labelledby')) {
    const label = deriveTableLabel(table, scroller);
    if (label) {
      scroller.setAttribute('aria-label', label);
      scroller.dataset.gbTableScrollManagedLabel = '1';
    }
  }
}

function handleScrollerKeydown(event) {
  const scroller = event.currentTarget;
  if (!scroller || event.target !== scroller) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const maxScroll = Math.max(0, (Number(scroller.scrollWidth) || 0) - (Number(scroller.clientWidth) || 0));
  if (maxScroll <= 1) return;

  const step = Math.max(48, Math.round((Number(scroller.clientWidth) || 240) * 0.25));
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    event.stopPropagation();
    scroller.scrollLeft = Math.min(maxScroll, (Number(scroller.scrollLeft) || 0) + step);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    event.stopPropagation();
    scroller.scrollLeft = Math.max(0, (Number(scroller.scrollLeft) || 0) - step);
  } else if (event.key === 'Home') {
    event.preventDefault();
    event.stopPropagation();
    scroller.scrollLeft = 0;
  } else if (event.key === 'End') {
    event.preventDefault();
    event.stopPropagation();
    scroller.scrollLeft = maxScroll;
  }
}

export function installArticleReadingTables() {
  const tables = [...document.querySelectorAll(TABLE_SELECTOR)];
  if (!tables.length) return Object.freeze({ enabled: false, tables: 0, active: 0 });

  const pairs = [];
  const seenScrollers = new Set();
  for (const table of tables) {
    const scroller = resolveScroller(table);
    if (seenScrollers.has(scroller)) continue;
    seenScrollers.add(scroller);
    scroller.dataset.gbReadingTableOwner = OWNER;
    if (scroller.dataset.gbReadingTableBound !== OWNER) {
      scroller.dataset.gbReadingTableBound = OWNER;
      scroller.addEventListener('keydown', handleScrollerKeydown);
    }
    pairs.push({ table, scroller });
  }

  function sync() {
    let active = 0;
    for (const { table, scroller } of pairs) {
      if (isHorizontallyOverflowing(scroller)) {
        activateScroller(scroller, table);
        active += 1;
      } else {
        deactivateScroller(scroller);
      }
    }
    document.documentElement.dataset.gbReadingTablesActive = String(active);
    return active;
  }

  const initialActive = sync();

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => sync());
    for (const { table, scroller } of pairs) {
      observer.observe(scroller);
      if (scroller !== table) observer.observe(table);
    }
  }

  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('beforeprint', () => {
    for (const { scroller } of pairs) deactivateScroller(scroller);
  });
  window.addEventListener('afterprint', sync);

  document.documentElement.dataset.gbReadingTablesReady = '1';
  return Object.freeze({ enabled: true, tables: pairs.length, active: initialActive, sync });
}
