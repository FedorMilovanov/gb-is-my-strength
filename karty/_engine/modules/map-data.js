/**
 * map-data.js — Data layer for biblical maps (v0.4)
 * Pure data operations, validation, normalization.
 */
'use strict';

const MapData = (function() {

  function normalizeRouteData(data = {}) {
    const places = Array.isArray(data.places) ? data.places : (data.places_index || []);
    const stages = Array.isArray(data.stages) ? data.stages : (data.stages_index || []);
    const ctx = Array.isArray(data.ctx) ? data.ctx : (data.ctx_index || []);
    const stories = Array.isArray(data.stories) ? data.stories : [];
    return { ...data, places, stages, ctx, stories };
  }

  async function loadRoute(url, opts = {}) {
    const res = await fetch(url, {
      credentials: opts.credentials || 'same-origin',
      headers: { Accept: 'application/json', ...(opts.headers || {}) }
    });
    if (!res.ok) throw new Error(`MapData.loadRoute: ${res.status} ${url}`);
    return normalizeRouteData(await res.json());
  }

  function validateRoute(data = {}) {
    const route = normalizeRouteData(data);
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
      (st.stages || st.stage_ids || []).forEach(si => {
        if (si < 0 || si >= route.stages.length) errors.push(`story ${st.id}: unknown stage ${si}`);
      });
    });

    const metaStats = route.meta?.stats || {};
    if (metaStats.places && metaStats.places !== route.places.length) warnings.push(`meta.stats.places mismatch`);
    if (metaStats.stages && metaStats.stages !== route.stages.length) warnings.push(`meta.stats.stages mismatch`);

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      stats: {
        places: route.places.length,
        stages: route.stages.length,
        stories: route.stories.length,
        ctx: route.ctx.length
      }
    };
  }

  function getPlaceById(route, placeId) {
    return (route.places || []).find(p => p.id === placeId);
  }

  function getStageForPlace(route, place) {
    const st = route.stages || [];
    return place && typeof place.stage === 'number' ? st[place.stage] || null : null;
  }

  return {
    normalizeRouteData,
    loadRoute,
    validateRoute,
    getPlaceById,
    getStageForPlace
  };

})();
