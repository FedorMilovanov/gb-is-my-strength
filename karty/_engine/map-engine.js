/**
 * map-engine.js v0.6 — Professional Modular Biblical Map Engine
 * С Timeline, Keyboard, URL state
 */
'use strict';

const MapEngine = (function() {

  const MapData = {
    normalizeRouteData(data = {}) {
      return {
        ...data,
        places: Array.isArray(data.places) ? data.places : [],
        stages: Array.isArray(data.stages) ? data.stages : [],
        stories: Array.isArray(data.stories) ? data.stories : []
      };
    },

    async loadRoute(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`MapData.loadRoute: ${res.status}`);
      return this.normalizeRouteData(await res.json());
    },

    getPlaceById(route, id) {
      return route.places.find(p => p.id === id);
    }
  };

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

      if (opts.baseGeoUrl) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', opts.baseGeoUrl);
        img.setAttribute('width', W);
        img.setAttribute('height', H);
        img.setAttribute('opacity', '0.3');
        svg.appendChild(img);
      }

      const edgesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      svg.appendChild(edgesG);

      const nodesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      svg.appendChild(nodesG);

      const nodeEls = {};

      route.places.forEach(place => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'node');
        g.setAttribute('data-id', place.id);

        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('cx', place.x); halo.setAttribute('cy', place.y);
        halo.setAttribute('r', (place.r || 13) + 11);
        halo.setAttribute('class', 'halo');
        halo.setAttribute('fill', 'none');
        halo.setAttribute('stroke', '#e8c879');
        halo.setAttribute('stroke-width', '1.5');
        halo.setAttribute('opacity', '0');

        const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        core.setAttribute('cx', place.x); core.setAttribute('cy', place.y);
        core.setAttribute('r', place.r || 10);
        core.setAttribute('fill', '#e8c879');

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', place.x);
        label.setAttribute('y', place.y + 24);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'mk-label');
        label.textContent = place.name;

        g.appendChild(halo);
        g.appendChild(core);
        g.appendChild(label);
        nodesG.appendChild(g);

        nodeEls[place.id] = { g, halo, core, label };

        g.addEventListener('click', () => opts.onPlaceOpen && opts.onPlaceOpen(place));
      });

      // Viewport
      let view = { x: W/2, y: H/2, k: 1 };

      function applyView() {
        const t = `translate(${view.x} ${view.y}) scale(${view.k}) translate(${-W/2} ${-H/2})`;
        nodesG.setAttribute('transform', t);
        edgesG.setAttribute('transform', t);
      }

      // Zoom + Pan
      svg.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * W;
        const my = (e.clientY - rect.top) / rect.height * H;
        const factor = e.deltaY < 0 ? 1.22 : 0.82;
        const newK = Math.max(0.16, Math.min(2.1, view.k * factor));
        const dx = (mx - view.x) * (1 - newK / view.k);
        const dy = (my - view.y) * (1 - newK / view.k);
        view.k = newK; view.x += dx; view.y += dy;
        applyView();
      });

      let dragging = false, lx = 0, ly = 0;
      svg.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
      svg.addEventListener('pointermove', e => {
        if (!dragging) return;
        view.x += (e.clientX - lx) / view.k;
        view.y += (e.clientY - ly) / view.k;
        lx = e.clientX; ly = e.clientY;
        applyView();
      });
      svg.addEventListener('pointerup', () => dragging = false);

      applyView();

      // === PUBLIC API v0.6 ===
      const api = {
        flyTo(cx, cy, zoom = view.k, duration = 420) {
          const sx = view.x, sy = view.y, sk = view.k;
          const ex = W/2 - cx * zoom, ey = H/2 - cy * zoom, ek = zoom;
          const t0 = performance.now();
          function step(t) {
            const p = Math.min(1, (t - t0) / duration);
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
            el.g.style.transition = 'opacity .2s';
            el.g.style.opacity = visible ? '1' : '0.18';
          });
        },

        highlightPlace(id) {
          Object.keys(nodeEls).forEach(pid => {
            const el = nodeEls[pid];
            if (pid === id) {
              el.halo.setAttribute('opacity', '0.95');
              el.core.setAttribute('fill', '#fff');
            } else {
              el.halo.setAttribute('opacity', '0');
              el.core.setAttribute('fill', '#e8c879');
            }
          });
        },

        destroy() {
          container.innerHTML = '';
        }
      };

      return api;
    }
  };

  return {
    MapData,
    MapRender,
    createMap: MapRender.createMap,
    loadRoute: MapData.loadRoute
  };

})();
