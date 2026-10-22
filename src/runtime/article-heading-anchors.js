const OWNER = 'native-v1';
const TOAST_ID = 'anchor-copy-toast';
const CLIPBOARD_TIMEOUT_MS = 1200;
const ANCHOR_LABEL = 'Скопировать ссылку на раздел';
// GBS-SECTION-HEADING-NAME-POLLUTION: обёртка вокруг собственного текста
// заголовка. Имя заголовка вычисляется из содержимого, поэтому подпись
// контрола, вложенного в заголовок, становилась хвостом каждого имени
// («Введение Скопировать ссылку на раздел») и outline переставал читаться.
const NAME_CLASS = 'heading-anchor__name';
const NAME_ID_PREFIX = 'gb-heading-name-';
const ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M13.5 6.5L7 13a3.536 3.536 0 0 1-5-5l7-7a2.121 2.121 0 0 1 3 3L5.5 10.5a.707.707 0 0 1-1-1L11 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let delegatedBound = false;
let toastTimer = 0;

function enabled() {
  return window.SITE_CONFIG?.features?.headingAnchors?.enabled !== false;
}

function ensureToast() {
  let toast = document.getElementById(TOAST_ID);
  if (toast) return toast;
  toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.className = 'gb-anchor-copy-toast';
  toast.dataset.gbHeadingAnchorOwner = OWNER;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.textContent = 'Ссылка на раздел скопирована';
  document.body.appendChild(toast);
  return toast;
}

function showToast(message = 'Ссылка на раздел скопирована') {
  const toast = ensureToast();
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.textContent = 'Ссылка на раздел скопирована';
  }, 2000);
}

function copyText(value) {
  if (navigator.clipboard?.writeText) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('clipboard write timed out'));
      }, CLIPBOARD_TIMEOUT_MS);
      Promise.resolve()
        .then(() => navigator.clipboard.writeText(value))
        .then(
          (result) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve(result);
          },
          (error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            reject(error);
          },
        );
    });
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0;pointer-events:none';
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    input.remove();
    copied ? resolve() : reject(new Error('copy failed'));
  });
}

function headingAnchorFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  const heading = anchor.closest('h2[id], h3[id], h4[id]');
  if (!(heading instanceof HTMLElement) || !heading.id) return null;
  return { anchor, heading };
}

function handleHeadingAnchorClick(event) {
  const owned = headingAnchorFromEvent(event);
  if (!owned) return;

  event.preventDefault();
  const { anchor, heading } = owned;
  const id = heading.id;
  const url = new URL(window.location.href);
  url.hash = id;

  copyText(url.toString()).then(() => {
    try { navigator.vibrate?.(30); } catch {}
    anchor.innerHTML = CHECK;
    anchor.classList.add('copied');
    showToast();
    window.setTimeout(() => {
      if (!anchor.isConnected) return;
      anchor.innerHTML = ICON;
      anchor.classList.remove('copied');
    }, 1800);
  }).catch(() => {
    history.replaceState(null, '', `#${id}`);
    showToast('Ссылка на раздел открыта');
  });
}

function ensureDelegatedOwner() {
  if (delegatedBound) return;
  delegatedBound = true;
  // Capture-phase delegation survives heading/anchor replacement and cannot be
  // disabled by bubble-phase stopPropagation in unrelated reader controls.
  document.addEventListener('click', handleHeadingAnchorClick, true);
}

// Даёт заголовку собственный текстовый элемент и направляет aria-labelledby на
// него, чтобы доступное имя заголовка состояло из его текста, а не из текста
// плюс подписи вложенного контрола.
//
// Почему именно так, а не иначе:
//  - Спрятать контрол от AT (aria-hidden/inert) нельзя: это работающая ссылка
//    «скопировать адрес раздела», и клеймо прямо запрещает такой ремонт.
//  - Вынести контрол в соседний элемент значило бы менять DOM-структуру вокруг
//    каждого заголовка: на `h2:hover .heading-anchor` и на hit-test браузерного
//    контракта (scripts/article-capability-browser-contract.mjs) держится
//    текущая геометрия, а обёртка вокруг заголовка ломала бы потоковую вёрстку.
//  - Контрол остаётся ПРЯМЫМ потомком заголовка, поэтому ни CSS, ни контракт,
//    ни делегированный capture-обработчик клика не замечают изменения.
//
// Обёртка — обычный inline-span без собственных стилей: во всём dist нет ни
// одного заголовка с блочным содержимым, поэтому вложенность остаётся валидной,
// а поток и отступы не меняются. textContent заголовка не меняется, значит
// построители оглавлений (js/enhancements.js, js/floating-cluster-controller.js)
// читают те же подписи, что и раньше.
function ensureHeadingNameElement(heading, anchor) {
  let nameEl = heading.querySelector(`:scope > .${NAME_CLASS}`);
  if (!nameEl) {
    nameEl = document.createElement('span');
    nameEl.className = NAME_CLASS;
    nameEl.id = uniqueHeadingNameId(heading.id);
    heading.insertBefore(nameEl, heading.firstChild);
  }

  // Переносим всё содержимое, кроме самого контрола. Сверка выполняется на
  // каждом запуске, а не только при создании: installArticleHeadingAnchors()
  // вызывают повторно, и текст, добавленный в заголовок другим рантаймом,
  // обязан попасть в именующий элемент, а не остаться рядом с ним.
  let moved = 0;
  for (const node of [...heading.childNodes]) {
    if (node === nameEl || node === anchor) continue;
    nameEl.appendChild(node);
    moved += 1;
  }

  // Пустой заголовок нельзя именовать пустой обёрткой: aria-labelledby без
  // содержимого дал бы заголовку пустое имя, что хуже прежнего загрязнения.
  if (!nameEl.textContent.trim()) {
    heading.removeAttribute('aria-labelledby');
    return { nameEl, labelled: false, moved };
  }

  heading.setAttribute('aria-labelledby', nameEl.id);
  return { nameEl, labelled: true, moved };
}

// Идентификатор обязан быть уникальным в документе: aria-labelledby,
// указывающий на чужой элемент, переименовал бы заголовок чужим текстом.
function uniqueHeadingNameId(headingId) {
  const base = `${NAME_ID_PREFIX}${headingId}`;
  if (!document.getElementById(base)) return base;
  let suffix = 2;
  while (document.getElementById(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function installArticleHeadingAnchors() {
  if (!enabled()) return Object.freeze({ enabled: false, headings: 0 });

  const headings = [...document.querySelectorAll('h2[id], h3[id], h4[id]')]
    .filter((heading) => !heading.closest('.summary-card, .author-card, [data-gb-no-heading-anchor]'));
  if (!headings.length) return Object.freeze({ enabled: true, headings: 0, anchors: 0 });

  ensureToast();
  ensureDelegatedOwner();
  let anchors = 0;
  let named = 0;
  let unnamedHeadings = 0;

  for (const heading of headings) {
    let anchor = heading.querySelector(':scope > .heading-anchor');
    if (!anchor) {
      anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${heading.id}`;
      heading.appendChild(anchor);
    }

    anchor.dataset.gbHeadingAnchorOwner = OWNER;
    anchor.removeAttribute('data-gb-heading-anchor-bound');
    anchor.setAttribute('aria-label', ANCHOR_LABEL);
    anchor.innerHTML = ICON;
    anchors += 1;

    const { labelled } = ensureHeadingNameElement(heading, anchor);
    if (labelled) named += 1;
    else unnamedHeadings += 1;
  }

  document.documentElement.dataset.gbHeadingAnchorsReady = anchors === headings.length ? '1' : 'invalid';
  // Отдельный сигнал для замеров: сколько заголовков получили собственное имя.
  // На семантику gbHeadingAnchorsReady не влияет — контракт браузера читает
  // именно его и по-прежнему получает '1'.
  document.documentElement.dataset.gbHeadingNamesReady = named === anchors ? '1' : `${named}/${anchors}`;
  return Object.freeze({ enabled: true, headings: headings.length, anchors, named, unnamedHeadings });
}
