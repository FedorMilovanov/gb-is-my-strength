/**
 * map-engine.js — движок библейских карт gospod-bog.ru
 * 
 * Публичный API (MAPS-RD-MASTERPLAN §1.3):
 *   MapEngine.init({svgId, routeData, baseGeo, onPlaceOpen, onStageChange, onStoryChange})
 *   engine.flyTo(cx, cy, w, duration)
 *   engine.openPlace(id)
 *   engine.setStory(storyId)
 *   engine.nextPlace() / engine.prevPlace()
 *   engine.startTour() / engine.stopTour()
 *   engine.setZoom(factor)
 *   engine.getState() → {place, story, stage, zoom}
 *   engine.shareURL()
 * 
 * Статус: v0.1 — API skeleton (Sprint 3, 2026-06-13)
 * Следующий шаг: перенести логику из karty/avraam/index.html
 * 
 * Архитектура:
 * - Один движок для всех карт (Авраам, Исход, Павел)
 * - Данные: route.json (PLACES + STAGES + STORIES + CTX)
 * - База: base-geo.svg (общая географическая подложка)
 * - Тема: map.css (цвета и стили конкретной карты)
 * 
 * Правило: НЕ копипастить avraam/index.html для новой карты!
 * Новая карта = route.json + index.html обёртка + map.css
 */

'use strict';

const MapEngine = (function() {
  'use strict';

  // ============================================================
  // INTERNAL STATE
  // ============================================================
  let _svg = null;
  let _view = {x: 0, y: 0, w: 1900, h: 1430};
  let _W0 = 1900, _H0 = 1430;
  let _routeData = null;
  let _curPlace = -1;
  let _curStory = 'main';
  let _curStage = -1;
  let _touring = false;
  let _animId = null;
  let _callbacks = {};

  // ============================================================
  // INIT
  // ============================================================
  function init(options) {
    const {svgId, routeData, onPlaceOpen, onStageChange, onStoryChange} = options;
    
    _svg = document.getElementById(svgId);
    _routeData = routeData;
    _callbacks = {onPlaceOpen, onStageChange, onStoryChange};
    
    if (!_svg) {
      console.warn('MapEngine: SVG element not found:', svgId);
      return null;
    }
    
    // TODO (Sprint 4): загрузить base-geo.svg, построить маркеры из routeData
    // Сейчас используется inline SVG + JS в avraam/index.html
    
    return {
      flyTo, openPlace, setStory, nextPlace, prevPlace,
      startTour, stopTour, setZoom, getState, shareURL
    };
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function flyTo(cx, cy, w, dur = 900) {
    // TODO: перенести из avraam/index.html
    console.log('MapEngine.flyTo', cx, cy, w);
  }

  function openPlace(id) {
    const places = _routeData?.places || [];
    const pl = places.find(p => p.id === id);
    if (!pl) return;
    _curPlace = places.indexOf(pl);
    if (_callbacks.onPlaceOpen) _callbacks.onPlaceOpen(pl);
  }

  function setStory(storyId) {
    const stories = _routeData?.stories || [];
    const st = stories.find(s => s.id === storyId);
    if (!st) return;
    _curStory = storyId;
    if (_callbacks.onStoryChange) _callbacks.onStoryChange(st);
    // Fly to story bbox
    if (st.cam) {
      const [cx, cy, w] = st.cam;
      flyTo(cx, cy, w, 900);
    }
  }

  function nextPlace() {
    const places = _routeData?.places || [];
    if (!places.length) return;
    _curPlace = (_curPlace + 1) % places.length;
    openPlace(places[_curPlace].id);
  }

  function prevPlace() {
    const places = _routeData?.places || [];
    if (!places.length) return;
    _curPlace = (_curPlace - 1 + places.length) % places.length;
    openPlace(places[_curPlace].id);
  }

  // ============================================================
  // TOUR
  // ============================================================
  function startTour() {
    _touring = true;
    _curStage = 0;
    _advanceTour();
  }

  function stopTour() {
    _touring = false;
    clearTimeout(_animId);
  }

  function _advanceTour() {
    if (!_touring) return;
    const stages = _routeData?.stages || [];
    if (_curStage >= stages.length) { stopTour(); return; }
    if (_callbacks.onStageChange) _callbacks.onStageChange(stages[_curStage], _curStage);
    _curStage++;
  }

  // ============================================================
  // ZOOM
  // ============================================================
  function setZoom(factor) {
    const w = Math.min(Math.max(_view.w * factor, 240), 2600);
    _view.w = w;
    _view.h = w * _H0 / _W0;
  }

  // ============================================================
  // STATE & SHARE
  // ============================================================
  function getState() {
    return {
      place: _curPlace >= 0 ? _routeData?.places[_curPlace]?.id : null,
      story: _curStory,
      stage: _curStage,
      zoom: Math.round(_W0 / _view.w * 10) / 10
    };
  }

  function shareURL() {
    const state = getState();
    const params = new URLSearchParams();
    if (state.story && state.story !== 'main') params.set('story', state.story);
    if (state.place) params.set('place', state.place);
    const url = location.origin + location.pathname + (params.toString() ? '?' + params : '');
    navigator.share?.({title: document.title, url}) || navigator.clipboard?.writeText(url);
    return url;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return { init, version: '0.1.0', buildDate: '2026-06-13' };

})();

// Export for module systems
if (typeof module !== 'undefined') module.exports = MapEngine;
