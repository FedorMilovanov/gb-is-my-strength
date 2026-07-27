/*
 * relationship-panel.js
 *
 * Transitional premium projection for article relationships.
 * The canonical long-term owner is a build-time relation compiler; this file
 * deliberately keeps series navigation out of the relationship surface.
 */
(function () {
  'use strict';

  var GRAPH_URL = '/data/links-graph.json';
  var MAX_VISIBLE = 4;
  var SERIES_GROUPS = new Set([
    'gill',
    'nagornaya',
    'hard-texts',
    'stand',
    'russian-baptism',
    'pastor-series'
  ]);

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    var url = String(value || '').trim();
    if (!url || /^javascript:/i.test(url)) return '#';
    if (/^(?:https?:)?\/\//i.test(url)) return url;
    return url.charAt(0) === '/' ? url : '/' + url;
  }

  function normalizePath(value) {
    var path = String(value || '/').split(/[?#]/)[0];
    try { path = decodeURIComponent(path); } catch (_) {}
    path = path.replace(/\/{2,}/g, '/');
    if (path.length > 1 && !path.endsWith('/')) path += '/';
    return path || '/';
  }

  function removeLegacyBlocks(root) {
    (root || document).querySelectorAll('.gbx-backlinks').forEach(function (node) {
      node.remove();
    });
  }

  function installLegacyGuard(article) {
    removeLegacyBlocks(article);
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (!(node instanceof Element)) return;
          if (node.matches('.gbx-backlinks')) node.remove();
          else removeLegacyBlocks(node);
        });
      });
    });
    observer.observe(article, { childList: true, subtree: true });
    window.addEventListener('pagehide', function () { observer.disconnect(); }, { once: true });
  }

  function findCurrentNode(nodes) {
    var path = normalizePath(location.pathname);
    var exact = nodes.find(function (node) {
      return normalizePath(node.url) === path;
    });
    if (exact) return exact;

    var slugMatches = nodes.filter(function (node) {
      return node.id && path.indexOf('/' + node.id + '/') !== -1;
    });
    return slugMatches.length === 1 ? slugMatches[0] : null;
  }

  function relatedNodes(graph, current) {
    var nodeMap = new Map();
    graph.nodes.forEach(function (node) { nodeMap.set(node.id, node); });

    var related = new Map();
    graph.edges.forEach(function (edge) {
      if (!Array.isArray(edge) || edge.length < 2) return;
      var source = edge[0];
      var target = edge[1];
      var neighborId = null;
      if (source === current.id) neighborId = target;
      else if (target === current.id) neighborId = source;
      if (!neighborId || neighborId === current.id) return;

      var neighbor = nodeMap.get(neighborId);
      if (!neighbor || !neighbor.url) return;
      if (!related.has(neighborId)) related.set(neighborId, neighbor);
    });

    var values = Array.from(related.values());
    var isSeries = SERIES_GROUPS.has(current.group);
    if (isSeries) {
      values = values.filter(function (node) { return node.group !== current.group; });
    }

    values.sort(function (a, b) {
      var aLanding = a.group === 'landing' ? 1 : 0;
      var bLanding = b.group === 'landing' ? 1 : 0;
      if (aLanding !== bLanding) return aLanding - bLanding;
      var aDesc = a.desc ? 0 : 1;
      var bDesc = b.desc ? 0 : 1;
      if (aDesc !== bDesc) return aDesc - bDesc;
      return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
    });

    return values.slice(0, MAX_VISIBLE);
  }

  function relationLabel(node) {
    var labels = {
      landing: 'Раздел библиотеки',
      karty: 'Карта и маршрут',
      gill: 'Исследование о Джоне Гилле',
      nagornaya: 'Нагорная проповедь',
      'hard-texts': 'Трудные тексты',
      stand: 'История русского баптизма',
      'russian-baptism': 'История русского баптизма',
      standalone: 'Связанное исследование'
    };
    return labels[node.group] || 'Связанное исследование';
  }

  function metaLine(node) {
    var parts = [];
    if (node.group === 'landing') parts.push('Каталог');
    else if (node.group === 'karty') parts.push('Интерактивная карта');
    else parts.push('Материал');
    if (Number(node.readingTime) > 0) parts.push(node.readingTime + ' мин.');
    return parts.join(' · ');
  }

  function buildPanel(current, items) {
    if (!items.length) return null;

    var isSeries = SERIES_GROUPS.has(current.group);
    var title = isSeries ? 'Контекст и связи' : 'Продолжить исследование';
    var intro = isSeries
      ? 'Внешние материалы, которые помогают увидеть эту часть в более широком контексте.'
      : 'Материалы, которые естественно продолжают тему и расширяют аргумент статьи.';

    var nav = document.createElement('nav');
    nav.className = 'gb-relations-panel';
    nav.dataset.relationGroup = current.group || 'standalone';
    nav.setAttribute('aria-labelledby', 'gbRelationsTitle');

    var rows = items.map(function (node, index) {
      var description = String(node.desc || '').trim();
      return '' +
        '<a class="gb-relations-panel__item' + (index === 0 ? ' gb-relations-panel__item--featured' : '') + '" href="' + escapeHtml(safeUrl(node.url)) + '">' +
          '<span class="gb-relations-panel__copy">' +
            '<span class="gb-relations-panel__kind">' + escapeHtml(relationLabel(node)) + '</span>' +
            '<strong class="gb-relations-panel__title">' + escapeHtml(node.title) + '</strong>' +
            (description ? '<span class="gb-relations-panel__desc">' + escapeHtml(description) + '</span>' : '') +
            '<span class="gb-relations-panel__meta">' + escapeHtml(metaLine(node)) + '</span>' +
          '</span>' +
          '<span class="gb-relations-panel__arrow" aria-hidden="true">→</span>' +
        '</a>';
    }).join('');

    nav.innerHTML = '' +
      '<div class="gb-relations-panel__head">' +
        '<div>' +
          '<span class="gb-relations-panel__eyebrow">Навигация по исследованию</span>' +
          '<h2 id="gbRelationsTitle">' + escapeHtml(title) + '</h2>' +
          '<p>' + escapeHtml(intro) + '</p>' +
        '</div>' +
        '<span class="gb-relations-panel__count" aria-label="Материалов: ' + items.length + '">' + items.length + '</span>' +
      '</div>' +
      '<div class="gb-relations-panel__list">' + rows + '</div>' +
      '<a class="gb-relations-panel__atlas" href="/map/?focus=' + encodeURIComponent(current.id) + '">' +
        '<span class="gb-relations-panel__atlas-mark" aria-hidden="true">✦</span>' +
        '<span><strong>Открыть окружение в Атласе</strong><small>Приблизить узел, увидеть темы и соседние материалы</small></span>' +
        '<span class="gb-relations-panel__atlas-arrow" aria-hidden="true">→</span>' +
      '</a>';

    nav.addEventListener('click', function (event) {
      var link = event.target.closest('a');
      if (!link) return;
      try {
        if (window.ym) {
          window.ym(108353327, 'reachGoal', link.classList.contains('gb-relations-panel__atlas') ? 'relation_atlas_open' : 'relation_open', {
            source_id: current.id,
            href: link.getAttribute('href')
          });
        }
      } catch (_) {}
    });

    return nav;
  }

  function insertPanel(article, panel) {
    var existing = article.querySelector('.gb-relations-panel');
    if (existing) existing.remove();

    var seriesNav = article.querySelector('.astro-series-nav');
    if (seriesNav) {
      seriesNav.insertAdjacentElement('afterend', panel);
      return;
    }

    var insertBefore = article.querySelector('.astro-author-card, .author-card, .related-articles');
    if (insertBefore && insertBefore.parentNode) {
      insertBefore.parentNode.insertBefore(panel, insertBefore);
    } else {
      article.appendChild(panel);
    }
  }

  function init() {
    if (location.pathname === '/map/' || document.documentElement.dataset.relationshipPanelInit === '1') return;
    var article = document.querySelector('article');
    if (!article) return;

    document.documentElement.dataset.relationshipPanelInit = '1';
    installLegacyGuard(article);

    fetch(GRAPH_URL, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('graph HTTP ' + response.status);
        return response.json();
      })
      .then(function (graph) {
        if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return;
        var current = findCurrentNode(graph.nodes);
        if (!current) return;
        var items = relatedNodes(graph, current);
        var panel = buildPanel(current, items);
        if (!panel) return;
        insertPanel(article, panel);
        document.documentElement.dataset.relationshipPanelReady = '1';
      })
      .catch(function (error) {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          console.warn('[relations] panel unavailable', error);
        }
      });
  }

  ready(init);
})();
