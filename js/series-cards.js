/* series-cards.js — JS-инжектор серийных карточек (AUDIT_10_OF_10 → NAV-11.1)
 *
 * Использование в HTML:
 *   <nav data-series-cards="nagornaya" aria-label="Все части серии"></nav>
 *
 * Источник данных: /data/series.json
 */
(function () {
  'use strict';
  var hosts = document.querySelectorAll('[data-series-cards]');
  if (!hosts.length) return;
  fetch('/data/series.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data) return;
    hosts.forEach(function (host) {
      var seriesId = host.dataset.seriesCards;
      var series = data[seriesId];
      if (!series) return;
      var currentPath = location.pathname.replace(/\/+$/, '/');
      host.innerHTML = series.parts.map(function (p) {
        var url = '/' + seriesId + '/' + p.slug + '/';
        var current = currentPath === url;
        var badge = current ? 'Вы здесь'
                  : p.status === 'draft'   ? 'В разработке'
                  : p.status === 'planned' ? 'Скоро'
                  : '';
        var inner = '' +
          '<span class="series-card__num">Часть ' + p.n + '</span>' +
          '<h3 class="series-card__title">' + p.title + '</h3>' +
          '<span class="series-card__time">' + p.readingTime + ' мин</span>' +
          (badge ? '<span class="series-card__badge">' + badge + '</span>' : '');
        return current
          ? '<div class="series-card is-current" aria-current="page">' + inner + '</div>'
          : '<a class="series-card" href="' + url + '">' + inner + '</a>';
      }).join('');
    });
  }).catch(function () {});
})();
