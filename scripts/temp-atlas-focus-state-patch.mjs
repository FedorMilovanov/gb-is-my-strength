#!/usr/bin/env node
import fs from 'node:fs';

const file = 'src/runtime/atlas-runtime.js';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: source marker missing`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source marker is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "    var detailContent = document.getElementById('atlasDetailContent');\n    var graphView = document.getElementById('atlasGraphView');",
  "    var detailContent = document.getElementById('atlasDetailContent');\n    var detailClose = document.getElementById('atlasDetailClose');\n    var graphView = document.getElementById('atlasGraphView');",
  'detail close owner',
);

replaceOnce(
  "    var sidebar = document.getElementById('atlasSidebar');\n    var filterTrigger = document.getElementById('atlasFilterTrigger');\n    var resetButton = document.getElementById('atlasReset');",
  "    var sidebar = document.getElementById('atlasSidebar');\n    var filterTrigger = document.getElementById('atlasFilterTrigger');\n    var filterClose = document.getElementById('atlasFilterClose');\n    var resetButton = document.getElementById('atlasReset');",
  'filter close owner',
);

replaceOnce(
  "    function initialView() {\n      return { x: 0, y: 0, w: profile.w, h: profile.h };\n    }\n\n    function createSvg(tag, attrs) {",
  `    function initialView() {\n      return { x: 0, y: 0, w: profile.w, h: profile.h };\n    }\n\n    function focusable(element) {\n      if (!element || typeof element.focus !== 'function' || element.isConnected === false) return false;\n      if (element.closest && element.closest('[inert],[hidden],[aria-hidden="true"]')) return false;\n      if ('disabled' in element && element.disabled) return false;\n      return element.getClientRects().length > 0;\n    }\n\n    function safeFocus(element) {\n      if (!focusable(element)) return false;\n      try { element.focus({ preventScroll: true }); return document.activeElement === element; }\n      catch (_) { try { element.focus(); return document.activeElement === element; } catch (_) { return false; } }\n    }\n\n    function setSurfaceInert(element, inert, ariaHidden) {\n      if (!element) return;\n      if ('inert' in element) element.inert = Boolean(inert);\n      if (inert) element.setAttribute('inert', '');\n      else element.removeAttribute('inert');\n      if (ariaHidden === true) element.setAttribute('aria-hidden', 'true');\n      else if (ariaHidden === false) element.setAttribute('aria-hidden', 'false');\n      else element.removeAttribute('aria-hidden');\n    }\n\n    function focusGraphOwner(preferredId) {\n      if (graphView.hidden) return false;\n      var preferred = preferredId && nodeElements.get(preferredId);\n      if (preferred && !preferred.classList.contains('is-filtered-out')) {\n        nodeElements.forEach(function (element) { element.tabIndex = element === preferred ? 0 : -1; });\n        if (safeFocus(preferred)) return true;\n      }\n      var current = Array.from(nodeElements.values()).find(function (element) {\n        return element.tabIndex === 0 && !element.classList.contains('is-filtered-out');\n      });\n      if (!current) current = Array.from(nodeElements.values()).find(function (element) { return !element.classList.contains('is-filtered-out'); });\n      if (current) {\n        nodeElements.forEach(function (element) { element.tabIndex = element === current ? 0 : -1; });\n        if (safeFocus(current)) return true;\n      }\n      return safeFocus(svg);\n    }\n\n    function focusListOwner() {\n      if (listView.hidden) return false;\n      var rows = Array.from(listView.querySelectorAll('[data-list-node]')).filter(function (row) {\n        return !row.hidden && !(row.closest('[hidden]'));\n      });\n      for (var index = 0; index < rows.length; index += 1) {\n        var target = rows[index].querySelector('a[href],button');\n        if (safeFocus(target)) return true;\n      }\n      return false;\n    }\n\n    function focusActiveView(preferredId) {\n      return activeView === 'list' ? focusListOwner() : focusGraphOwner(preferredId);\n    }\n\n    function syncDetailSurface(open) {\n      detail.classList.toggle('is-open', Boolean(open));\n      app.classList.toggle('has-detail', Boolean(open));\n      setSurfaceInert(detail, !open, open ? false : true);\n    }\n\n    function syncSidebarSurface(open, options) {\n      options = options || {};\n      var compact = compactMedia.matches;\n      var activeWasInside = sidebar.contains(document.activeElement);\n      var shouldOpen = compact && Boolean(open);\n      sidebar.classList.toggle('is-open', shouldOpen);\n      filterTrigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');\n      if (compact) {\n        setSurfaceInert(sidebar, !shouldOpen, shouldOpen ? false : true);\n        if (shouldOpen && options.focusOnOpen !== false) safeFocus(filterClose || sidebar.querySelector('button,input,a[href]'));\n        if (!shouldOpen && (options.restoreFocus === true || activeWasInside)) safeFocus(filterTrigger);\n      } else {\n        setSurfaceInert(sidebar, false, null);\n      }\n      return shouldOpen;\n    }\n\n    function createSvg(tag, attrs) {`,
  'focus lifecycle helpers',
);

replaceOnce(
  "      app.classList.add('has-detail');\n      detail.classList.add('is-open');",
  "      syncDetailSurface(true);",
  'detail open lifecycle',
);

replaceOnce(
  "    function focusNode(id, moveCamera, pushHistory) {\n      var node = nodeById.get(id);",
  "    function focusNode(id, moveCamera, pushHistory) {\n      var detailOwnedFocus = detail.contains(document.activeElement);\n      var node = nodeById.get(id);",
  'detail replacement focus capture',
);

replaceOnce(
  "      renderDetail(id);\n      if (moveCamera) {",
  "      renderDetail(id);\n      if (detailOwnedFocus) safeFocus(detail.querySelector('.atlas-detail__primary') || detailClose);\n      if (moveCamera) {",
  'detail replacement focus restore',
);

replaceOnce(
  `    function clearFocus(updateHistory) {\n      activeFocus = null;\n      nodeElements.forEach(function (element) { element.classList.remove('is-focus', 'is-neighbor', 'is-dim'); });\n      edgeElements.forEach(function (entry) { entry.el.classList.remove('is-focus', 'is-dim'); });\n      detail.classList.remove('is-open');\n      app.classList.remove('has-detail');\n      detailEmpty.hidden = false;\n      detailContent.hidden = true;\n      if (updateHistory !== false) updateUrl({ focus: null }, 'replace');\n      applyFilters();\n    }`,
  `    function clearFocus(updateHistory, options) {\n      options = options || {};\n      var previousFocus = activeFocus;\n      var activeWasInsideDetail = detail.contains(document.activeElement);\n      activeFocus = null;\n      nodeElements.forEach(function (element) { element.classList.remove('is-focus', 'is-neighbor', 'is-dim'); });\n      edgeElements.forEach(function (entry) { entry.el.classList.remove('is-focus', 'is-dim'); });\n      syncDetailSurface(false);\n      detailEmpty.hidden = false;\n      detailContent.hidden = true;\n      if (updateHistory !== false) updateUrl({ focus: null }, 'replace');\n      applyFilters();\n      if (options.restoreFocus === true || activeWasInsideDetail) focusGraphOwner(previousFocus);\n    }`,
  'detail close lifecycle',
);

replaceOnce(
  `      var tabbable = Array.from(nodeElements.entries()).find(function (entry) { return !entry[1].classList.contains('is-filtered-out'); });\n      if (!activeFocus && tabbable) {\n        nodeElements.forEach(function (element) { element.tabIndex = -1; });\n        tabbable[1].tabIndex = 0;\n      }`,
  `      var activeGraphNode = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.atlas-node') : null;\n      var tabbable = Array.from(nodeElements.entries()).find(function (entry) { return !entry[1].classList.contains('is-filtered-out'); });\n      if (!activeFocus && tabbable) {\n        nodeElements.forEach(function (element) { element.tabIndex = -1; });\n        tabbable[1].tabIndex = 0;\n      }\n      if (activeGraphNode && activeGraphNode.classList.contains('is-filtered-out')) focusGraphOwner(null);`,
  'filtered graph focus recovery',
);

replaceOnce(
  `      clearFocus(false);\n      applyFilters();\n      closeFilters();\n      updateUrl({`,
  `      clearFocus(false);\n      applyFilters();\n      closeFilters({ restoreFocus: sidebar.contains(document.activeElement) });\n      updateUrl({`,
  'group drawer focus recovery',
);

replaceOnce(
  `    function setView(mode, pushHistory) {\n      activeView = mode === 'list' ? 'list' : 'graph';\n      app.dataset.view = activeView;\n      graphView.hidden = activeView !== 'graph';\n      listView.hidden = activeView !== 'list';\n      document.querySelectorAll('[data-atlas-view]').forEach(function (button) {\n        button.setAttribute('aria-pressed', button.dataset.atlasView === activeView ? 'true' : 'false');\n      });\n      if (pushHistory !== false) updateUrl({ view: activeView === 'graph' ? null : activeView }, pushHistory ? 'push' : 'replace');\n    }`,
  `    function setView(mode, pushHistory) {\n      var activeWasInGraph = graphView.contains(document.activeElement);\n      var activeWasInList = listView.contains(document.activeElement);\n      activeView = mode === 'list' ? 'list' : 'graph';\n      app.dataset.view = activeView;\n      graphView.hidden = activeView !== 'graph';\n      listView.hidden = activeView !== 'list';\n      document.querySelectorAll('[data-atlas-view]').forEach(function (button) {\n        button.setAttribute('aria-pressed', button.dataset.atlasView === activeView ? 'true' : 'false');\n      });\n      if (activeView === 'graph' && activeWasInList) focusGraphOwner(activeFocus);\n      if (activeView === 'list' && activeWasInGraph) focusListOwner();\n      if (pushHistory !== false) updateUrl({ view: activeView === 'graph' ? null : activeView }, pushHistory ? 'push' : 'replace');\n    }`,
  'view focus handoff',
);

replaceOnce(
  `    function closeFilters() {\n      sidebar.classList.remove('is-open');\n      filterTrigger.setAttribute('aria-expanded', 'false');\n    }`,
  `    function closeFilters(options) {\n      syncSidebarSurface(false, options || {});\n    }`,
  'drawer close lifecycle',
);

replaceOnce(
  `      if (event.key === 'Escape') {\n        event.preventDefault();\n        clearFocus();\n        return;\n      }`,
  `      if (event.key === 'Escape') {\n        event.preventDefault();\n        clearFocus(true, { restoreFocus: true });\n        return;\n      }`,
  'node Escape focus recovery',
);

replaceOnce(
  `    function restoreUrlState() {\n      var params = new URL(location.href).searchParams;\n      activeGroup = params.get('group') && groupById.has(params.get('group')) ? params.get('group') : 'all';\n      setGroup(activeGroup, false);\n      setView(params.get('view') === 'list' ? 'list' : 'graph', false);\n      var focus = params.get('focus');\n      if (focus && nodeById.has(focus)) focusNode(focus, true, false);\n      else clearFocus(false);\n    }`,
  `    function restoreUrlState() {\n      var activeBefore = document.activeElement;\n      var activeWasInsideAtlas = app.contains(activeBefore);\n      var params = new URL(location.href).searchParams;\n      activeGroup = params.get('group') && groupById.has(params.get('group')) ? params.get('group') : 'all';\n      setGroup(activeGroup, false);\n      setView(params.get('view') === 'list' ? 'list' : 'graph', false);\n      var focus = params.get('focus');\n      if (focus && nodeById.has(focus)) focusNode(focus, true, false);\n      else clearFocus(false);\n      if (activeWasInsideAtlas && (!activeBefore.isConnected || (activeBefore.closest && activeBefore.closest('[inert],[hidden],[aria-hidden="true"]')))) {\n        focusActiveView(activeFocus);\n      }\n    }`,
  'history focus recovery',
);

replaceOnce(
  `    function relayoutForViewport() {\n      var nextProfile = compactMedia.matches ? COMPACT_WORLD : DESKTOP_WORLD;\n      if (nextProfile.id === profile.id) return;\n      var focused = activeFocus;\n      profile = nextProfile;\n      view = initialView();\n      layoutGraph();\n      renderGraph();\n      setViewBox(initialView(), false);\n      if (focused && isNodeVisible(nodeById.get(focused)) && matchesSearch(nodeById.get(focused))) focusNode(focused, true, false);\n      else applyFilters();\n    }`,
  `    function relayoutForViewport() {\n      var nextProfile = compactMedia.matches ? COMPACT_WORLD : DESKTOP_WORLD;\n      if (nextProfile.id === profile.id) return;\n      var focused = activeFocus;\n      var activeBefore = document.activeElement;\n      var activeNode = activeBefore && activeBefore.closest ? activeBefore.closest('.atlas-node') : null;\n      var activeNodeId = activeNode && activeNode.dataset ? activeNode.dataset.nodeId : null;\n      var activeWasGraph = graphView.contains(activeBefore);\n      var activeWasSidebar = sidebar.contains(activeBefore);\n      profile = nextProfile;\n      view = initialView();\n      layoutGraph();\n      renderGraph();\n      setViewBox(initialView(), false);\n      syncSidebarSurface(false, { restoreFocus: activeWasSidebar });\n      if (focused && isNodeVisible(nodeById.get(focused)) && matchesSearch(nodeById.get(focused))) focusNode(focused, true, false);\n      else applyFilters();\n      if (activeWasGraph) focusGraphOwner(activeNodeId || focused);\n    }`,
  'resize focus recovery',
);

replaceOnce(
  `    document.getElementById('atlasCenter').addEventListener('click', function () { clearFocus(); setViewBox(initialView(), true); });\n    document.getElementById('atlasDetailClose').addEventListener('click', function () { clearFocus(); });`,
  `    document.getElementById('atlasCenter').addEventListener('click', function () { clearFocus(); setViewBox(initialView(), true); });\n    detailClose.addEventListener('click', function () { clearFocus(true, { restoreFocus: true }); });`,
  'detail close event',
);

replaceOnce(
  `    document.querySelectorAll('[data-list-focus]').forEach(function (button) {\n      button.addEventListener('click', function () { setView('graph', true); focusNode(button.dataset.listFocus, true, true); });\n    });`,
  `    document.querySelectorAll('[data-list-focus]').forEach(function (button) {\n      button.addEventListener('click', function () {\n        var targetId = button.dataset.listFocus;\n        setView('graph', true);\n        focusNode(targetId, true, true);\n        focusGraphOwner(targetId);\n      });\n    });`,
  'list to graph focus handoff',
);

replaceOnce(
  `    filterTrigger.addEventListener('click', function () {\n      var open = !sidebar.classList.contains('is-open');\n      sidebar.classList.toggle('is-open', open);\n      filterTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');\n    });\n    document.getElementById('atlasFilterClose').addEventListener('click', closeFilters);`,
  `    filterTrigger.addEventListener('click', function () {\n      var open = !sidebar.classList.contains('is-open');\n      syncSidebarSurface(open, { focusOnOpen: true, restoreFocus: !open });\n    });\n    filterClose.addEventListener('click', function () { closeFilters({ restoreFocus: true }); });`,
  'drawer event lifecycle',
);

replaceOnce(
  `    document.addEventListener('keydown', function (event) {\n      if (event.key === 'Escape') { clearFocus(); closeFilters(); closeSearchResults(); }`,
  `    document.addEventListener('keydown', function (event) {\n      if (event.key === 'Escape') {\n        var restoreDetail = detail.classList.contains('is-open');\n        var restoreDrawer = sidebar.contains(document.activeElement);\n        clearFocus(true, { restoreFocus: restoreDetail });\n        closeFilters({ restoreFocus: restoreDrawer });\n        closeSearchResults();\n      }`,
  'global Escape lifecycle',
);

fs.writeFileSync(file, source);
console.log('Atlas focus-state patch applied');
