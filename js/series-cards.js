/*!
 * GB Series Renderer v3 (2026-06-10)
 * Renders series content from /data/series.json into 4 modes:
 *   [data-series-cards="<key>"]  → card-grid
 *   [data-series-strip="<key>"]  → compact strip
 *   [data-series-nav="<key>"]    → classic sidebar nav
 *   [data-series-rail="<key>"]   → GBS series-world rail + mobile hosts
 *
 * Backward compatible, ES5, fail-silent. No new JS files.
 */
!function () {
  "use strict";

  function esc(s) {
    return String(null == s ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function attr(s) { return esc(s).replace(/`/g, "&#96;"); }
  function hosts(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function roman(n) {
    var map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]], out = "", i;
    n = parseInt(n, 10) || 0;
    for (i = 0; i < map.length; i++) while (n >= map[i][0]) { out += map[i][1]; n -= map[i][0]; }
    return out || "I";
  }
  function pluralParts(n) {
    n = Number(n) || 0;
    if (n % 10 === 1 && n % 100 !== 11) return "часть";
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "части";
    return "частей";
  }
  function detectCurrentSlug(parts, baseUrl) {
    var path = decodeURIComponent(location.pathname).replace(/\/+$/, "/"), i, u;
    for (i = 0; i < parts.length; i++) {
      u = (baseUrl || "/") + parts[i].slug + "/";
      if (path === u || path === u.replace(/^\/+/, "/")) return parts[i].slug;
    }
    return null;
  }
  function urlFor(baseUrl, slug) { return (baseUrl || "/") + slug + "/"; }
  function statusBadge(s) { return s === "draft" ? "В разработке" : s === "planned" ? "Скоро" : ""; }
  function publishedParts(info) { return (info.parts || []).filter(function (p) { return p.status !== "planned" && p.status !== "draft"; }); }
  function currentIndex(parts, slug) { for (var i = 0; i < parts.length; i++) if (parts[i].slug === slug) return i; return -1; }
  function cover(p) { return p && p.cover ? attr(p.cover) : ""; }
  function partNum(p, i) { return p.roman || roman(p.n || (i + 1)); }

  function renderCards(host, key, data) {
    var info = data[key];
    if (!info) return;
    var base = info.baseUrl || ("/" + key + "/");
    var currentSlug = detectCurrentSlug(info.parts, base);
    host.innerHTML = info.parts.map(function (p) {
      var u = urlFor(base, p.slug);
      var here = currentSlug === p.slug;
      var st = statusBadge(p.status);
      var badge = here ? "Вы здесь" : st;
      var body =
        '<span class="series-card__num">' + (p.n ? "Часть " + esc(p.n) : "") + '</span>' +
        '<h3 class="series-card__title">' + esc(p.title) + '</h3>' +
        '<span class="series-card__time">' + esc(p.readingTime || "") + (p.readingTime ? " мин" : "") + '</span>' +
        (badge ? '<span class="series-card__badge">' + esc(badge) + '</span>' : "");
      return here
        ? '<div class="series-card is-current" aria-current="page">' + body + '</div>'
        : '<a class="series-card" href="' + attr(u) + '">' + body + '</a>';
    }).join("");
  }

  function renderStrip(host, key, data) {
    var info = data[key];
    if (!info) return;
    var base = info.baseUrl || ("/" + key + "/");
    var currentSlug = detectCurrentSlug(info.parts, base);
    var currentIdx = currentIndex(info.parts, currentSlug);
    var prev = currentIdx > 0 ? info.parts[currentIdx - 1] : null;
    var next = currentIdx >= 0 && currentIdx < info.parts.length - 1 ? info.parts[currentIdx + 1] : null;
    var dots = info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug);
      var cls = "gb-strip__dot" + (i === currentIdx ? " is-current" : "");
      return i === currentIdx
        ? '<span class="' + cls + '" aria-current="page" title="' + esc(p.title) + '">' + esc(p.n || (i + 1)) + '</span>'
        : '<a class="' + cls + '" href="' + attr(u) + '" title="' + esc(p.title) + '">' + esc(p.n || (i + 1)) + '</a>';
    }).join("");
    var prevHtml = prev
      ? '<a class="gb-strip__nav gb-strip__nav--prev" href="' + attr(urlFor(base, prev.slug)) + '" rel="prev"><span class="gb-strip__nav-label">← Предыдущая</span><span class="gb-strip__nav-title">' + esc(prev.title) + '</span></a>'
      : '<span class="gb-strip__nav gb-strip__nav--prev is-disabled" aria-hidden="true"></span>';
    var nextHtml = next
      ? '<a class="gb-strip__nav gb-strip__nav--next" href="' + attr(urlFor(base, next.slug)) + '" rel="next"><span class="gb-strip__nav-label">Следующая →</span><span class="gb-strip__nav-title">' + esc(next.title) + '</span></a>'
      : '<span class="gb-strip__nav gb-strip__nav--next is-disabled" aria-hidden="true"></span>';
    var dropdownItems = info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug), here = i === currentIdx, num = p.n || (i + 1);
      var meta = p.readingTime ? ' · ' + esc(p.readingTime) + ' мин' : '';
      var inner = '<span class="gb-strip-dd__num">' + esc(num) + '</span><span class="gb-strip-dd__body"><span class="gb-strip-dd__title">' + esc(p.title) + '</span><span class="gb-strip-dd__meta">' + meta + '</span></span>';
      return here ? '<li class="gb-strip-dd__item is-current"><span class="gb-strip-dd__link" aria-current="page">' + inner + '</span></li>' : '<li class="gb-strip-dd__item"><a class="gb-strip-dd__link" href="' + attr(u) + '">' + inner + '</a></li>';
    }).join('');
    host.classList.add("gb-strip");
    host.setAttribute("role", "navigation");
    host.setAttribute("aria-label", "Навигация по серии " + info.title);
    host.innerHTML = prevHtml + '<div class="gb-strip__center"><button type="button" class="gb-strip__toggle" aria-expanded="false" aria-label="Показать все части серии"><div class="gb-strip__series">' + esc(info.title) + ' <svg class="gb-strip__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></div></button><div class="gb-strip__dots" aria-label="Части серии">' + dots + '</div><div class="gb-strip__dropdown" hidden><ol class="gb-strip-dd__list">' + dropdownItems + '</ol></div></div>' + nextHtml;
    var toggleBtn = host.querySelector('.gb-strip__toggle'), dd = host.querySelector('.gb-strip__dropdown');
    if (toggleBtn && dd) toggleBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = dd.hidden;
      dd.hidden = !open;
      toggleBtn.setAttribute('aria-expanded', String(open));
      if (open) setTimeout(function () { document.addEventListener('click', function closeHandler(e) {
        if (!host.contains(e.target)) { dd.hidden = true; toggleBtn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', closeHandler); }
      }); }, 0);
    });
  }

  function renderNav(host, key, data) {
    var info = data[key];
    if (!info) return;
    var base = info.baseUrl || ("/" + key + "/"), currentSlug = detectCurrentSlug(info.parts, base);
    var items = info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug), here = p.slug === currentSlug, num = p.n || (i + 1);
      var meta = p.readingTime ? '<span class="gb-snav__meta">' + esc(p.readingTime) + " мин</span>" : "";
      var inner = '<span class="gb-snav__num">' + esc(num) + '</span><span class="gb-snav__body"><span class="gb-snav__title">' + esc(p.title) + '</span>' + meta + '</span>';
      return here ? '<li class="gb-snav__item is-current"><span class="gb-snav__link" aria-current="page">' + inner + '</span></li>' : '<li class="gb-snav__item"><a class="gb-snav__link" href="' + attr(u) + '">' + inner + '</a></li>';
    }).join("");
    host.classList.add("gb-snav");
    host.setAttribute("role", "navigation");
    host.setAttribute("aria-label", "Серия «" + info.title + "»");
    host.innerHTML = '<div class="gb-snav__head"><span class="gb-snav__kicker">Серия</span><h3 class="gb-snav__title-main">' + esc(info.title) + '</h3><span class="gb-snav__count">' + info.parts.length + ' ' + pluralParts(info.parts.length) + '</span></div><ol class="gb-snav__list">' + items + '</ol>';
  }

  function partItem(info, base, currentSlug, p, i, compact) {
    var here = p.slug === currentSlug, u = urlFor(base, p.slug), st = statusBadge(p.status), img = cover(p), num = partNum(p, i);
    var thumb = img ? '<span class="gbs-part__thumb"><img src="' + img + '" alt="" loading="lazy" decoding="async" width="92" height="68"></span>' : '<span class="gbs-part__thumb gbs-noimg"><span>' + esc(num) + '</span></span>';
    var inner = thumb + '<span class="gbs-part__body"><span class="gbs-part__kicker">' + esc(num) + (p.readingTime ? ' · ' + esc(p.readingTime) + ' мин' : '') + '</span><span class="gbs-part__title">' + esc(p.title) + '</span>' + (p.sub ? '<span class="gbs-part__sub">' + esc(p.sub) + '</span>' : '') + (st ? '<span class="gbs-part__status">' + esc(st) + '</span>' : '') + '</span><span class="gbs-part__done" aria-hidden="true">✓</span>';
    var cls = 'gbs-part' + (here ? ' gbs-current' : '') + (compact ? ' gbs-part--compact' : '') + (p.status === 'planned' || p.status === 'draft' ? ' gbs-disabled' : '');
    if (here) return '<li><span class="' + cls + '" aria-current="page" data-gbs-part-slug="' + attr(p.slug) + '">' + inner + '</span></li>';
    if (p.status === 'planned' || p.status === 'draft') return '<li><span class="' + cls + '" aria-disabled="true" data-gbs-part-slug="' + attr(p.slug) + '">' + inner + '</span></li>';
    return '<li><a class="' + cls + '" href="' + attr(u) + '" data-gbs-part-slug="' + attr(p.slug) + '">' + inner + '</a></li>';
  }

  function renderRail(host, key, data) {
    var info = data[key];
    if (!info || !info.parts || !info.parts.length) return;
    var base = info.baseUrl || ("/" + key + "/"), currentSlug = detectCurrentSlug(info.parts, base), idx = currentIndex(info.parts, currentSlug), cur = idx >= 0 ? info.parts[idx] : info.parts[0];
    var totalMin = info.parts.reduce(function (sum, p) { return sum + (Number(p.readingTime) || 0); }, 0), partsCount = info.parts.length;
    document.body.setAttribute('data-gbs-series', key);
    document.body.style.setProperty('--gbs-accent', info.accent || '#7a2e2e');
    document.body.style.setProperty('--gbs-accent-2', info.accent2 || '#b85c3e');
    if (info.accentDark) document.body.style.setProperty('--gbs-accent-dark', info.accentDark);
    if (info.accentDark2) document.body.style.setProperty('--gbs-accent-dark-2', info.accentDark2);
    if (cur && cur.roman) document.body.style.setProperty('--gbs-roman', '"' + String(cur.roman).replace(/"/g, '') + '"');

    var partList = info.parts.map(function (p, i) { return partItem(info, base, currentSlug, p, i, false); }).join('');
    host.classList.add('gbs-rail');
    host.setAttribute('role', 'navigation');
    host.setAttribute('aria-label', 'Мир серии «' + info.title + '»');
    host.innerHTML =
      '<div class="gbs-rail__inner">' +
        '<div class="gbs-rail__head">' +
          (info.categoryUrl ? '<a class="gbs-rail__kicker" href="' + attr(info.categoryUrl) + '">' + esc(info.category || 'Серия') + '</a>' : '<span class="gbs-rail__kicker">' + esc(info.category || 'Серия') + '</span>') +
          '<h2 class="gbs-rail__title">' + esc(info.title) + '</h2>' +
          '<div class="gbs-rail__meta">' + partsCount + ' ' + pluralParts(partsCount) + (totalMin ? ' · ~' + totalMin + ' мин' : '') + '</div>' +
          '<div class="gbs-ring" aria-label="Прогресс серии"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18"></circle><circle class="gbs-ring__bar" cx="22" cy="22" r="18"></circle></svg><span class="gbs-ring__txt">0%</span></div>' +
        '</div>' +
        '<ol class="gbs-parts">' + partList + '</ol>' +
        '<section class="gbs-rail-current" aria-label="Текущая часть">' +
          '<div class="gbs-rail-current__cover"' + (cover(cur) ? ' style="--gbs-cover:url(' + cover(cur) + ')"' : '') + '></div>' +
          '<div class="gbs-rail-current__label">Сейчас читаете</div>' +
          '<div class="gbs-rail-current__title">' + esc(cur.title || '') + '</div>' +
          '<div class="gbs-part-progress"><span></span></div>' +
          '<nav class="gbs-toc" aria-label="Оглавление части"><div class="gbs-toc__empty">Оглавление собирается…</div></nav>' +
        '</section>' +
        '<a class="gbs-rail__back" href="' + attr(info.categoryUrl || '/') + '">← Назад на сайт</a>' +
      '</div>';
  }

  function renderMobileHead(host, key, data) {
    var info = data[key]; if (!info || !info.parts) return;
    var base = info.baseUrl || ("/" + key + "/"), currentSlug = detectCurrentSlug(info.parts, base), idx = currentIndex(info.parts, currentSlug), cur = idx >= 0 ? info.parts[idx] : info.parts[0];
    host.classList.add('gbs-mhead');
    host.innerHTML = '<button class="gbs-mhead__btn" type="button" data-gbs-open-sheet aria-label="Открыть мир серии"><span class="gbs-mhead__cover"' + (cover(cur) ? ' style="--gbs-cover:url(' + cover(cur) + ')"' : '') + '></span><span><span class="gbs-mhead__series">' + esc(info.title) + '</span><span class="gbs-mhead__part">' + esc(partNum(cur, idx)) + ' · ' + esc(cur.title || '') + '</span></span></button><div class="gbs-mhead__progress"><span></span></div>';
  }

  function renderBbar(host, key, data) {
    var info = data[key]; if (!info || !info.parts) return;
    var base = info.baseUrl || ("/" + key + "/"), currentSlug = detectCurrentSlug(info.parts, base), idx = currentIndex(info.parts, currentSlug);
    host.classList.add('gbs-bbar');
    host.setAttribute('aria-label', 'Навигация серии');
    host.innerHTML = '<button class="gbs-bbar__main" type="button" data-gbs-open-sheet><span class="gbs-bbar__ring">0%</span><span><span class="gbs-bbar__top">Серия</span><span class="gbs-bbar__sec">Оглавление части</span></span></button><div class="gbs-bbar__dots">' + info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug), cls = 'gbs-bbar__dot' + (i === idx ? ' gbs-current' : '');
      if (i === idx) return '<span class="' + cls + '" aria-current="page">' + esc(p.n || i + 1) + '</span>';
      if (p.status === 'planned' || p.status === 'draft') return '<span class="' + cls + ' gbs-disabled">' + esc(p.n || i + 1) + '</span>';
      return '<a class="' + cls + '" href="' + attr(u) + '">' + esc(p.n || i + 1) + '</a>';
    }).join('') + '</div>';
  }

  function renderSheet(host, key, data) {
    var info = data[key]; if (!info || !info.parts) return;
    var base = info.baseUrl || ("/" + key + "/"), currentSlug = detectCurrentSlug(info.parts, base);
    host.classList.add('gbs-sheet');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '<div class="gbs-sheet__backdrop" data-gbs-close-sheet></div><div class="gbs-sheet__panel" role="dialog" aria-modal="true" aria-label="Мир серии"><div class="gbs-sheet__grab"></div><div class="gbs-sheet__head"><strong>' + esc(info.title) + '</strong><button type="button" class="gbs-sheet__close" data-gbs-close-sheet aria-label="Закрыть">×</button></div><div class="gbs-sheet__tabs"><button type="button" class="gbs-sheet__tab gbs-active" data-gbs-tab="parts">Части серии</button><button type="button" class="gbs-sheet__tab" data-gbs-tab="toc">Оглавление части</button></div><div class="gbs-sheet__body"><div class="gbs-sheet__pane gbs-active" data-gbs-pane="parts"><ol class="gbs-parts gbs-parts--sheet">' + info.parts.map(function (p, i) { return partItem(info, base, currentSlug, p, i, true); }).join('') + '</ol></div><div class="gbs-sheet__pane" data-gbs-pane="toc"><nav class="gbs-toc gbs-toc--sheet" aria-label="Оглавление части"><div class="gbs-toc__empty">Оглавление собирается…</div></nav></div></div></div>';
  }

  function renderNext(host, key, data) {
    var info = data[key]; if (!info || !info.parts) return;
    var base = info.baseUrl || ("/" + key + "/"), currentSlug = detectCurrentSlug(info.parts, base), idx = currentIndex(info.parts, currentSlug);
    var prev = idx > 0 ? info.parts[idx - 1] : null, next = idx >= 0 && idx < info.parts.length - 1 ? info.parts[idx + 1] : null;
    function card(p, rel, label) {
      if (!p || p.status === 'planned' || p.status === 'draft') return '';
      return '<a class="gbs-next-card gbs-next-card--' + rel + '" href="' + attr(urlFor(base, p.slug)) + '" rel="' + rel + '"><span class="gbs-next-card__cover"' + (cover(p) ? ' style="--gbs-cover:url(' + cover(p) + ')"' : '') + '></span><span class="gbs-next-card__body"><span class="gbs-next-card__label">' + label + '</span><strong>' + esc(p.title) + '</strong>' + (p.sub ? '<small>' + esc(p.sub) + '</small>' : '') + '</span></a>';
    }
    host.classList.add('gbs-next');
    host.innerHTML = card(prev, 'prev', '← Предыдущая часть') + card(next, 'next', 'Следующая часть →');
  }

  function renderTimeline(host, key, data) {
    var info = data[key]; if (!info || !info.parts) return;
    host.classList.add('gbs-timeline');
    host.innerHTML = '<div class="gbs-timeline__head"><span>Карта серии</span><strong>' + esc(info.timelineLabel || info.title) + '</strong></div><ol class="gbs-timeline__track">' + info.parts.map(function (p, i) {
      return '<li class="gbs-timeline__item"><span class="gbs-timeline__dot"></span><span class="gbs-timeline__era">' + esc(p.era || partNum(p, i)) + '</span><span class="gbs-timeline__title">' + esc(p.title) + '</span></li>';
    }).join('') + '</ol><span class="gbs-timeline__line"><span></span></span>';
  }

  var cardHosts = hosts("[data-series-cards]"), stripHosts = hosts("[data-series-strip]"), navHosts = hosts("[data-series-nav]"), railHosts = hosts("[data-series-rail]"), mheadHosts = hosts("[data-series-mobile-head]"), sheetHosts = hosts("[data-series-sheet]"), bbarHosts = hosts("[data-series-bbar]"), nextHosts = hosts("[data-series-next]"), timelineHosts = hosts("[data-series-timeline]");
  if (!cardHosts.length && !stripHosts.length && !navHosts.length && !railHosts.length && !mheadHosts.length && !sheetHosts.length && !bbarHosts.length && !nextHosts.length && !timelineHosts.length) return;

  fetch("/data/series.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data) return;
    cardHosts.forEach(function (h) { renderCards(h, h.dataset.seriesCards, data); });
    stripHosts.forEach(function (h) { renderStrip(h, h.dataset.seriesStrip, data); });
    navHosts.forEach(function (h) { renderNav(h, h.dataset.seriesNav, data); });
    railHosts.forEach(function (h) { renderRail(h, h.dataset.seriesRail, data); });
    mheadHosts.forEach(function (h) { renderMobileHead(h, h.dataset.seriesMobileHead, data); });
    sheetHosts.forEach(function (h) { renderSheet(h, h.dataset.seriesSheet, data); });
    bbarHosts.forEach(function (h) { renderBbar(h, h.dataset.seriesBbar, data); });
    nextHosts.forEach(function (h) { renderNext(h, h.dataset.seriesNext, data); });
    timelineHosts.forEach(function (h) { renderTimeline(h, h.dataset.seriesTimeline, data); });
    try { document.dispatchEvent(new CustomEvent('gbs:series-ready', { detail: { data: data } })); } catch (_) { var ev = document.createEvent('Event'); ev.initEvent('gbs:series-ready', false, false); document.dispatchEvent(ev); }
  }).catch(function () { /* fail-silent */ });
}();
