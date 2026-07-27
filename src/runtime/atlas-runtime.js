/*
 * atlas-runtime.js
 *
 * Native runtime for /map/. The server-rendered list remains usable without
 * this file. Runtime data is compiled from the transitional relationship graph
 * plus the canonical published series registry.
 */
(function () {
  'use strict';

  var GRAPH_URL = '/data/links-graph.json';
  var SERIES_URL = '/data/series.json';
  var WIDTH = 1600;
  var HEIGHT = 1000;
  var MIN_WIDTH = 350;
  var MAX_WIDTH = 2400;
  var INITIAL_VIEW = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  var ALL_KINDS = ['series', 'cluster', 'structure', 'bridge'];

  var GROUP_META = {
    gill: { label: 'Джон Гилл', color: '#c3925a' },
    nagornaya: { label: 'Нагорная проповедь', color: '#d8ae4e' },
    'hard-texts': { label: 'Трудные тексты', color: '#6f9fd3' },
    stand: { label: 'Баптисты России', color: '#4e86bd' },
    'russian-baptism': { label: 'Баптисты России', color: '#4e86bd' },
    karty: { label: 'Библейские карты', color: '#5eb9bd' },
    biografii: { label: 'Биографии служителей', color: '#d68158' },
    'pastor-series': { label: 'Практическое служение', color: '#ce6486' },
    standalone: { label: 'Отдельные исследования', color: '#78aa72' },
    landing: { label: 'Разделы библиотеки', color: '#9a8ac5' }
  };

  var SERIES_GROUP = {
    nagornaya: 'nagornaya',
    'dzhon-gill': 'gill',
    'hard-texts': 'hard-texts',
    'pastor-series': 'pastor-series',
    'russian-baptism': 'stand'
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function normalizeUrl(value) {
    var path = String(value || '/').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
    return path.length > 1 && !path.endsWith('/') ? path + '/' : path;
  }

  function atlasGroupFor(node) {
    if (node.group !== 'landing') return node.group || 'standalone';
    if (node.id === 'biografii') return 'biografii';
    if (node.id === 'hard-texts') return 'hard-texts';
    if (node.id === 'pastor-series') return 'pastor-series';
    if (node.id === 'karty') return 'karty';
    return 'landing';
  }

  function edgeKey(source, target) {
    return [source, target].sort().join('::');
  }

  function prepareGraph(rawGraph, rawSeries) {
    var nodes = (Array.isArray(rawGraph.nodes) ? rawGraph.nodes : []).map(function (node) {
      return Object.assign({}, node, {
        atlasGroup: atlasGroupFor(node),
        isHub: node.group === 'landing' || ['biografii', 'hard-texts', 'pastor-series', 'karty'].includes(node.id)
      });
    });

    var nodeByUrl = new Map(nodes.map(function (node) { return [normalizeUrl(node.url), node]; }));
    var seriesPaths = [];

    Object.entries(rawSeries || {}).forEach(function (entry) {
      var seriesId = entry[0];
      var series = entry[1] || {};
      var atlasGroup = SERIES_GROUP[seriesId] || 'standalone';
      var ids = [];

      (Array.isArray(series.parts) ? series.parts : []).forEach(function (part) {
        if (part.status && part.status !== 'published') return;
        var url = normalizeUrl(String(series.baseUrl || '/') + String(part.slug || '') + '/');
        var node = nodeByUrl.get(url);
        if (!node) {
          node = {
            id: 'series-' + seriesId + '-' + part.slug,
            title: part.title,
            url: url,
            group: atlasGroup,
            atlasGroup: atlasGroup,
            readingTime: part.readingTime,
            desc: 'Материал серии «' + series.title + '».',
            tags: [series.title, 'серия'],
            isHub: false
          };
          nodes.push(node);
          nodeByUrl.set(url, node);
        } else {
          node.atlasGroup = atlasGroup;
          if (!node.readingTime && part.readingTime) node.readingTime = part.readingTime;
        }
        ids.push(node.id);
      });

      if (ids.length > 1) seriesPaths.push(ids);
    });

    var nodeMap = new Map(nodes.map(function (node) { return [node.id, node]; }));
    var edgeMap = new Map();

    (Array.isArray(rawGraph.edges) ? rawGraph.edges : []).forEach(function (edge) {
      if (!Array.isArray(edge) || edge.length < 2) return;
      var source = String(edge[0]);
      var target = String(edge[1]);
      if (!source || !target || source === target || !nodeMap.has(source) || !nodeMap.has(target)) return;
      var a = nodeMap.get(source);
      var b = nodeMap.get(target);
      var kind = a.atlasGroup === b.atlasGroup ? 'cluster' : a.isHub || b.isHub ? 'structure' : 'bridge';
      edgeMap.set(edgeKey(source, target), { source: source, target: target, kind: kind });
    });

    seriesPaths.forEach(function (ids) {
      for (var index = 0; index < ids.length - 1; index += 1) {
        var source = ids[index];
        var target = ids[index + 1];
        edgeMap.set(edgeKey(source, target), { source: source, target: target, kind: 'series' });
      }
    });

    var preferred = ['gill', 'nagornaya', 'biografii', 'stand', 'hard-texts', 'karty', 'pastor-series', 'standalone', 'landing'];
    var ids = Array.from(new Set(nodes.map(function (node) { return node.atlasGroup || 'standalone'; })));
    ids.sort(function (a, b) {
      var ai = preferred.indexOf(a);
      var bi = preferred.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b, 'ru');
    });

    var groups = ids.map(function (id) {
      return Object.assign(
        { id: id, count: nodes.filter(function (node) { return node.atlasGroup === id; }).length },
        GROUP_META[id] || { label: id, color: '#9a8ac5' }
      );
    });

    return { nodes: nodes, edges: Array.from(edgeMap.values()), groups: groups };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function init(rawGraph, rawSeries) {
    var app = document.getElementById('atlasApp');
    var svg = document.getElementById('atlasCanvas');
    if (!app || !svg) return;

    var data = prepareGraph(rawGraph, rawSeries);
    var world = document.getElementById('atlasWorld');
    var edgeLayer = document.getElementById('atlasEdges');
    var nodeLayer = document.getElementById('atlasNodes');
    var labelLayer = document.getElementById('atlasClusterLabels');
    var detail = document.getElementById('atlasDetail');
    var detailEmpty = document.getElementById('atlasDetailEmpty');
    var detailContent = document.getElementById('atlasDetailContent');
    var graphView = document.getElementById('atlasGraphView');
    var listView = document.getElementById('atlasListView');
    var searchInput = document.getElementById('atlasSearchInput');
    var searchResults = document.getElementById('atlasSearchResults');
    var zoomCopy = document.getElementById('atlasZoomCopy');
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ns = 'http://www.w3.org/2000/svg';
    var nodeById = new Map(data.nodes.map(function (node) { return [node.id, node]; }));
    var groupById = new Map(data.groups.map(function (group) { return [group.id, group]; }));
    var nodePositions = new Map();
    var edgeElements = [];
    var nodeElements = new Map();
    var enabledKinds = new Set(ALL_KINDS);
    var pointers = new Map();
    var gesture = null;
    var view = Object.assign({}, INITIAL_VIEW);
    var activeGroup = 'all';
    var activeFocus = null;
    var activeView = 'graph';

    function createSvg(tag, attrs) {
      var el = document.createElementNS(ns, tag);
      Object.entries(attrs || {}).forEach(function (entry) { el.setAttribute(entry[0], String(entry[1])); });
      return el;
    }

    function truncate(value, length) {
      var text = String(value || '').trim();
      var max = length || 31;
      return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
    }

    function layoutGraph() {
      var centers = [
        [800, 185], [1175, 300], [1320, 620], [1060, 820], [620, 825],
        [275, 650], [315, 305], [800, 505], [1450, 355], [150, 355]
      ];
      nodePositions = new Map();
      labelLayer.innerHTML = '';

      data.groups.forEach(function (group, groupIndex) {
        var center = centers[groupIndex];
        if (!center) {
          var outerAngle = Math.PI * 2 * groupIndex / data.groups.length - Math.PI / 2;
          center = [800 + Math.cos(outerAngle) * 560, 500 + Math.sin(outerAngle) * 340];
        }

        var groupNodes = data.nodes.filter(function (node) { return node.atlasGroup === group.id; });
        var hub = groupNodes.find(function (node) { return node.isHub; }) || groupNodes[0];
        var leaves = groupNodes.filter(function (node) { return node !== hub; });
        if (hub) nodePositions.set(hub.id, { x: center[0], y: center[1], r: 18, hub: true });

        leaves.forEach(function (node, index) {
          var ring = Math.floor(index / 8);
          var ringIndex = index % 8;
          var ringCount = Math.min(8, leaves.length - ring * 8);
          var angle = Math.PI * 2 * ringIndex / Math.max(1, ringCount) - Math.PI / 2 + groupIndex * .31;
          var radiusX = 78 + ring * 58;
          var radiusY = 62 + ring * 46;
          nodePositions.set(node.id, {
            x: center[0] + Math.cos(angle) * radiusX,
            y: center[1] + Math.sin(angle) * radiusY,
            r: 8 + Math.min(4, Number(node.readingTime || 0) / 16),
            hub: false
          });
        });

        var label = createSvg('text', {
          x: center[0],
          y: center[1] - (leaves.length ? 112 + Math.floor(leaves.length / 9) * 20 : 48),
          class: 'atlas-cluster-label',
          'text-anchor': 'middle',
          'data-group': group.id
        });
        label.textContent = group.label;
        label.style.setProperty('--cluster-color', group.color);
        labelLayer.appendChild(label);
      });
    }

    function renderGraph() {
      edgeLayer.innerHTML = '';
      nodeLayer.innerHTML = '';
      edgeElements = [];
      nodeElements = new Map();

      data.edges.forEach(function (edge) {
        var a = nodePositions.get(edge.source);
        var b = nodePositions.get(edge.target);
        if (!a || !b) return;
        var line = createSvg('line', {
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          class: 'atlas-edge atlas-edge--' + edge.kind,
          'data-source': edge.source,
          'data-target': edge.target,
          'data-kind': edge.kind
        });
        edgeLayer.appendChild(line);
        edgeElements.push({ edge: edge, el: line });
      });

      data.nodes.forEach(function (node) {
        var pos = nodePositions.get(node.id);
        if (!pos) return;
        var group = groupById.get(node.atlasGroup) || { color: '#9a8ac5', label: node.atlasGroup };
        var g = createSvg('g', {
          class: 'atlas-node' + (pos.hub ? ' atlas-node--hub' : ''),
          transform: 'translate(' + pos.x + ' ' + pos.y + ')',
          tabindex: '0',
          role: 'button',
          'aria-label': node.title + '. ' + group.label,
          'data-node-id': node.id,
          'data-group': node.atlasGroup
        });
        g.style.setProperty('--node-color', group.color);

        var halo = createSvg('circle', { class: 'atlas-node__halo', r: pos.r + 12 });
        var core = createSvg('circle', { class: 'atlas-node__core', r: pos.r });
        var glint = createSvg('circle', {
          class: 'atlas-node__glint',
          cx: -pos.r * .28,
          cy: -pos.r * .32,
          r: Math.max(1.5, pos.r * .18)
        });
        var label = createSvg('text', {
          class: 'atlas-node__label',
          x: 0,
          y: pos.r + 18,
          'text-anchor': 'middle'
        });
        label.textContent = truncate(node.title, pos.hub ? 38 : 29);
        g.append(halo, core, glint, label);
        g.addEventListener('click', function (event) {
          event.stopPropagation();
          focusNode(node.id, true);
        });
        g.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focusNode(node.id, true);
          }
        });
        nodeLayer.appendChild(g);
        nodeElements.set(node.id, g);
      });

      applyFilters();
    }

    function relatedTo(id) {
      var neighbors = [];
      data.edges.forEach(function (edge) {
        if (edge.source === id) neighbors.push({ id: edge.target, kind: edge.kind });
        else if (edge.target === id) neighbors.push({ id: edge.source, kind: edge.kind });
      });
      return neighbors;
    }

    function kindLabel(kind) {
      if (kind === 'series') return 'Порядок серии';
      if (kind === 'cluster') return 'Внутри темы';
      if (kind === 'structure') return 'Раздел и материал';
      return 'Мост между темами';
    }

    function renderDetail(id) {
      var node = nodeById.get(id);
      if (!node) return;
      var group = groupById.get(node.atlasGroup) || { label: node.atlasGroup, color: '#9a8ac5' };
      var neighbors = relatedTo(id).filter(function (item) { return nodeById.has(item.id); }).slice(0, 7);
      detail.style.setProperty('--detail-color', group.color);
      detailEmpty.hidden = true;
      detailContent.hidden = false;
      detailContent.innerHTML =
        '<span class="atlas-detail__kind">' + escapeHtml(group.label) + '</span>' +
        '<h2>' + escapeHtml(node.title) + '</h2>' +
        '<div class="atlas-detail__meta"><span>' +
          (node.readingTime ? escapeHtml(node.readingTime) + ' мин. чтения' : 'Материал библиотеки') +
          '</span><span>' + neighbors.length + ' ' +
          (neighbors.length === 1 ? 'связь' : neighbors.length < 5 ? 'связи' : 'связей') +
          '</span></div>' +
        (node.desc ? '<p class="atlas-detail__desc">' + escapeHtml(node.desc) + '</p>' : '') +
        '<a class="atlas-detail__primary" href="' + escapeHtml(node.url) + '">Читать материал <span aria-hidden="true">→</span></a>' +
        (neighbors.length ?
          '<section class="atlas-detail__relations" aria-labelledby="atlasNeighborTitle">' +
            '<h3 id="atlasNeighborTitle">Связано с материалом</h3><div>' +
            neighbors.map(function (item) {
              var neighbor = nodeById.get(item.id);
              return '<button type="button" data-detail-focus="' + escapeHtml(neighbor.id) + '">' +
                '<span>' + escapeHtml(kindLabel(item.kind)) + '</span>' +
                '<strong>' + escapeHtml(neighbor.title) + '</strong></button>';
            }).join('') +
            '</div></section>' : '');
      detail.classList.add('is-open');
      detailContent.querySelectorAll('[data-detail-focus]').forEach(function (button) {
        button.addEventListener('click', function () { focusNode(button.dataset.detailFocus, true); });
      });
    }

    function setViewBox(next, animate) {
      var w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next.w));
      var h = w * HEIGHT / WIDTH;
      view = {
        x: Math.max(-350, Math.min(WIDTH + 350 - w, next.x)),
        y: Math.max(-250, Math.min(HEIGHT + 250 - h, next.y)),
        w: w,
        h: h
      };
      if (animate && !prefersReduced) svg.classList.add('is-camera-moving');
      svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
      updateSemanticZoom();
      if (animate && !prefersReduced) {
        window.setTimeout(function () { svg.classList.remove('is-camera-moving'); }, 360);
      }
    }

    function updateSemanticZoom() {
      var scale = WIDTH / view.w;
      var level = scale < 1.35 ? 'overview' : scale < 2.45 ? 'cluster' : 'detail';
      app.dataset.zoomLevel = level;
      zoomCopy.textContent = level === 'overview'
        ? 'Обзор библиотеки'
        : level === 'cluster'
          ? 'Тематический кластер'
          : 'Подробное окружение';
    }

    function zoomAt(factor, clientX, clientY, animate) {
      var rect = svg.getBoundingClientRect();
      var px = clientX == null ? rect.left + rect.width / 2 : clientX;
      var py = clientY == null ? rect.top + rect.height / 2 : clientY;
      var ux = view.x + (px - rect.left) / rect.width * view.w;
      var uy = view.y + (py - rect.top) / rect.height * view.h;
      var nextW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, view.w / factor));
      var nextH = nextW * HEIGHT / WIDTH;
      setViewBox({
        x: ux - (px - rect.left) / rect.width * nextW,
        y: uy - (py - rect.top) / rect.height * nextH,
        w: nextW,
        h: nextH
      }, animate);
    }

    function updateUrl(changes) {
      var url = new URL(location.href);
      Object.entries(changes).forEach(function (entry) {
        if (entry[1] == null || entry[1] === '') url.searchParams.delete(entry[0]);
        else url.searchParams.set(entry[0], entry[1]);
      });
      history.replaceState({}, '', url);
    }

    function focusNode(id, moveCamera) {
      var node = nodeById.get(id);
      var pos = nodePositions.get(id);
      if (!node || !pos) return;
      activeFocus = id;
      var neighbors = new Set(relatedTo(id).map(function (item) { return item.id; }));

      nodeElements.forEach(function (el, nodeId) {
        el.classList.toggle('is-focus', nodeId === id);
        el.classList.toggle('is-neighbor', neighbors.has(nodeId));
        el.classList.toggle('is-dim', nodeId !== id && !neighbors.has(nodeId));
      });
      edgeElements.forEach(function (entry) {
        var connected = entry.edge.source === id || entry.edge.target === id;
        entry.el.classList.toggle('is-focus', connected);
        entry.el.classList.toggle('is-dim', !connected);
      });

      renderDetail(id);
      if (moveCamera) {
        var targetW = Math.min(view.w, 690);
        var targetH = targetW * HEIGHT / WIDTH;
        setViewBox({ x: pos.x - targetW / 2, y: pos.y - targetH / 2, w: targetW, h: targetH }, true);
      }
      updateUrl({ focus: id });
    }

    function clearFocus(updateHistory) {
      activeFocus = null;
      nodeElements.forEach(function (el) { el.classList.remove('is-focus', 'is-neighbor', 'is-dim'); });
      edgeElements.forEach(function (entry) { entry.el.classList.remove('is-focus', 'is-dim'); });
      detail.classList.remove('is-open');
      detailEmpty.hidden = false;
      detailContent.hidden = true;
      if (updateHistory !== false) updateUrl({ focus: null });
      applyFilters();
    }

    function visibleNode(node) {
      return Boolean(node) && (activeGroup === 'all' || node.atlasGroup === activeGroup);
    }

    function applyFilters() {
      nodeElements.forEach(function (el, id) {
        el.classList.toggle('is-filtered-out', !visibleNode(nodeById.get(id)));
      });
      edgeElements.forEach(function (entry) {
        var hidden = !enabledKinds.has(entry.edge.kind)
          || !visibleNode(nodeById.get(entry.edge.source))
          || !visibleNode(nodeById.get(entry.edge.target));
        entry.el.classList.toggle('is-filtered-out', hidden);
      });
      document.querySelectorAll('[data-list-group]').forEach(function (section) {
        section.hidden = activeGroup !== 'all' && section.dataset.listGroup !== activeGroup;
      });
      document.querySelectorAll('[data-list-node]').forEach(function (row) {
        row.hidden = !visibleNode(nodeById.get(row.dataset.listNode));
      });
    }

    function setGroup(group) {
      activeGroup = group || 'all';
      document.querySelectorAll('[data-atlas-group]').forEach(function (button) {
        var active = button.dataset.atlasGroup === activeGroup;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      clearFocus(false);
      applyFilters();
      updateUrl({ group: activeGroup === 'all' ? null : activeGroup });
    }

    function setView(mode, updateHistory) {
      activeView = mode === 'list' ? 'list' : 'graph';
      app.dataset.view = activeView;
      graphView.hidden = activeView !== 'graph';
      listView.hidden = activeView !== 'list';
      document.querySelectorAll('[data-atlas-view]').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.atlasView === activeView ? 'true' : 'false');
      });
      if (updateHistory !== false) updateUrl({ view: activeView === 'graph' ? null : activeView });
    }

    function runSearch(query) {
      var value = String(query || '').trim().toLowerCase();
      document.querySelectorAll('[data-list-node]').forEach(function (row) {
        var matches = !value || String(row.dataset.searchText || '').includes(value);
        row.hidden = !matches || !visibleNode(nodeById.get(row.dataset.listNode));
      });
      if (!value) {
        searchResults.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
        return [];
      }

      var results = data.nodes.filter(function (node) {
        var text = (node.title + ' ' + (node.tags || []).join(' ') + ' ' + (node.desc || '') + ' ' + node.atlasGroup).toLowerCase();
        return text.includes(value) && visibleNode(node);
      }).slice(0, 8);

      searchResults.innerHTML = results.map(function (node) {
        var group = groupById.get(node.atlasGroup) || {};
        return '<button type="button" role="option" data-search-focus="' + escapeHtml(node.id) + '">' +
          '<strong>' + escapeHtml(node.title) + '</strong>' +
          '<span>' + escapeHtml(group.label || node.atlasGroup) + '</span></button>';
      }).join('');
      searchResults.hidden = !results.length;
      searchInput.setAttribute('aria-expanded', results.length ? 'true' : 'false');
      searchResults.querySelectorAll('[data-search-focus]').forEach(function (button) {
        button.addEventListener('click', function () {
          setView('graph');
          focusNode(button.dataset.searchFocus, true);
          searchResults.hidden = true;
          searchInput.setAttribute('aria-expanded', 'false');
        });
      });
      return results;
    }

    function closeFilters() {
      document.getElementById('atlasSidebar').classList.remove('is-open');
      document.getElementById('atlasFilterTrigger').setAttribute('aria-expanded', 'false');
    }

    layoutGraph();
    renderGraph();
    setViewBox(INITIAL_VIEW);
    app.dataset.runtimeReady = '1';
    app.dataset.runtimeNodes = String(data.nodes.length);
    app.dataset.runtimeEdges = String(data.edges.length);

    svg.addEventListener('wheel', function (event) {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 1.16 : .86, event.clientX, event.clientY);
    }, { passive: false });

    svg.addEventListener('pointerdown', function (event) {
      if (event.target.closest && event.target.closest('.atlas-node')) return;
      svg.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        gesture = { type: 'pan', startX: event.clientX, startY: event.clientY, view: Object.assign({}, view) };
      } else if (pointers.size === 2) {
        var points = Array.from(pointers.values());
        gesture = {
          type: 'pinch',
          distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
          view: Object.assign({}, view)
        };
      }
      svg.classList.add('is-dragging');
    });

    svg.addEventListener('pointermove', function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      var rect = svg.getBoundingClientRect();
      if (pointers.size === 1 && gesture && gesture.type === 'pan') {
        var dx = (event.clientX - gesture.startX) * gesture.view.w / rect.width;
        var dy = (event.clientY - gesture.startY) * gesture.view.h / rect.height;
        setViewBox({ x: gesture.view.x - dx, y: gesture.view.y - dy, w: gesture.view.w });
      } else if (pointers.size === 2 && gesture && gesture.type === 'pinch') {
        var points = Array.from(pointers.values());
        var distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (gesture.distance > 0) {
          var factor = distance / gesture.distance;
          var nextW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, gesture.view.w / factor));
          var nextH = nextW * HEIGHT / WIDTH;
          setViewBox({
            x: gesture.view.x + (gesture.view.w - nextW) / 2,
            y: gesture.view.y + (gesture.view.h - nextH) / 2,
            w: nextW,
            h: nextH
          });
        }
      }
    });

    function endPointer(event) {
      pointers.delete(event.pointerId);
      if (!pointers.size) {
        gesture = null;
        svg.classList.remove('is-dragging');
      } else if (pointers.size === 1) {
        var point = Array.from(pointers.values())[0];
        gesture = { type: 'pan', startX: point.x, startY: point.y, view: Object.assign({}, view) };
      }
    }

    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('click', function (event) {
      if (event.target === svg || event.target === world) clearFocus();
    });

    document.getElementById('atlasZoomIn').addEventListener('click', function () { zoomAt(1.35, null, null, true); });
    document.getElementById('atlasZoomOut').addEventListener('click', function () { zoomAt(.74, null, null, true); });
    document.getElementById('atlasCenter').addEventListener('click', function () {
      clearFocus();
      setViewBox(INITIAL_VIEW, true);
    });
    document.getElementById('atlasDetailClose').addEventListener('click', function () { clearFocus(); });

    document.querySelectorAll('[data-atlas-view]').forEach(function (button) {
      button.addEventListener('click', function () { setView(button.dataset.atlasView); });
    });
    document.querySelectorAll('[data-atlas-group]').forEach(function (button) {
      button.addEventListener('click', function () { setGroup(button.dataset.atlasGroup); });
    });
    document.querySelectorAll('.atlas-relation-filter input').forEach(function (input) {
      input.addEventListener('change', function () {
        enabledKinds = new Set(Array.from(document.querySelectorAll('.atlas-relation-filter input:checked')).map(function (item) {
          return item.value;
        }));
        applyFilters();
      });
    });
    document.querySelectorAll('[data-list-focus]').forEach(function (button) {
      button.addEventListener('click', function () {
        setView('graph');
        focusNode(button.dataset.listFocus, true);
      });
    });

    searchInput.addEventListener('input', function () { runSearch(searchInput.value); });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        searchResults.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
      }
      if (event.key === 'Enter') {
        var first = runSearch(searchInput.value)[0];
        if (first) {
          event.preventDefault();
          setView('graph');
          focusNode(first.id, true);
          searchResults.hidden = true;
        }
      }
    });

    document.getElementById('atlasFilterTrigger').addEventListener('click', function () {
      var sidebar = document.getElementById('atlasSidebar');
      var open = !sidebar.classList.contains('is-open');
      sidebar.classList.toggle('is-open', open);
      document.getElementById('atlasFilterTrigger').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.getElementById('atlasFilterClose').addEventListener('click', closeFilters);
    document.getElementById('atlasReset').addEventListener('click', function () {
      searchInput.value = '';
      runSearch('');
      enabledKinds = new Set(ALL_KINDS);
      document.querySelectorAll('.atlas-relation-filter input').forEach(function (input) { input.checked = true; });
      setGroup('all');
      setView('graph');
      setViewBox(INITIAL_VIEW, true);
      history.replaceState({}, '', location.pathname);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        clearFocus();
        closeFilters();
        searchResults.hidden = true;
      }
      if ((event.key === '+' || event.key === '=') && document.activeElement !== searchInput) {
        zoomAt(1.25, null, null, true);
      }
      if (event.key === '-' && document.activeElement !== searchInput) zoomAt(.8, null, null, true);
      if (event.key === '0' && document.activeElement !== searchInput) setViewBox(INITIAL_VIEW, true);
    });

    var initial = new URL(location.href).searchParams;
    if (initial.get('group') && groupById.has(initial.get('group'))) setGroup(initial.get('group'));
    if (initial.get('view') === 'list') setView('list', false);
    if (initial.get('focus') && nodeById.has(initial.get('focus'))) focusNode(initial.get('focus'), true);
  }

  ready(function () {
    Promise.all([
      fetch(GRAPH_URL, { credentials: 'same-origin' }),
      fetch(SERIES_URL, { credentials: 'same-origin' })
    ])
      .then(function (responses) {
        if (!responses[0].ok) throw new Error('graph HTTP ' + responses[0].status);
        if (!responses[1].ok) throw new Error('series HTTP ' + responses[1].status);
        return Promise.all([responses[0].json(), responses[1].json()]);
      })
      .then(function (payload) { init(payload[0], payload[1]); })
      .catch(function (error) {
        var app = document.getElementById('atlasApp');
        if (app) app.dataset.runtimeError = '1';
        var copy = document.getElementById('atlasZoomCopy');
        if (copy) copy.textContent = 'Карта временно недоступна — используйте список';
        console.warn('[atlas] runtime unavailable', error);
      });
  });
})();
