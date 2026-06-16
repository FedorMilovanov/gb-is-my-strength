/**
 * map-render.js — Core rendering & interaction (v0.4)
 * Creates SVG map, nodes, edges, viewport controls.
 */
'use strict';

const MapRender = (function() {

  const DEFAULTS = {
    W0: 1900, H0: 1430,
    minW: 300, maxW: 2600,
    padX: 450, padY: 380,
    tourDelay: 2600
  };

  function createMap(container, routeData, opts = {}) {
    const W = DEFAULTS.W0;
    const H = DEFAULTS.H0;
    const route = routeData;

    // Container setup
    container.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.background = '#070a10';
    container.appendChild(svg);

    // Background geo layer
    if (opts.baseGeoUrl) {
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.setAttribute('href', opts.baseGeoUrl);
      img.setAttribute('width', W);
      img.setAttribute('height', H);
      img.setAttribute('opacity', '0.35');
      svg.appendChild(img);
    }

    // Edges
    const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesGroup.setAttribute('class', 'edges');
    svg.appendChild(edgesGroup);

    (route.stages || []).forEach((st, i) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('class', 'route');
      line.setAttribute('stroke', '#e8c879');
      line.setAttribute('stroke-width', '2.2');
      line.setAttribute('stroke-opacity', '0.35');
      line.setAttribute('fill', 'none');
      edgesGroup.appendChild(line);
    });

    // Nodes
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes');
    svg.appendChild(nodesGroup);

    const nodeElements = {};
    (route.places || []).forEach(place => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'node');
      g.setAttribute('data-id', place.id);

      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('cx', place.x);
      halo.setAttribute('cy', place.y);
      halo.setAttribute('r', place.r || 14);
      halo.setAttribute('class', 'halo');
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', '#e8c879');
      halo.setAttribute('stroke-width', '1.8');
      halo.setAttribute('opacity', '0');

      const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      core.setAttribute('cx', place.x);
      core.setAttribute('cy', place.y);
      core.setAttribute('r', place.r || 11);
      core.setAttribute('class', 'core');
      core.setAttribute('fill', '#e8c879');

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', place.x);
      label.setAttribute('y', place.y + 28);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'mk-label');
      label.textContent = place.name;

      g.appendChild(halo);
      g.appendChild(core);
      g.appendChild(label);
      nodesGroup.appendChild(g);

      nodeElements[place.id] = { g, halo, core, label };

      g.addEventListener('click', () => {
        if (opts.onPlaceOpen) opts.onPlaceOpen(place);
      });
    });

    // Viewport state
    let view = { x: W/2, y: H/2, k: 1 };
    let isDragging = false;
    let lastX = 0, lastY = 0;

    function applyView() {
      const t = `translate(${view.x} ${view.y}) scale(${view.k}) translate(${-W/2} ${-H/2})`;
      nodesGroup.setAttribute('transform', t);
      edgesGroup.setAttribute('transform', t);
    }

    // Zoom & pan
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * W;
      const my = (e.clientY - rect.top) / rect.height * H;

      const factor = e.deltaY < 0 ? 1.18 : 0.82;
      const newK = Math.max(DEFAULTS.minW / W, Math.min(DEFAULTS.maxW / W, view.k * factor));

      const dx = (mx - view.x) * (1 - newK / view.k);
      const dy = (my - view.y) * (1 - newK / view.k);

      view.k = newK;
      view.x += dx;
      view.y += dy;
      applyView();
    });

    svg.addEventListener('pointerdown', e => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      svg.setPointerCapture(e.pointerId);
    });

    svg.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const dx = (e.clientX - lastX) / view.k;
      const dy = (e.clientY - lastY) / view.k;
      view.x += dx;
      view.y += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      applyView();
    });

    svg.addEventListener('pointerup', () => {
      isDragging = false;
    });

    // Public API
    const api = {
      flyTo(cx, cy, zoom = view.k, duration = 420) {
        const startX = view.x, startY = view.y, startK = view.k;
        const endX = W/2 - cx * zoom, endY = H/2 - cy * zoom;
        const endK = zoom;

        const t0 = performance.now();
        function step(now) {
          const p = Math.min(1, (now - t0) / duration);
          const e = 1 - Math.pow(1 - p, 3);
          view.x = startX + (endX - startX) * e;
          view.y = startY + (endY - startY) * e;
          view.k = startK + (endK - startK) * e;
          applyView();
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      },

      openPlace(id) {
        const place = route.places.find(p => p.id === id);
        if (place && opts.onPlaceOpen) opts.onPlaceOpen(place);
      },

      setStory(storyId) {
        // Highlight only places in this story
        Object.keys(nodeElements).forEach(pid => {
          const el = nodeElements[pid];
          const place = route.places.find(p => p.id === pid);
          const inStory = !storyId || (place && place.story === storyId);
          el.g.style.opacity = inStory ? '1' : '0.25';
        });
      },

      resetView() {
        view = { x: W/2, y: H/2, k: 1 };
        applyView();
      },

      destroy() {
        container.innerHTML = '';
      }
    };

    // Initial view
    view.x = W/2;
    view.y = H/2;
    applyView();

    return api;
  }

  return { createMap };
})();
