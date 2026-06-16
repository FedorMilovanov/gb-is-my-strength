/**
 * map-engine.js v0.4 — Modular Biblical Map Engine
 * 
 * This is the public facade. It re-exports the clean modular API.
 * 
 * Usage:
 *   import { MapData, MapRender } from './map-engine.js';
 *   const route = await MapData.loadRoute('./route.json');
 *   const map = MapRender.createMap(container, route, { onPlaceOpen: ... });
 */
'use strict';

// Re-export modular layers
// In a real bundler this would be proper imports.
// For static GitHub Pages we keep it simple but clean.

const MapEngine = (function() {

  // === DATA LAYER ===
  const MapData = {
    normalizeRouteData(data = {}) {
      const places = Array.isArray(data.places) ? data.places : (data.places_index || []);
      const stages = Array.isArray(data.stages) ? data.stages : (data.stages_index || []);
      const ctx = Array.isArray(data.ctx) ? data.ctx : (data.ctx_index || []);
      const stories = Array.isArray(data.stories) ? data.stories : [];
      return { ...data, places, stages, ctx, stories };
    },

    async loadRoute(url, opts = {}) {
      const res = await fetch(url, {
        credentials: opts.credentials || 'same-origin',
        headers: { Accept: 'application/json', ...(opts.headers || {}) }
      });
      if (!res.ok) throw new Error(`MapData.loadRoute: ${res.status} ${url}`);
      return this.normalizeRouteData(await res.json());
    },

    validateRoute(data = {}) {
      const route = this.normalizeRouteData(data);
      const errors = [], warnings = [], ids = new Set();

      route.places.forEach((p, i) => {
        if (!p || !p.id) errors.push(`places[${i}] has no id`);
        if (p && p.id) {
          if (ids.has(p.id)) errors.push(`duplicate place id: ${p.id}`);
          ids.add(p.id);
        }
        if (typeof p?.x !== 'number' || typeof p?.y !== 'number') {
          warnings.push(`place ${p?.id || i}: x/y should be numbers`);
        }
      });

      route.stories.forEach(st => {
        (st.places || st.place_ids || []).forEach(pid => {
          if (!ids.has(pid)) errors.push(`story ${st.id}: unknown place ${pid}`);
        });
      });

      return {
        ok: errors.length === 0,
        errors,
        warnings,
        stats: {
          places: route.places.length,
          stages: route.stages.length,
          stories: route.stories.length
        }
      };
    },

    getPlaceById(route, placeId) {
      return (route.places || []).find(p => p.id === placeId);
    },

    getStageForPlace(route, place) {
      const st = route.stages || [];
      return place && typeof place.stage === 'number' ? st[place.stage] || null : null;
    }
  };

  // === RENDER LAYER ===
  const MapRender = {
    createMap(container, routeData, opts = {}) {
      const W = 1900, H = 1430;
      const route = routeData;

      container.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.background = '#070a10';
      container.appendChild(svg);

      // Background
      if (opts.baseGeoUrl) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', opts.baseGeoUrl);
        img.setAttribute('width', W);
        img.setAttribute('height', H);
        img.setAttribute('opacity', '0.32');
        svg.appendChild(img);
      }

      // Edges
      const edgesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      svg.appendChild(edgesG);

      // Nodes
      const nodesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      svg.appendChild(nodesG);

      const nodeEls = {};

      (route.places || []).forEach(place => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'node');
        g.setAttribute('data-id', place.id);

        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('cx', place.x); halo.setAttribute('cy', place.y);
        halo.setAttribute('r', (place.r || 14) + 12);
        halo.setAttribute('class', 'halo');
        halo.setAttribute('fill', 'none');
        halo.setAttribute('stroke', '#e8c879');
        halo.setAttribute('stroke-width', '1.6');
        halo.setAttribute('opacity', '0');

        const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        core.setAttribute('cx', place.x); core.setAttribute('cy', place.y);
        core.setAttribute('r', place.r || 11);
        core.setAttribute('class', 'core');
        core.setAttribute('fill', '#e8c879');

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', place.x);
        label.setAttribute('y', place.y + 26);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'mk-label');
        label.textContent = place.name;

        g.appendChild(halo);
        g.appendChild(core);
        g.appendChild(label);
        nodesG.appendChild(g);

        nodeEls[place.id] = { g, halo, core, label };

        g.addEventListener('click', () => {
          if (opts.onPlaceOpen) opts.onPlaceOpen(place);
        });
      });

      // Viewport
      let view = { x: W/2, y: H/2, k: 1 };

      function applyView() {
        const t = `translate(${view.x} ${view.y}) scale(${view.k}) translate(${-W/2} ${-H/2})`;
        nodesG.setAttribute('transform', t);
        edgesG.setAttribute('transform', t);
      }

      // Zoom
      svg.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * W;
        const my = (e.clientY - rect.top) / rect.height * H;

        const factor = e.deltaY < 0 ? 1.2 : 0.82;
        const newK = Math.max(0.18, Math.min(1.8, view.k * factor));

        const dx = (mx - view.x) * (1 - newK / view.k);
        const dy = (my - view.y) * (1 - newK / view.k);

        view.k = newK;
        view.x += dx;
        view.y += dy;
        applyView();
      });

      // Pan
      let dragging = false, lx = 0, ly = 0;
      svg.addEventListener('pointerdown', e => {
        dragging = true; lx = e.clientX; ly = e.clientY;
      });
      svg.addEventListener('pointermove', e => {
        if (!dragging) return;
        const dx = (e.clientX - lx) / view.k;
        const dy = (e.clientY - ly) / view.k;
        view.x += dx; view.y += dy;
        lx = e.clientX; ly = e.clientY;
        applyView();
      });
      svg.addEventListener('pointerup', () => dragging = false);

      applyView();

      // Public API
      return {
        flyTo(cx, cy, zoom = view.k, dur = 380) {
          const sx = view.x, sy = view.y, sk = view.k;
          const ex = W/2 - cx * zoom, ey = H/2 - cy * zoom, ek = zoom;
          const t0 = performance.now();
          function step(t) {
            const p = Math.min(1, (t - t0) / dur);
            const e = 1 - Math.pow(1 - p, 3);
            view.x = sx + (ex - sx) * e;
            view.y = sy + (ey - sy) * e;
            view.k = sk + (ek - sk) * e;
            applyView();
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        },

        resetView() {
          view = { x: W/2, y: H/2, k: 1 };
          applyView();
        },

        setStory(storyId) {
          Object.keys(nodeEls).forEach(pid => {
            const el = nodeEls[pid];
            const p = route.places.find(x => x.id === pid);
            const visible = !storyId || (p && p.story === storyId);
            el.g.style.opacity = visible ? '1' : '0.22';
          });
        },

        destroy() {
          container.innerHTML = '';
        }
      };
    }
  };

  return {
    MapData,
    MapRender,
    createMap: MapRender.createMap,
    loadRoute: MapData.loadRoute,
    validateRoute: MapData.validateRoute
  };

})();
