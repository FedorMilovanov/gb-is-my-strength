/*!
 * GB Series Renderer v2 (2026-06-08)
 * Renders series content from /data/series.json into 3 modes:
 *   [data-series-cards="<key>"]  → big card-grid (already used on /articles/, /biografii/ etc.)
 *   [data-series-strip="<key>"]  → compact horizontal strip (top of article)
 *   [data-series-nav="<key>"]    → sidebar/floating navigator (Nagornaya-style premium)
 *
 * Self-detects current part by URL slug match; passes through draft/planned status.
 * No new files; this replaces the previous series-cards.js but stays backward compatible.
 */
!function () {
  "use strict";
  function esc(s) {
    return String(null == s ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function detectCurrentSlug(parts, baseUrl) {
    var path = decodeURIComponent(location.pathname).replace(/\/+$/, "/");
    for (var i = 0; i < parts.length; i++) {
      var u = (baseUrl || "/") + parts[i].slug + "/";
      if (path === u || path === u.replace(/^\/+/, "/")) return parts[i].slug;
    }
    return null;
  }
  function urlFor(baseUrl, slug) {
    return (baseUrl || "/") + slug + "/";
  }
  function statusBadge(s) {
    return s === "draft" ? "В разработке" : s === "planned" ? "Скоро" : "";
  }

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
        : '<a class="series-card" href="' + esc(u).replace(/`/g, "&#96;") + '">' + body + '</a>';
    }).join("");
  }

  function renderStrip(host, key, data) {
    var info = data[key];
    if (!info) return;
    var base = info.baseUrl || ("/" + key + "/");
    var currentSlug = detectCurrentSlug(info.parts, base);
    var currentIdx = -1;
    info.parts.forEach(function (p, i) { if (p.slug === currentSlug) currentIdx = i; });
    var prev = currentIdx > 0 ? info.parts[currentIdx - 1] : null;
    var next = currentIdx >= 0 && currentIdx < info.parts.length - 1 ? info.parts[currentIdx + 1] : null;
    var dots = info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug);
      var cls = "gb-strip__dot" + (i === currentIdx ? " is-current" : "");
      return i === currentIdx
        ? '<span class="' + cls + '" aria-current="page" title="' + esc(p.title) + '">' + esc(p.n || (i + 1)) + '</span>'
        : '<a class="' + cls + '" href="' + esc(u) + '" title="' + esc(p.title) + '">' + esc(p.n || (i + 1)) + '</a>';
    }).join("");
    var prevHtml = prev
      ? '<a class="gb-strip__nav gb-strip__nav--prev" href="' + esc(urlFor(base, prev.slug)) + '" rel="prev"><span class="gb-strip__nav-label">← Предыдущая</span><span class="gb-strip__nav-title">' + esc(prev.title) + '</span></a>'
      : '<span class="gb-strip__nav gb-strip__nav--prev is-disabled" aria-hidden="true"></span>';
    var nextHtml = next
      ? '<a class="gb-strip__nav gb-strip__nav--next" href="' + esc(urlFor(base, next.slug)) + '" rel="next"><span class="gb-strip__nav-label">Следующая →</span><span class="gb-strip__nav-title">' + esc(next.title) + '</span></a>'
      : '<span class="gb-strip__nav gb-strip__nav--next is-disabled" aria-hidden="true"></span>';
    host.classList.add("gb-strip");
    host.setAttribute("role", "navigation");
    host.setAttribute("aria-label", "Навигация по серии " + info.title);
    // Build dropdown content
    var dropdownItems = info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug);
      var here = i === currentIdx;
      var num = p.n || (i + 1);
      var meta = p.readingTime ? ' · ' + esc(p.readingTime) + ' мин' : '';
      var inner = '<span class="gb-strip-dd__num">' + esc(num) + '</span><span class="gb-strip-dd__body"><span class="gb-strip-dd__title">' + esc(p.title) + '</span><span class="gb-strip-dd__meta">' + meta + '</span></span>';
      return here
        ? '<li class="gb-strip-dd__item is-current"><span class="gb-strip-dd__link" aria-current="page">' + inner + '</span></li>'
        : '<li class="gb-strip-dd__item"><a class="gb-strip-dd__link" href="' + esc(u) + '">' + inner + '</a></li>';
    }).join('');
    var dropdown = '<div class="gb-strip__dropdown" hidden><ol class="gb-strip-dd__list">' + dropdownItems + '</ol></div>';

    host.innerHTML =
      prevHtml +
      '<div class="gb-strip__center"><button type="button" class="gb-strip__toggle" aria-expanded="false" aria-label="Показать все части серии"><div class="gb-strip__series">' + esc(info.title) + ' <svg class="gb-strip__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></div><div class="gb-strip__dots">' + dots + '</div></button>' + dropdown + '</div>' +
      nextHtml;

    // Add click handler for dropdown toggle
    var toggleBtn = host.querySelector('.gb-strip__toggle');
    var dd = host.querySelector('.gb-strip__dropdown');
    if (toggleBtn && dd) {
      toggleBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = dd.hidden;
        dd.hidden = !open;
        toggleBtn.setAttribute('aria-expanded', String(open));
        if (open) {
          // Close on outside click
          var closeHandler = function (e) {
            if (!host.contains(e.target)) {
              dd.hidden = true;
              toggleBtn.setAttribute('aria-expanded', 'false');
              document.removeEventListener('click', closeHandler);
            }
          };
          setTimeout(function () { document.addEventListener('click', closeHandler); }, 0);
        }
      });
    }
  }

  function renderNav(host, key, data) {
    var info = data[key];
    if (!info) return;
    var base = info.baseUrl || ("/" + key + "/");
    var currentSlug = detectCurrentSlug(info.parts, base);
    var items = info.parts.map(function (p, i) {
      var u = urlFor(base, p.slug);
      var here = p.slug === currentSlug;
      var num = p.n || (i + 1);
      var meta = p.readingTime ? '<span class="gb-snav__meta">' + esc(p.readingTime) + " мин</span>" : "";
      var inner =
        '<span class="gb-snav__num">' + esc(num) + '</span>' +
        '<span class="gb-snav__body">' +
          '<span class="gb-snav__title">' + esc(p.title) + '</span>' +
          meta +
        '</span>';
      return here
        ? '<li class="gb-snav__item is-current"><span class="gb-snav__link" aria-current="page">' + inner + '</span></li>'
        : '<li class="gb-snav__item"><a class="gb-snav__link" href="' + esc(u) + '">' + inner + '</a></li>';
    }).join("");
    host.classList.add("gb-snav");
    host.setAttribute("role", "navigation");
    host.setAttribute("aria-label", "Серия «" + info.title + "»");
    host.innerHTML =
      '<div class="gb-snav__head">' +
        '<span class="gb-snav__kicker">Серия</span>' +
        '<h3 class="gb-snav__title-main">' + esc(info.title) + '</h3>' +
        '<span class="gb-snav__count">' + info.parts.length + ' ' + (info.parts.length === 1 ? "часть" : info.parts.length < 5 ? "части" : "частей") + '</span>' +
      '</div>' +
      '<ol class="gb-snav__list">' + items + '</ol>';
  }

  function hosts(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  var cardHosts = hosts("[data-series-cards]");
  var stripHosts = hosts("[data-series-strip]");
  var navHosts = hosts("[data-series-nav]");
  if (!cardHosts.length && !stripHosts.length && !navHosts.length) return;

  fetch("/data/series.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data) return;
    cardHosts.forEach(function (h) { renderCards(h, h.dataset.seriesCards, data); });
    stripHosts.forEach(function (h) { renderStrip(h, h.dataset.seriesStrip, data); });
    navHosts.forEach(function (h) { renderNav(h, h.dataset.seriesNav, data); });
  }).catch(function () { /* fail-silent */ });
}();
