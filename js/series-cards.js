/*!
 * GB Series Renderer v2 (2026-06-08)
 * Renders series content from /data/series.json:
 *   [data-series-cards="<key>"]  → big card-grid (catalog pages)
 * (strip/nav legacy modes removed 2026-06-12 — GBS is the series canon, AGENTS §9.11)
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

  function hosts(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  var cardHosts = hosts("[data-series-cards]");
  if (!cardHosts.length) return;

  fetch("/data/series.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data) return;
    cardHosts.forEach(function (h) { renderCards(h, h.dataset.seriesCards, data); });
  }).catch(function () { /* fail-silent */ });
}();
