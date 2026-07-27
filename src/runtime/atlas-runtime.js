/* Canonical compiled-relation runtime for /map/. */
(function () {
  'use strict';

  var DATA_URL = '/data/relations.compiled.json';
  var DESKTOP_WORLD = Object.freeze({ id: 'desktop', w: 1600, h: 1000, min: 350, max: 2200, padX: 320, padY: 230 });
  var COMPACT_WORLD = Object.freeze({ id: 'compact', w: 620, h: 1180, min: 220, max: 850, padX: 100, padY: 100 });
  var ALL_KINDS = Object.freeze(['series', 'cluster', 'structure', 'bridge']);
  var NODE_ID = /^[a-z0-9][a-z0-9_-]{1,119}$/;
  var GROUP_ID = /^[a-z0-9][a-z0-9_-]{1,119}$/;
  var INTERNAL_URL = /^\/(?!\/)[^?#]*$/;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function invariant(condition, message) {
    if (!condition) throw new Error('invalid compiled relation payload: ' + message);
  }

  function pluralRelations(count) {
    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'связь';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'связи';
    return 'связей';
  }

  function semanticKey(edge) {
    if (edge.direction === 'directed') return edge.semanticKind + ':' + edge.source + '>' + edge.target;
    return edge.semanticKind + ':' + [edge.source, edge.target].sort().join('~');
  }

  function assertCompiled(raw) {
    invariant(raw && typeof raw === 'object' && !Array.isArray(raw), 'root object');
    invariant(Number(raw.schemaVersion) === 1, 'schema version');
    invariant(typeof raw.engineVersion === 'string' && raw.engineVersion.length > 0, 'engine version');
    invariant(Array.isArray(raw.nodes) && Array.isArray(raw.edges) && Array.isArray(raw.groups), 'primary arrays');
    invariant(raw.stats && typeof raw.stats === 'object', 'stats object');

    var nodeIds = new Set();
    var nodeUrls = new Set();
    var nodes = raw.nodes.map(function (node, index) {
      invariant(node && typeof node === 'object' && !Array.isArray(node), 'node ' + index);
      var id = text(node.id);
      var title = text(node.title);
      var url = text(node.url);
      var atlasGroup = text(node.atlasGroup);
      invariant(NODE_ID.test(id) && !nodeIds.has(id), 'unique node id ' + id);
      invariant(title.length > 0 && INTERNAL_URL.test(url) && url !== '/' && !nodeUrls.has(url), 'node identity ' + id);
      invariant(GROUP_ID.test(atlasGroup), 'node group ' + id);
      invariant(node.readingTime == null || (Number.isInteger(Number(node.readingTime)) && Number(node.readingTime) > 0), 'node reading time ' + id);
      nodeIds.add(id);
      nodeUrls.add(url);
      return Object.freeze({
        id: id,
        title: title,
        url: url,
        atlasGroup: atlasGroup,
        group: text(node.group) || atlasGroup,
        readingTime: node.readingTime == null ? null : Number(node.readingTime),
        desc: text(node.desc),
        tags: Array.isArray(node.tags) ? node.tags.map(text).filter(Boolean) : [],
        isHub: Boolean(node.isHub),
        seriesId: text(node.seriesId),
      });
    });

    var groupIds = new Set();
    var groups = raw.groups.map(function (group, index) {
      invariant(group && typeof group === 'object' && !Array.isArray(group), 'group ' + index);
      var id = text(group.id);
      var label = text(group.label);
      var color = text(group.color);
      var count = Number(group.count);
      invariant(GROUP_ID.test(id) && !groupIds.has(id), 'unique group id ' + id);
      invariant(label.length > 0 && /^#[0-9a-f]{6}$/i.test(color), 'group presentation ' + id);
      invariant(Number.isInteger(count) && count >= 1, 'group count ' + id);
      groupIds.add(id);
      return Object.freeze({ id: id, label: label, color: color, count: count });
    });

    nodes.forEach(function (node) {
      invariant(groupIds.has(node.atlasGroup), 'node references missing group ' + node.id);
    });
    groups.forEach(function (group) {
      var actual = nodes.filter(function (node) { return node.atlasGroup === group.id; }).length;
      invariant(actual === group.count, 'group count mismatch ' + group.id);
    });

    var edgeIds = new Set();
    var edgeSemantics = new Set();
    var edges = raw.edges.map(function (edge, index) {
      invariant(edge && typeof edge === 'object' && !Array.isArray(edge), 'edge ' + index);
      var id = text(edge.id);
      var source = text(edge.source);
      var target = text(edge.target);
      var atlasKind = text(edge.atlasKind);
      var semanticKind = text(edge.kind);
      var direction = text(edge.direction);
      var weight = Number(edge.weight);
      invariant(id.length > 0 && !edgeIds.has(id), 'unique edge id ' + id);
      invariant(nodeIds.has(source) && nodeIds.has(target) && source !== target, 'edge endpoints ' + id);
      invariant(ALL_KINDS.includes(atlasKind), 'edge atlas kind ' + id);
      invariant(semanticKind.length > 0 && (direction === 'directed' || direction === 'undirected'), 'edge semantics ' + id);
      invariant(Number.isInteger(weight) && weight >= 1 && weight <= 100, 'edge weight ' + id);
      var normalized = Object.freeze({
        id: id,
        source: source,
        target: target,
        kind: atlasKind,
        semanticKind: semanticKind,
        label: text(edge.label),
        inverseLabel: text(edge.inverseLabel),
        rationale: text(edge.rationale),
        direction: direction,
        weight: weight,
      });
      var semantic = semanticKey(normalized);
      invariant(!edgeSemantics.has(semantic), 'duplicate edge semantic ' + id);
      edgeIds.add(id);
      edgeSemantics.add(semantic);
      return normalized;
    });

    invariant(Number(raw.stats.nodes) === nodes.length, 'node stats mismatch');
    invariant(Number(raw.stats.edges) === edges.length, 'edge stats mismatch');
    invariant(Number(raw.stats.groups) === groups.length, 'group stats mismatch');

    return Object.freeze({
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      groups: Object.freeze(groups),
      stats: Object.freeze(Object.assign({}, raw.stats)),
      engineVersion: raw.engineVersion,
    });
  }

  function createElement(tag, className, content) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (content != null) element.textContent = String(content);
    return element;
  }

  function init(raw) {
    var app = document.getElementById('atlasApp');
    var svg = document.getElementById('atlasCanvas');
    if (!app || !svg) return;

    var data = assertCompiled(raw);
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
    var sidebar = document.getElementById('atlasSidebar');
    var filterTrigger = document.getElementById('atlasFilterTrigger');
    var resetButton = document.getElementById('atlasReset');
    var compactMedia = window.matchMedia('(max-width: 680px)');
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
    var profile = compactMedia.matches ? COMPACT_WORLD : DESKTOP_WORLD;
    var view = initialView();
    var activeGroup = 'all';
    var activeFocus = null;
    var activeView = 'graph';
    var searchQuery = '';
    var searchCursor = -1;
    var suppressClick = false;

    function initialView() {
      return { x: 0, y: 0, w: profile.w, h: profile.h };
    }

    function createSvg(tag, attrs) {
      var element = document.createElementNS(ns, tag);
      Object.entries(attrs || {}).forEach(function (entry) { element.setAttribute(entry[0], String(entry[1])); });
      return element;
    }

    function truncate(value, length) {
      var valueText = text(value);
      return valueText.length > length ? valueText.slice(0, length - 1).trimEnd() + '…' : valueText;
    }

    function orderedGroups() {
      return data.groups.slice().sort(function (a, b) {
        return b.count - a.count || a.label.localeCompare(b.label, 'ru') || a.id.localeCompare(b.id);
      });
    }

    function groupCenters() {
      var ordered = orderedGroups();
      var centers = new Map();
      if (!ordered.length) return centers;

      if (profile.id === 'compact') {
        var columns = 2;
        var rows = Math.ceil(ordered.length / columns);
        var xInset = 154;
        var yInset = 144;
        var xGap = profile.w - xInset * 2;
        var yGap = rows > 1 ? (profile.h - yInset * 2) / (rows - 1) : 0;
        ordered.forEach(function (group, index) {
          var row = Math.floor(index / columns);
          var column = index % columns;
          centers.set(group.id, {
            x: xInset + column * xGap,
            y: yInset + row * yGap,
          });
        });
        return centers;
      }

      centers.set(ordered[0].id, { x: profile.w / 2, y: profile.h / 2 });
      var outer = ordered.slice(1);
      outer.forEach(function (group, index) {
        var angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(1, outer.length);
        var stagger = index % 2 ? 1 : .88;
        centers.set(group.id, {
          x: profile.w / 2 + Math.cos(angle) * 565 * stagger,
          y: profile.h / 2 + Math.sin(angle) * 360 * stagger,
        });
      });
      return centers;
    }

    function nodeDegree(id) {
      var degree = 0;
      data.edges.forEach(function (edge) { if (edge.source === id || edge.target === id) degree += 1; });
      return degree;
    }

    function layoutGraph() {
      var centers = groupCenters();
      nodePositions.clear();
      labelLayer.replaceChildren();

      data.groups.forEach(function (group, groupIndex) {
        var center = centers.get(group.id) || { x: profile.w / 2, y: profile.h / 2 };
        var groupNodes = data.nodes.filter(function (node) { return node.atlasGroup === group.id; });
        var ranked = groupNodes.slice().sort(function (a, b) {
          return Number(b.isHub) - Number(a.isHub) || nodeDegree(b.id) - nodeDegree(a.id) || a.title.localeCompare(b.title, 'ru');
        });
        var hub = ranked[0];
        var leaves = ranked.slice(1);
        var compact = profile.id === 'compact';
        var ringSize = compact ? 6 : 9;
        if (hub) {
          nodePositions.set(hub.id, {
            x: center.x,
            y: center.y,
            r: hub.isHub ? (compact ? 16 : 20) : (compact ? 12 : 14) + Math.min(compact ? 3 : 5, nodeDegree(hub.id)),
            hub: true,
          });
        }
        leaves.forEach(function (node, index) {
          var ring = Math.floor(index / ringSize);
          var ringStart = ring * ringSize;
          var ringCount = Math.min(ringSize, leaves.length - ringStart);
          var angle = Math.PI * 2 * (index - ringStart) / Math.max(1, ringCount) - Math.PI / 2 + groupIndex * (compact ? .37 : .29);
          var radiusX = (compact ? 48 : 92) + ring * (compact ? 40 : 68);
          var radiusY = (compact ? 38 : 72) + ring * (compact ? 32 : 54);
          nodePositions.set(node.id, {
            x: center.x + Math.cos(angle) * radiusX,
            y: center.y + Math.sin(angle) * radiusY,
            r: (compact ? 6.8 : 7.5) + Math.min(compact ? 3.8 : 5, nodeDegree(node.id) * .65 + Number(node.readingTime || 0) / 35),
            hub: false,
          });
        });

        var label = createSvg('text', {
          x: center.x,
          y: center.y - (compact
            ? 74 + Math.floor(leaves.length / ringSize) * 18
            : (leaves.length ? 124 + Math.floor(leaves.length / 10) * 24 : 52)),
          class: 'atlas-cluster-label',
          'text-anchor': 'middle',
          'data-group': group.id,
        });
        label.textContent = group.label;
        label.style.setProperty('--cluster-color', group.color);
        labelLayer.appendChild(label);
      });
      app.dataset.layoutProfile = profile.id;
    }

    function edgePath(edge, a, b) {
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var distance = Math.max(1, Math.hypot(dx, dy));
      var bendSeed = Array.from(edge.id).reduce(function (sum, character) { return sum + character.charCodeAt(0); }, 0);
      var bend = ((bendSeed % 17) - 8) * Math.min(profile.id === 'compact' ? 1.55 : 2.6, distance / (profile.id === 'compact' ? 180 : 210));
      var nx = -dy / distance;
      var ny = dx / distance;
      var cx = (a.x + b.x) / 2 + nx * bend;
      var cy = (a.y + b.y) / 2 + ny * bend;
      return 'M ' + a.x + ' ' + a.y + ' Q ' + cx + ' ' + cy + ' ' + b.x + ' ' + b.y;
    }

    function renderGraph() {
      edgeLayer.replaceChildren();
      nodeLayer.replaceChildren();
      edgeElements = [];
      nodeElements.clear();

      data.edges.forEach(function (edge) {
        var source = nodePositions.get(edge.source);
        var target = nodePositions.get(edge.target);
        if (!source || !target) return;
        var path = createSvg('path', {
          d: edgePath(edge, source, target),
          class: 'atlas-edge atlas-edge--' + edge.kind,
          'data-source': edge.source,
          'data-target': edge.target,
          'data-kind': edge.kind,
          fill: 'none',
        });
        edgeLayer.appendChild(path);
        edgeElements.push({ edge: edge, el: path });
      });

      data.nodes.forEach(function (node) {
        var position = nodePositions.get(node.id);
        if (!position) return;
        var group = groupById.get(node.atlasGroup);
        var nodeGroup = createSvg('g', {
          class: 'atlas-node' + (position.hub ? ' atlas-node--hub' : ''),
          transform: 'translate(' + position.x + ' ' + position.y + ')',
          tabindex: '-1',
          role: 'button',
          'aria-label': node.title + '. ' + group.label,
          'data-node-id': node.id,
          'data-group': node.atlasGroup,
        });
        nodeGroup.style.setProperty('--node-color', group.color);
        nodeGroup.append(
          createSvg('circle', { class: 'atlas-node__halo', r: position.r + (profile.id === 'compact' ? 10 : 13) }),
          createSvg('circle', { class: 'atlas-node__core', r: position.r }),
          createSvg('circle', {
            class: 'atlas-node__glint',
            cx: -position.r * .28,
            cy: -position.r * .32,
            r: Math.max(1.4, position.r * .18),
          })
        );
        var label = createSvg('text', {
          class: 'atlas-node__label',
          x: 0,
          y: position.r + (profile.id === 'compact' ? 15 : 19),
          'text-anchor': 'middle',
        });
        label.textContent = truncate(node.title, position.hub ? (profile.id === 'compact' ? 26 : 42) : (profile.id === 'compact' ? 20 : 30));
        nodeGroup.appendChild(label);
        nodeGroup.addEventListener('click', function (event) {
          event.stopPropagation();
          if (suppressClick) return;
          focusNode(node.id, true, true);
        });
        nodeGroup.addEventListener('keydown', function (event) { handleNodeKeyboard(event, node.id); });
        nodeLayer.appendChild(nodeGroup);
        nodeElements.set(node.id, nodeGroup);
      });

      var first = data.nodes.find(function (node) { return isNodeVisible(node); });
      if (first && nodeElements.has(first.id)) nodeElements.get(first.id).tabIndex = 0;
      applyFilters();
    }

    function relatedTo(id) {
      var result = [];
      data.edges.forEach(function (edge) {
        if (edge.source === id) result.push({ id: edge.target, edge: edge, orientation: 'outgoing' });
        else if (edge.target === id) result.push({ id: edge.source, edge: edge, orientation: edge.direction === 'directed' ? 'incoming' : 'undirected' });
      });
      return result.sort(function (a, b) {
        return b.edge.weight - a.edge.weight || nodeById.get(a.id).title.localeCompare(nodeById.get(b.id).title, 'ru');
      });
    }

    function relationLabel(item) {
      if (item.orientation === 'incoming' && item.edge.inverseLabel) return item.edge.inverseLabel;
      return item.edge.label || (item.edge.kind === 'series' ? 'Порядок серии' : item.edge.kind === 'cluster' ? 'Внутри темы' : item.edge.kind === 'structure' ? 'Раздел и материал' : 'Мост между темами');
    }

    function renderDetail(id) {
      var node = nodeById.get(id);
      if (!node) return;
      var group = groupById.get(node.atlasGroup);
      var neighbors = relatedTo(id).filter(function (item) { return nodeById.has(item.id); }).slice(0, 7);
      detail.style.setProperty('--detail-color', group.color);
      detailEmpty.hidden = true;
      detailContent.hidden = false;
      detailContent.replaceChildren();

      detailContent.appendChild(createElement('span', 'atlas-detail__kind', group.label));
      detailContent.appendChild(createElement('h2', '', node.title));
      var meta = createElement('div', 'atlas-detail__meta');
      meta.appendChild(createElement('span', '', node.readingTime ? node.readingTime + ' мин. чтения' : 'Материал библиотеки'));
      meta.appendChild(createElement('span', '', neighbors.length + ' ' + pluralRelations(neighbors.length)));
      detailContent.appendChild(meta);
      if (node.desc) detailContent.appendChild(createElement('p', 'atlas-detail__desc', node.desc));

      var primary = createElement('a', 'atlas-detail__primary');
      primary.href = node.url;
      primary.append(document.createTextNode('Читать материал '), createElement('span', '', '→'));
      primary.lastElementChild.setAttribute('aria-hidden', 'true');
      detailContent.appendChild(primary);

      if (neighbors.length) {
        var relations = createElement('section', 'atlas-detail__relations');
        var title = createElement('h3', '', 'Ближайшие связи');
        var titleId = 'atlasNeighborTitle-' + node.id;
        title.id = titleId;
        relations.setAttribute('aria-labelledby', titleId);
        relations.appendChild(title);
        var list = createElement('div');
        neighbors.forEach(function (item) {
          var neighbor = nodeById.get(item.id);
          var button = createElement('button');
          button.type = 'button';
          button.dataset.detailFocus = neighbor.id;
          button.appendChild(createElement('span', '', relationLabel(item)));
          button.appendChild(createElement('strong', '', neighbor.title));
          if (item.edge.rationale) button.title = item.edge.rationale;
          button.addEventListener('click', function () { focusNode(neighbor.id, true, true); });
          list.appendChild(button);
        });
        relations.appendChild(list);
        detailContent.appendChild(relations);
      }
      app.classList.add('has-detail');
      detail.classList.add('is-open');
    }

    function clampAxis(value, min, max) {
      if (max < min) return (min + max) / 2;
      return Math.max(min, Math.min(max, value));
    }

    function clampView(next) {
      var requested = Number(next.w);
      var width = Math.max(profile.min, Math.min(profile.max, Number.isFinite(requested) ? requested : profile.w));
      var height = width * profile.h / profile.w;
      var x = Number(next.x);
      var y = Number(next.y);
      return {
        x: clampAxis(Number.isFinite(x) ? x : 0, -profile.padX, profile.w + profile.padX - width),
        y: clampAxis(Number.isFinite(y) ? y : 0, -profile.padY, profile.h + profile.padY - height),
        w: width,
        h: height,
      };
    }

    function setViewBox(next, animate) {
      view = clampView(next);
      if (animate && !prefersReduced) svg.classList.add('is-camera-moving');
      svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
      var scale = profile.w / view.w;
      var level = scale < 1.35 ? 'overview' : scale < 2.45 ? 'cluster' : 'detail';
      app.dataset.zoomLevel = level;
      zoomCopy.textContent = level === 'overview' ? 'Обзор библиотеки' : level === 'cluster' ? 'Тематический кластер' : 'Подробное окружение';
      if (animate && !prefersReduced) window.setTimeout(function () { svg.classList.remove('is-camera-moving'); }, 360);
    }

    function zoomAt(factor, clientX, clientY, animate) {
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var px = clientX == null ? rect.left + rect.width / 2 : clientX;
      var py = clientY == null ? rect.top + rect.height / 2 : clientY;
      var ux = view.x + (px - rect.left) / rect.width * view.w;
      var uy = view.y + (py - rect.top) / rect.height * view.h;
      var nextWidth = Math.max(profile.min, Math.min(profile.max, view.w / factor));
      setViewBox({
        x: ux - (px - rect.left) / rect.width * nextWidth,
        y: uy - (py - rect.top) / rect.height * (nextWidth * profile.h / profile.w),
        w: nextWidth,
      }, animate);
    }

    function updateUrl(changes, mode) {
      var url = new URL(location.href);
      Object.entries(changes).forEach(function (entry) {
        if (entry[1] == null || entry[1] === '') url.searchParams.delete(entry[0]);
        else url.searchParams.set(entry[0], entry[1]);
      });
      var method = mode === 'push' ? 'pushState' : 'replaceState';
      history[method]({ atlas: true }, '', url);
    }

    function focusNode(id, moveCamera, pushHistory) {
      var node = nodeById.get(id);
      var position = nodePositions.get(id);
      if (!node || !position || !isNodeVisible(node) || !matchesSearch(node)) return;
      activeFocus = id;
      var neighbors = new Set(relatedTo(id).map(function (item) { return item.id; }));
      nodeElements.forEach(function (element, nodeId) {
        element.classList.toggle('is-focus', nodeId === id);
        element.classList.toggle('is-neighbor', neighbors.has(nodeId));
        element.classList.toggle('is-dim', nodeId !== id && !neighbors.has(nodeId));
        element.tabIndex = nodeId === id ? 0 : -1;
      });
      edgeElements.forEach(function (entry) {
        var connected = entry.edge.source === id || entry.edge.target === id;
        entry.el.classList.toggle('is-focus', connected);
        entry.el.classList.toggle('is-dim', !connected);
      });
      renderDetail(id);
      if (moveCamera) {
        var targetWidth = Math.min(view.w, profile.id === 'compact' ? 270 : 690);
        setViewBox({
          x: position.x - targetWidth / 2,
          y: position.y - targetWidth * profile.h / profile.w / 2,
          w: targetWidth,
        }, true);
      }
      updateUrl({ focus: id }, pushHistory ? 'push' : 'replace');
    }

    function clearFocus(updateHistory) {
      activeFocus = null;
      nodeElements.forEach(function (element) { element.classList.remove('is-focus', 'is-neighbor', 'is-dim'); });
      edgeElements.forEach(function (entry) { entry.el.classList.remove('is-focus', 'is-dim'); });
      detail.classList.remove('is-open');
      app.classList.remove('has-detail');
      detailEmpty.hidden = false;
      detailContent.hidden = true;
      if (updateHistory !== false) updateUrl({ focus: null }, 'replace');
      applyFilters();
    }

    function isNodeVisible(node) {
      return Boolean(node) && (activeGroup === 'all' || node.atlasGroup === activeGroup);
    }

    function matchesSearch(node) {
      if (!node) return false;
      if (!searchQuery) return true;
      return (node.title + ' ' + node.tags.join(' ') + ' ' + node.desc + ' ' + node.atlasGroup).toLowerCase().includes(searchQuery);
    }

    function applyFilters() {
      nodeElements.forEach(function (element, id) {
        var node = nodeById.get(id);
        element.classList.toggle('is-filtered-out', !isNodeVisible(node) || !matchesSearch(node));
      });
      edgeElements.forEach(function (entry) {
        var source = nodeById.get(entry.edge.source);
        var target = nodeById.get(entry.edge.target);
        var visible = enabledKinds.has(entry.edge.kind) && isNodeVisible(source) && isNodeVisible(target)
          && matchesSearch(source) && matchesSearch(target);
        entry.el.classList.toggle('is-filtered-out', !visible);
      });
      document.querySelectorAll('[data-list-group]').forEach(function (section) {
        section.hidden = activeGroup !== 'all' && section.dataset.listGroup !== activeGroup;
      });
      document.querySelectorAll('[data-list-node]').forEach(function (row) {
        var node = nodeById.get(row.dataset.listNode);
        row.hidden = !isNodeVisible(node) || !matchesSearch(node);
      });
      if (activeFocus && (!isNodeVisible(nodeById.get(activeFocus)) || !matchesSearch(nodeById.get(activeFocus)))) clearFocus(false);
      var tabbable = Array.from(nodeElements.entries()).find(function (entry) { return !entry[1].classList.contains('is-filtered-out'); });
      if (!activeFocus && tabbable) {
        nodeElements.forEach(function (element) { element.tabIndex = -1; });
        tabbable[1].tabIndex = 0;
      }
    }

    function setGroup(group, pushHistory) {
      activeGroup = groupById.has(group) ? group : 'all';
      document.querySelectorAll('[data-atlas-group]').forEach(function (button) {
        var active = button.dataset.atlasGroup === activeGroup;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      clearFocus(false);
      applyFilters();
      closeFilters();
      updateUrl({ group: activeGroup === 'all' ? null : activeGroup }, pushHistory ? 'push' : 'replace');
    }

    function setView(mode, pushHistory) {
      activeView = mode === 'list' ? 'list' : 'graph';
      app.dataset.view = activeView;
      graphView.hidden = activeView !== 'graph';
      listView.hidden = activeView !== 'list';
      document.querySelectorAll('[data-atlas-view]').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.atlasView === activeView ? 'true' : 'false');
      });
      if (pushHistory !== false) updateUrl({ view: activeView === 'graph' ? null : activeView }, pushHistory ? 'push' : 'replace');
    }

    function renderSearchResults(results) {
      searchResults.replaceChildren();
      searchCursor = -1;
      results.forEach(function (node, index) {
        var group = groupById.get(node.atlasGroup);
        var button = createElement('button');
        button.type = 'button';
        button.id = 'atlasSearchOption-' + index;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', 'false');
        button.dataset.searchFocus = node.id;
        button.appendChild(createElement('strong', '', node.title));
        button.appendChild(createElement('span', '', group.label));
        button.addEventListener('click', function () {
          searchInput.value = '';
          searchQuery = '';
          applyFilters();
          setView('graph', true);
          focusNode(node.id, true, true);
          closeSearchResults();
        });
        searchResults.appendChild(button);
      });
      searchResults.hidden = !results.length;
      searchInput.setAttribute('aria-expanded', results.length ? 'true' : 'false');
      searchInput.removeAttribute('aria-activedescendant');
    }

    function runSearch(query) {
      searchQuery = text(query).toLowerCase();
      applyFilters();
      if (!searchQuery) {
        closeSearchResults();
        return [];
      }
      var results = data.nodes.filter(function (node) { return matchesSearch(node) && isNodeVisible(node); }).slice(0, 8);
      renderSearchResults(results);
      return results;
    }

    function moveSearchCursor(delta) {
      var options = Array.from(searchResults.querySelectorAll('[role="option"]'));
      if (!options.length) return;
      searchCursor = (searchCursor + delta + options.length) % options.length;
      options.forEach(function (option, index) { option.setAttribute('aria-selected', index === searchCursor ? 'true' : 'false'); });
      searchInput.setAttribute('aria-activedescendant', options[searchCursor].id);
      options[searchCursor].scrollIntoView({ block: 'nearest' });
    }

    function closeSearchResults() {
      searchResults.hidden = true;
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
      searchCursor = -1;
    }

    function closeFilters() {
      sidebar.classList.remove('is-open');
      filterTrigger.setAttribute('aria-expanded', 'false');
    }

    function nearestNode(currentId, key) {
      var current = nodePositions.get(currentId);
      if (!current) return null;
      var best = null;
      var bestScore = Infinity;
      nodePositions.forEach(function (position, id) {
        if (id === currentId) return;
        var element = nodeElements.get(id);
        if (!element || element.classList.contains('is-filtered-out')) return;
        var dx = position.x - current.x;
        var dy = position.y - current.y;
        var directional = key === 'ArrowRight' ? dx > 0 : key === 'ArrowLeft' ? dx < 0 : key === 'ArrowDown' ? dy > 0 : dy < 0;
        if (!directional) return;
        var primary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(dx) : Math.abs(dy);
        var secondary = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
        var score = primary + secondary * 1.7;
        if (score < bestScore) { bestScore = score; best = id; }
      });
      return best;
    }

    function handleNodeKeyboard(event, id) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        focusNode(id, true, true);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        clearFocus();
        return;
      }
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        var target = nearestNode(id, event.key);
        if (target) {
          event.preventDefault();
          nodeElements.forEach(function (element) { element.tabIndex = -1; });
          nodeElements.get(target).tabIndex = 0;
          nodeElements.get(target).focus();
        }
      }
    }

    function restoreUrlState() {
      var params = new URL(location.href).searchParams;
      activeGroup = params.get('group') && groupById.has(params.get('group')) ? params.get('group') : 'all';
      setGroup(activeGroup, false);
      setView(params.get('view') === 'list' ? 'list' : 'graph', false);
      var focus = params.get('focus');
      if (focus && nodeById.has(focus)) focusNode(focus, true, false);
      else clearFocus(false);
    }

    function relayoutForViewport() {
      var nextProfile = compactMedia.matches ? COMPACT_WORLD : DESKTOP_WORLD;
      if (nextProfile.id === profile.id) return;
      var focused = activeFocus;
      profile = nextProfile;
      view = initialView();
      layoutGraph();
      renderGraph();
      setViewBox(initialView(), false);
      if (focused && isNodeVisible(nodeById.get(focused)) && matchesSearch(nodeById.get(focused))) focusNode(focused, true, false);
      else applyFilters();
    }

    layoutGraph();
    renderGraph();
    setViewBox(initialView(), false);
    restoreUrlState();
    app.dataset.runtimeReady = '1';
    app.dataset.runtimeNodes = String(data.nodes.length);
    app.dataset.runtimeEdges = String(data.edges.length);
    app.dataset.runtimeEngine = data.engineVersion;

    svg.addEventListener('wheel', function (event) {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 1.16 : .86, event.clientX, event.clientY, false);
    }, { passive: false });

    svg.addEventListener('pointerdown', function (event) {
      if (event.target.closest && event.target.closest('.atlas-node')) return;
      svg.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      suppressClick = false;
      if (pointers.size === 1) {
        gesture = { type: 'pan', startX: event.clientX, startY: event.clientY, view: Object.assign({}, view), moved: false };
      } else if (pointers.size === 2) {
        var points = Array.from(pointers.values());
        gesture = {
          type: 'pinch',
          distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
          view: Object.assign({}, view),
          moved: false,
        };
      }
      svg.classList.add('is-dragging');
    });

    svg.addEventListener('pointermove', function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      var rect = svg.getBoundingClientRect();
      if (pointers.size === 1 && gesture && gesture.type === 'pan') {
        var deltaX = event.clientX - gesture.startX;
        var deltaY = event.clientY - gesture.startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 5) gesture.moved = true;
        setViewBox({
          x: gesture.view.x - deltaX * gesture.view.w / rect.width,
          y: gesture.view.y - deltaY * gesture.view.h / rect.height,
          w: gesture.view.w,
        }, false);
      } else if (pointers.size === 2 && gesture && gesture.type === 'pinch') {
        var points = Array.from(pointers.values());
        var distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (Math.abs(distance - gesture.distance) > 5) gesture.moved = true;
        if (gesture.distance > 0) {
          var nextWidth = Math.max(profile.min, Math.min(profile.max, gesture.view.w / (distance / gesture.distance)));
          setViewBox({
            x: gesture.view.x + (gesture.view.w - nextWidth) / 2,
            y: gesture.view.y + (gesture.view.h - nextWidth * profile.h / profile.w) / 2,
            w: nextWidth,
          }, false);
        }
      }
    });

    function endPointer(event) {
      if (gesture && gesture.moved) {
        suppressClick = true;
        window.setTimeout(function () { suppressClick = false; }, 0);
      }
      pointers.delete(event.pointerId);
      if (!pointers.size) {
        gesture = null;
        svg.classList.remove('is-dragging');
      } else {
        var point = Array.from(pointers.values())[0];
        gesture = { type: 'pan', startX: point.x, startY: point.y, view: Object.assign({}, view), moved: false };
      }
    }

    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('click', function (event) {
      if (!suppressClick && (event.target === svg || event.target === world)) clearFocus();
    });

    document.getElementById('atlasZoomIn').addEventListener('click', function () { zoomAt(1.35, null, null, true); });
    document.getElementById('atlasZoomOut').addEventListener('click', function () { zoomAt(.74, null, null, true); });
    document.getElementById('atlasCenter').addEventListener('click', function () { clearFocus(); setViewBox(initialView(), true); });
    document.getElementById('atlasDetailClose').addEventListener('click', function () { clearFocus(); });
    document.querySelectorAll('[data-atlas-view]').forEach(function (button) {
      button.addEventListener('click', function () { setView(button.dataset.atlasView, true); });
    });
    document.querySelectorAll('[data-atlas-group]').forEach(function (button) {
      button.addEventListener('click', function () { setGroup(button.dataset.atlasGroup, true); });
    });
    document.querySelectorAll('.atlas-relation-filter input').forEach(function (input) {
      input.addEventListener('change', function () {
        enabledKinds = new Set(Array.from(document.querySelectorAll('.atlas-relation-filter input:checked')).map(function (item) { return item.value; }));
        applyFilters();
      });
    });
    document.querySelectorAll('[data-list-focus]').forEach(function (button) {
      button.addEventListener('click', function () { setView('graph', true); focusNode(button.dataset.listFocus, true, true); });
    });

    searchInput.addEventListener('input', function () { runSearch(searchInput.value); });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeSearchResults(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSearchCursor(1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveSearchCursor(-1); return; }
      if (event.key === 'Enter') {
        var options = Array.from(searchResults.querySelectorAll('[role="option"]'));
        var selected = options[searchCursor] || options[0];
        if (selected) {
          event.preventDefault();
          searchInput.value = '';
          searchQuery = '';
          applyFilters();
          setView('graph', true);
          focusNode(selected.dataset.searchFocus, true, true);
          closeSearchResults();
        }
      }
    });

    filterTrigger.addEventListener('click', function () {
      var open = !sidebar.classList.contains('is-open');
      sidebar.classList.toggle('is-open', open);
      filterTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.getElementById('atlasFilterClose').addEventListener('click', closeFilters);
    resetButton.addEventListener('click', function () {
      searchInput.value = '';
      searchQuery = '';
      closeSearchResults();
      enabledKinds = new Set(ALL_KINDS);
      document.querySelectorAll('.atlas-relation-filter input').forEach(function (input) { input.checked = true; });
      activeGroup = 'all';
      document.querySelectorAll('[data-atlas-group]').forEach(function (button) {
        var active = button.dataset.atlasGroup === 'all';
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      clearFocus(false);
      applyFilters();
      setView('graph', false);
      setViewBox(initialView(), true);
      history.pushState({ atlas: true }, '', location.pathname);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { clearFocus(); closeFilters(); closeSearchResults(); }
      if ((event.key === '+' || event.key === '=') && document.activeElement !== searchInput) zoomAt(1.25, null, null, true);
      if (event.key === '-' && document.activeElement !== searchInput) zoomAt(.8, null, null, true);
      if (event.key === '0' && document.activeElement !== searchInput) setViewBox(initialView(), true);
    });
    window.addEventListener('popstate', restoreUrlState);
    if (typeof compactMedia.addEventListener === 'function') compactMedia.addEventListener('change', relayoutForViewport);
    else if (typeof compactMedia.addListener === 'function') compactMedia.addListener(relayoutForViewport);
  }

  function recover(error) {
    var app = document.getElementById('atlasApp');
    if (app) {
      app.dataset.runtimeError = '1';
      app.dataset.view = 'list';
      app.classList.remove('has-detail');
    }
    var copy = document.getElementById('atlasZoomCopy');
    if (copy) copy.textContent = 'Карта временно недоступна — используйте список';
    var graph = document.getElementById('atlasGraphView');
    var list = document.getElementById('atlasListView');
    if (graph) graph.hidden = true;
    if (list) list.hidden = false;
    document.querySelectorAll('[data-atlas-view="graph"], #atlasZoomIn, #atlasZoomOut, #atlasCenter').forEach(function (control) {
      control.setAttribute('aria-disabled', 'true');
      control.disabled = true;
    });
    console.warn('[atlas] compiled runtime unavailable', error);
  }

  ready(function () {
    fetch(DATA_URL, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('compiled relations HTTP ' + response.status);
        return response.json();
      })
      .then(init)
      .catch(recover);
  });
})();
