/**
 * map-engine.js — общий движок библейских карт gospod-bog.ru
 *
 * Public API (MAPS-RD-MASTERPLAN §1.3):
 *   MapEngine.loadRoute(url) -> Promise<normalizedRoute>
 *   MapEngine.validateRoute(route) -> {ok, errors, warnings, stats}
 *   MapEngine.init({svgId, routeData, onPlaceOpen, onStageChange, onStoryChange})
 *   engine.flyTo(cx, cy, w, duration)
 *   engine.openPlace(id)
 *   engine.setStory(storyId)
 *   engine.nextPlace() / engine.prevPlace()
 *   engine.startTour() / engine.stopTour()
 *   engine.setZoom(factor)
 *   engine.getState() -> {place, story, stage, zoom, view}
 *   engine.shareURL()
 *
 * v0.2 (2026-06-14): реальный reusable core вместо skeleton:
 * - route.json loader + normalizer (places/places_index, stages/stages_index, ctx/ctx_index)
 * - route validator для QA и будущих карт
 * - независимый SVG viewport/flyTo/zoom/pan engine без Leaflet/MapLibre
 * - story-aware next/prev/tour/share state
 *
 * Важно: карта Авраама пока сохраняет legacy inline runtime для визуальной стабильности,
 * но уже подключает этот файл и экспортирует AvraamRouteData для валидации/следующей миграции.
 */

'use strict';

const MapEngine = (function() {
  'use strict';

  const DEFAULTS = {
    W0: 1900,
    H0: 1430,
    minW: 240,
    maxW: 2600,
    padX: 450,
    padY: 380,
    tourDelay: 1600
  };

  const EASE = {
    outCubic: p => 1 - Math.pow(1 - p, 3),
    inOutQuart: p => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2)
  };

  function normalizeRouteData(data = {}) {
    const places = Array.isArray(data.places) ? data.places : (data.places_index || []);
    const stages = Array.isArray(data.stages) ? data.stages : (data.stages_index || []);
    const ctx = Array.isArray(data.ctx) ? data.ctx : (data.ctx_index || []);
    const stories = Array.isArray(data.stories) ? data.stories : [];
    return {...data, places, stages, ctx, stories};
  }

  async function loadRoute(url, opts = {}) {
    const res = await fetch(url, {
      credentials: opts.credentials || 'same-origin',
      headers: {Accept: 'application/json', ...(opts.headers || {})}
    });
    if (!res.ok) throw new Error(`MapEngine.loadRoute: ${res.status} ${res.statusText} (${url})`);
    const json = await res.json();
    return normalizeRouteData(json);
  }

  function validateRoute(data = {}) {
    const route = normalizeRouteData(data);
    const errors = [];
    const warnings = [];
    const ids = new Set();

    route.places.forEach((p, i) => {
      if (!p || !p.id) errors.push(`places[${i}] has no id`);
      if (p && p.id) {
        if (ids.has(p.id)) errors.push(`duplicate place id: ${p.id}`);
        ids.add(p.id);
      }
      if (typeof p?.x !== 'number' || typeof p?.y !== 'number') warnings.push(`place ${p?.id || i}: x/y should be numbers`);
      if (!p?.type) warnings.push(`place ${p?.id || i}: missing type`);
    });

    route.stories.forEach(st => {
      const placeList = st.places || st.place_ids;
      if (Array.isArray(placeList)) {
        placeList.forEach(id => { if (!ids.has(id)) errors.push(`story ${st.id}: unknown place ${id}`); });
      }
      const stageList = st.stages || st.stage_ids;
      if (Array.isArray(stageList)) {
        stageList.forEach(si => { if (si < 0 || si >= route.stages.length) errors.push(`story ${st.id}: unknown stage ${si}`); });
      }
    });

    route.stages.forEach((st, i) => {
      const paths = st.paths || [];
      if (Array.isArray(paths)) {
        paths.forEach((p, j) => { if (!p.d) warnings.push(`stage ${i} path ${j}: missing SVG d`); });
      }
    });

    const waypoints = route.verified_waypoints || route.waypoints || [];
    if (Array.isArray(waypoints)) {
      const wpIds = new Set();
      waypoints.forEach((wp, i) => {
        if (!wp?.id) errors.push(`waypoints[${i}] has no id`);
        if (wp?.id && wpIds.has(wp.id)) errors.push(`duplicate waypoint id: ${wp.id}`);
        if (wp?.id) wpIds.add(wp.id);
        if (typeof wp?.x !== 'number' || typeof wp?.y !== 'number') warnings.push(`waypoint ${wp?.id || i}: x/y should be numbers`);
        if (Number.isInteger(wp?.stage) && (wp.stage < 0 || wp.stage >= route.stages.length)) errors.push(`waypoint ${wp.id}: unknown stage ${wp.stage}`);
      });
    }

    const variants = route.scientific_variants || route.variants || {};
    if (variants && typeof variants === 'object' && !Array.isArray(variants)) {
      Object.entries(variants).forEach(([placeId, rows]) => {
        if (!ids.has(placeId)) errors.push(`scientific_variants: unknown place ${placeId}`);
        if (!Array.isArray(rows)) errors.push(`scientific_variants.${placeId} should be an array`);
        else rows.forEach((row, i) => {
          if (!row?.status) warnings.push(`scientific_variants.${placeId}[${i}]: missing status`);
          if (!row?.title) warnings.push(`scientific_variants.${placeId}[${i}]: missing title`);
        });
      });
    }

    const metaStats = route.meta?.stats || {};
    if (metaStats.places && metaStats.places !== route.places.length) warnings.push(`meta.stats.places=${metaStats.places}, actual=${route.places.length}`);
    if (metaStats.stages && metaStats.stages !== route.stages.length) warnings.push(`meta.stats.stages=${metaStats.stages}, actual=${route.stages.length}`);

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      stats: {
        places: route.places.length,
        stages: route.stages.length,
        stories: route.stories.length,
        ctx: route.ctx.length,
        photos: route.places.reduce((sum, p) => sum + (Array.isArray(p.photos) ? p.photos.length : 0), 0),
        waypoints: Array.isArray(route.verified_waypoints || route.waypoints) ? (route.verified_waypoints || route.waypoints).length : 0,
        scientific_variants: variants && typeof variants === 'object' && !Array.isArray(variants) ? Object.values(variants).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0) : 0
      }
    };
  }

  function clamp(n, a, b) { return Math.min(Math.max(n, a), b); }

  function countScientificVariants(route = {}) {
    const variants = route.scientific_variants || route.variants || {};
    return variants && typeof variants === 'object' && !Array.isArray(variants)
      ? Object.values(variants).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
      : 0;
  }

  function compareRouteData(left = {}, right = {}) {
    const a = normalizeRouteData(left);
    const b = normalizeRouteData(right);
    const errors = [];
    const warnings = [];
    const idsA = a.places.map(p => p.id);
    const idsB = b.places.map(p => p.id);
    if (JSON.stringify(idsA) !== JSON.stringify(idsB)) errors.push(`place id drift: ${idsA.join(',')} != ${idsB.join(',')}`);
    if (a.stages.length !== b.stages.length) errors.push(`stage count drift: ${a.stages.length} != ${b.stages.length}`);
    if (a.ctx.length !== b.ctx.length) warnings.push(`ctx count drift: ${a.ctx.length} != ${b.ctx.length}`);
    if (a.stories.length !== b.stories.length) errors.push(`story count drift: ${a.stories.length} != ${b.stories.length}`);

    const wpA = a.verified_waypoints || a.waypoints || [];
    const wpB = b.verified_waypoints || b.waypoints || [];
    if (Array.isArray(wpA) || Array.isArray(wpB)) {
      const wpIdsA = Array.isArray(wpA) ? wpA.map(w => w.id) : [];
      const wpIdsB = Array.isArray(wpB) ? wpB.map(w => w.id) : [];
      if (JSON.stringify(wpIdsA) !== JSON.stringify(wpIdsB)) errors.push(`waypoint id drift: ${wpIdsA.join(',')} != ${wpIdsB.join(',')}`);
    }

    const varA = countScientificVariants(a);
    const varB = countScientificVariants(b);
    if (varA !== varB) errors.push(`scientific variants count drift: ${varA} != ${varB}`);

    const photosA = a.places.reduce((sum, p) => sum + (Array.isArray(p.photos) ? p.photos.length : 0), 0);
    const photosB = b.places.reduce((sum, p) => sum + (Array.isArray(p.photos) ? p.photos.length : 0), 0);
    if (photosA !== photosB) errors.push(`photo count drift: ${photosA} != ${photosB}`);

    return {ok: errors.length === 0, errors, warnings, stats: {places: idsA.length, stages: a.stages.length, stories: a.stories.length, photos: photosA, waypoints: Array.isArray(wpA) ? wpA.length : 0, scientific_variants: varA}};
  }

  function collectPhotoHosts(route = {}) {
    const data = normalizeRouteData(route);
    const hosts = new Set();
    data.places.forEach(place => (place.photos || []).forEach(photo => {
      for (const key of ['src', 'thumb']) {
        if (!photo[key] || !/^https?:\/\//.test(photo[key])) continue;
        try { hosts.add(new URL(photo[key]).origin); } catch (_) {}
      }
    }));
    return [...hosts].sort();
  }

  function createEngine(options) {
    const cfg = {...DEFAULTS, ...(options || {})};
    const svg = typeof cfg.svgId === 'string' ? document.getElementById(cfg.svgId) : cfg.svg;
    const routeData = normalizeRouteData(cfg.routeData || {});
    const callbacks = {
      onPlaceOpen: cfg.onPlaceOpen,
      onStageChange: cfg.onStageChange,
      onStoryChange: cfg.onStoryChange,
      onViewChange: cfg.onViewChange
    };

    if (!svg) throw new Error(`MapEngine.init: SVG element not found (${cfg.svgId || 'svg'})`);

    const initVp = routeData.meta?.viewport_init || cfg.viewport || {cx: cfg.W0 / 2, cy: cfg.H0 / 2, w: cfg.W0};
    let view = viewFromCenter(initVp.cx ?? cfg.W0 / 2, initVp.cy ?? cfg.H0 / 2, initVp.w ?? cfg.W0);
    let rafId = null;
    let tourTimer = null;
    let drag = null;
    let state = {place: null, story: 'main', stage: -1, touring: false};

    function viewFromCenter(cx, cy, w) {
      const h = w * cfg.H0 / cfg.W0;
      return clampView({x: cx - w / 2, y: cy - h / 2, w, h});
    }

    function clampView(v) {
      v.w = clamp(v.w, cfg.minW, cfg.maxW);
      v.h = v.w * cfg.H0 / cfg.W0;
      v.x = clamp(v.x, -cfg.padX, cfg.W0 + cfg.padX - v.w);
      v.y = clamp(v.y, -cfg.padY, cfg.H0 + cfg.padY - v.h);
      return v;
    }

    function applyView() {
      if (cfg.applyView !== false) svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      callbacks.onViewChange?.({...view});
      return {...view};
    }

    function flyTo(cx, cy, w, duration = 900) {
      if (typeof cfg.flyTo === 'function') return cfg.flyTo(cx, cy, w, duration);
      const from = {...view};
      const to = viewFromCenter(cx, cy, w);
      const t0 = performance.now();
      cancelAnimationFrame(rafId);
      return new Promise(resolve => {
        function step(t) {
          let p = clamp((t - t0) / Math.max(1, duration), 0, 1);
          p = EASE.outCubic(p);
          view = {
            x: from.x + (to.x - from.x) * p,
            y: from.y + (to.y - from.y) * p,
            w: from.w + (to.w - from.w) * p,
            h: from.h + (to.h - from.h) * p
          };
          applyView();
          if (p < 1) rafId = requestAnimationFrame(step);
          else resolve({...view});
        }
        rafId = requestAnimationFrame(step);
      });
    }

    function toSvg(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      const scale = Math.max(r.width / view.w, r.height / view.h);
      const vw = r.width / scale;
      const vh = r.height / scale;
      const ox = view.x + (view.w - vw) / 2;
      const oy = view.y + (view.h - vh) / 2;
      return {x: ox + (clientX - r.left) / scale, y: oy + (clientY - r.top) / scale, scale};
    }

    function bindPanZoom() {
      svg.addEventListener('pointerdown', e => {
        if (e.target.closest?.('.marker,.ctx-dot,#routes')) return;
        svg.setPointerCapture?.(e.pointerId);
        drag = {id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y};
        cancelAnimationFrame(rafId);
      });
      svg.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const r = svg.getBoundingClientRect();
        const scale = Math.max(r.width / view.w, r.height / view.h);
        view = clampView({x: drag.vx - (e.clientX - drag.sx) / scale, y: drag.vy - (e.clientY - drag.sy) / scale, w: view.w, h: view.h});
        applyView();
      });
      ['pointerup', 'pointercancel'].forEach(ev => svg.addEventListener(ev, () => { drag = null; }));
      svg.addEventListener('wheel', e => {
        e.preventDefault();
        const p = toSvg(e.clientX, e.clientY);
        const factor = Math.exp(e.deltaY * 0.0014);
        const w = clamp(view.w * factor, cfg.minW, cfg.maxW);
        const k = w / view.w;
        view = clampView({x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k, w, h: w * cfg.H0 / cfg.W0});
        applyView();
      }, {passive: false});
    }

    function currentStory() {
      return routeData.stories.find(s => s.id === state.story) || routeData.stories.find(s => s.active_by_default) || routeData.stories[0] || null;
    }

    function storyPlaceIds(st = currentStory()) {
      return st ? (st.places || st.place_ids || null) : null;
    }

    function visiblePlaces() {
      const ids = storyPlaceIds();
      if (!ids) return routeData.places;
      const set = new Set(ids);
      return routeData.places.filter(p => set.has(p.id));
    }

    function openPlace(id, opts = {}) {
      const place = routeData.places.find(p => p.id === id);
      if (!place) return null;
      state.place = id;
      callbacks.onPlaceOpen?.(place, {...state});
      if (opts.fly !== false && typeof place.x === 'number' && typeof place.y === 'number') {
        flyTo(place.x, place.y, opts.w || Math.min(view.w, 560), opts.duration || 850);
      }
      return place;
    }

    function setStory(storyId, opts = {}) {
      const story = routeData.stories.find(s => s.id === storyId) || routeData.stories[0];
      if (!story) return null;
      state.story = story.id;
      callbacks.onStoryChange?.(story, {...state});
      const cam = story.cam || story.viewport;
      if (opts.fly !== false && Array.isArray(cam)) flyTo(cam[0], cam[1], cam[2], opts.duration || 900);
      return story;
    }

    function nextPlace() {
      const places = visiblePlaces();
      if (!places.length) return null;
      const i = Math.max(0, places.findIndex(p => p.id === state.place));
      return openPlace(places[(i + 1) % places.length].id);
    }

    function prevPlace() {
      const places = visiblePlaces();
      if (!places.length) return null;
      const i = places.findIndex(p => p.id === state.place);
      return openPlace(places[(i - 1 + places.length) % places.length].id);
    }

    function startTour(opts = {}) {
      stopTour(false);
      state.touring = true;
      state.stage = Number.isInteger(opts.startAt) ? opts.startAt : 0;
      runTourStep(opts);
    }

    function runTourStep(opts) {
      if (!state.touring) return;
      if (state.stage >= routeData.stages.length) { stopTour(); return; }
      const stage = routeData.stages[state.stage];
      callbacks.onStageChange?.(stage, state.stage, {...state});
      const cam = stage.cam;
      if (Array.isArray(cam)) flyTo(cam[0] + cam[2] / 2, cam[1] + (cam[2] * cfg.H0 / cfg.W0) / 2, cam[2], opts.flyDuration || 900);
      tourTimer = setTimeout(() => { state.stage += 1; runTourStep(opts); }, opts.delay || cfg.tourDelay);
    }

    function stopTour(resetStage = true) {
      state.touring = false;
      clearTimeout(tourTimer);
      if (resetStage) state.stage = -1;
    }

    function setZoom(factor, cx = view.x + view.w / 2, cy = view.y + view.h / 2) {
      return flyTo(cx, cy, view.w * factor, 450);
    }

    function getState() {
      return {
        place: state.place,
        story: state.story,
        stage: state.stage,
        touring: state.touring,
        zoom: Math.round(cfg.W0 / view.w * 10) / 10,
        view: {...view}
      };
    }

    function shareURL(extra = {}) {
      const st = {...getState(), ...extra};
      const params = new URLSearchParams(location.search);
      if (st.story && st.story !== 'main') params.set('story', st.story); else params.delete('story');
      if (st.place) params.set('place', st.place); else params.delete('place');
      const url = location.origin + location.pathname + (params.toString() ? '?' + params : '');
      const data = {title: document.title, url};
      if (navigator.share) navigator.share(data).catch(() => navigator.clipboard?.writeText(url));
      else navigator.clipboard?.writeText(url);
      return url;
    }

    function destroy() {
      stopTour();
      cancelAnimationFrame(rafId);
      // DOM listeners intentionally not auto-removed: init is one-shot per page shell.
    }

    applyView();
    if (cfg.bindPanZoom) bindPanZoom();

    return {
      routeData,
      flyTo,
      toSvg,
      openPlace,
      setStory,
      nextPlace,
      prevPlace,
      startTour,
      stopTour,
      setZoom,
      getState,
      shareURL,
      validate: () => validateRoute(routeData),
      destroy
    };
  }

  function init(options) { return createEngine(options || {}); }

  function pathLength(path) {
    try { const n = path.getTotalLength(); return Number.isFinite(n) && n > 0 ? n : 0; }
    catch (_) { return 0; }
  }

  function pointAt(path, t) {
    const len = pathLength(path);
    if (!len) return {x: 0, y: 0};
    return path.getPointAtLength(clamp(t, 0, 1) * len);
  }

  return {
    init,
    loadRoute,
    normalizeRouteData,
    validateRoute,
    compareRouteData,
    collectPhotoHosts,
    pathLength,
    pointAt,
    version: '0.2.0',
    buildDate: '2026-06-14'
  };
})();

if (typeof window !== 'undefined') window.MapEngine = MapEngine;
if (typeof module !== 'undefined') module.exports = MapEngine;
