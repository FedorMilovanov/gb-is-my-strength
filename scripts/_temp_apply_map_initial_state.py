#!/usr/bin/env python3
from pathlib import Path

path = Path('karty/_engine/map-engine.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
"""  function getStoryState(route,storyId){
    const story=(route.stories||[]).find(s=>s.id===storyId);
    return story?{story,placeIds:story.places||story.place_ids||null,stageIds:story.stages||story.stage_ids||null}:null;
  }

  function getPlaceOrder(route,storyId,includeCandidates=true){""",
"""  function getStoryState(route,storyId){
    const story=(route.stories||[]).find(s=>s.id===storyId);
    return story?{story,placeIds:story.places||story.place_ids||null,stageIds:story.stages||story.stage_ids||null}:null;
  }

  function _defaultStoryId(route){
    return (route.stories||[]).find(s=>s.active_by_default)?.id || (route.stories||[])[0]?.id || 'main';
  }

  function _normalizeMapStateCandidate(route,candidate={},fallbackStoryId){
    const stories=route.stories||[];
    const places=route.places||[];
    const validStory=id=>typeof id==='string'&&stories.some(s=>s.id===id);
    const validPlace=id=>typeof id==='string'&&places.some(p=>p.id===id);
    let story=validStory(candidate.story)?candidate.story:(validStory(fallbackStoryId)?fallbackStoryId:_defaultStoryId(route));
    const place=validPlace(candidate.place)?candidate.place:null;
    if(place){
      const selected=stories.find(s=>s.id===story);
      const selectedIds=new Set(selected?(selected.places||selected.place_ids||places.map(p=>p.id)):places.map(p=>p.id));
      if(!selectedIds.has(place)){
        const containing=stories.find(s=>(s.places||s.place_ids||[]).includes(place));
        if(containing)story=containing.id;
      }
    }
    return {story,place};
  }

  function parseMapStateFromLocation(data={},locationLike={}){
    const route=normalizeRouteData(data);
    const query=new URLSearchParams(String(locationLike.search||'').replace(/^\\?/,''));
    const hash=new URLSearchParams(String(locationLike.hash||'').replace(/^#/,''));
    const queryHas=query.has('story')||query.has('place');
    const hashHas=hash.has('story')||hash.has('place');
    const normalized=_normalizeMapStateCandidate(route,{
      story:query.get('story')||hash.get('story'),
      place:query.get('place')||hash.get('place')
    },_defaultStoryId(route));
    return {...normalized,hasExplicit:queryHas||hashHas,source:queryHas?'query':(hashHas?'hash':'default')};
  }

  function resolveInitialMapState(data={},locationLike={},savedState=null){
    const route=normalizeRouteData(data);
    const explicit=parseMapStateFromLocation(route,locationLike);
    if(explicit.hasExplicit)return {...explicit,viewport:getStoryViewport(route,explicit.story)};
    const saved=savedState&&typeof savedState==='object'?savedState:{};
    const savedStoryValid=typeof saved.story==='string'&&(route.stories||[]).some(s=>s.id===saved.story);
    const savedPlaceValid=typeof saved.place==='string'&&(route.places||[]).some(p=>p.id===saved.place);
    if(savedStoryValid||savedPlaceValid){
      const normalized=_normalizeMapStateCandidate(route,saved,_defaultStoryId(route));
      return {...normalized,hasExplicit:false,source:'saved',viewport:getStoryViewport(route,normalized.story)};
    }
    const normalized=_normalizeMapStateCandidate(route,{},_defaultStoryId(route));
    return {...normalized,hasExplicit:false,source:'default',viewport:getStoryViewport(route,normalized.story)};
  }

  function buildMapStateUrl(locationLike={},state={}){
    const origin=String(locationLike.origin||'');
    const pathname=String(locationLike.pathname||'/');
    const query=new URLSearchParams(String(locationLike.search||'').replace(/^\\?/,''));
    query.delete('story');query.delete('place');
    if(state.story&&state.story!=='main')query.set('story',state.story);
    if(state.place)query.set('place',state.place);
    let hash=String(locationLike.hash||'');
    const hashParams=new URLSearchParams(hash.replace(/^#/,''));
    if(hashParams.has('story')||hashParams.has('place'))hash='';
    const search=query.toString();
    return origin+pathname+(search?'?'+search:'')+hash;
  }

  function getPlaceOrder(route,storyId,includeCandidates=true){""",
'insert initial-state helpers')

replace_once(
"""    // State
    let activePlaceId = null;
    let activeStoryId = (route.stories||[]).find(s=>s.active_by_default)?.id || ((route.stories||[])[0]?.id) || 'main';
    let touring = false;
    let tourStepIdx = 0;
    let rafId = null;
    let dragState = null;
    let tourTimer = null;
    let view = {x:0, y:0, w:cfg.W0, h:cfg.H0};

    function getState() {""",
"""    // State: one deterministic transaction before the first render.
    const stateStorageKey='me-map-state-'+(route.meta?.id||'map');
    let savedInitialState=null;
    try{
      const raw=localStorage.getItem(stateStorageKey);
      if(raw)savedInitialState=JSON.parse(raw);
    }catch(e){}
    const initialState = resolveInitialMapState(route, location, savedInitialState);
    const initialPlaceId = initialState.place;
    let activePlaceId = null;
    let activeStoryId = initialState.story;
    let touring = false;
    let tourStepIdx = 0;
    let rafId = null;
    let dragState = null;
    let tourTimer = null;
    let view = {x:0, y:0, w:cfg.W0, h:cfg.H0};

    function getState() {""",
'initial state precedence')

replace_once(
"""    const initVp = route.meta?.viewport_init || {cx:cfg.W0/2, cy:cfg.H0/2, w:cfg.W0};
    view = {x:initVp.cx-initVp.w/2, y:initVp.cy-(initVp.w*cfg.H0/cfg.W0)/2, w:initVp.w, h:initVp.w*cfg.H0/cfg.W0};
    if(view.w<cfg.minW)view.w=cfg.minW;
    if(view.w>cfg.maxW)view.w=cfg.maxW;""",
"""    const initVp = initialState.viewport || [cfg.W0/2,cfg.H0/2,cfg.W0];
    const initW=clamp(Number(initVp[2])||cfg.W0,cfg.minW,cfg.maxW);
    const initH=initW*cfg.H0/cfg.W0;
    view={
      x:clamp((Number(initVp[0])||cfg.W0/2)-initW/2,-cfg.padX,cfg.W0+cfg.padX-initW),
      y:clamp((Number(initVp[1])||cfg.H0/2)-initH/2,-cfg.padY,cfg.H0+cfg.padY-initH),
      w:initW,h:initH
    };""",
'initial viewport')

replace_once(
"""  const params=new URLSearchParams();
  if(st.place)params.set('place',st.place);
  if(st.story&&st.story!=='main')params.set('story',st.story);
  const url=location.origin+location.pathname+(params.toString()?'?'+params:'');""",
"""  const url=buildMapStateUrl(location,st);""",
'share URL builder')

replace_once(
"""    // ── Hash-based deep linking ──
    function loadFromHash() {
      const hash = location.hash.replace('#','');
      if (!hash) return;
      const parts = hash.split('&');
      for (const part of parts) {
        const [key, val] = part.split('=');
        if (key === 'story') { activeStoryId = val; }
        if (key === 'place') {
          const p = (route.places||[]).find(pl => pl.id === val);
          if (p) _tm(() => open(p.id), 800);
        }
      }
    }
    function updateHash() {
      const parts = [];
      if (activeStoryId && activeStoryId !== 'main') parts.push('story=' + activeStoryId);
      if (activePlaceId) parts.push('place=' + activePlaceId);
      const newHash = parts.length ? '#' + parts.join('&') : '';
      if (location.hash !== newHash) {
        history.replaceState(null, '', location.pathname + (newHash || ''));
      }
    }""",
"""    // ── Canonical query-based deep linking (legacy hash remains readable) ──
    function updateUrl() {
      const next=buildMapStateUrl(location,{story:activeStoryId,place:activePlaceId});
      const current=location.origin+location.pathname+location.search+location.hash;
      if(next!==current)history.replaceState(null,'',next);
    }""",
'unified deep-link updater')

# Three runtime state updates: open, close, setStory.
if text.count('updateHash();') != 3:
    raise SystemExit(f'updateHash call count: expected 3, found {text.count("updateHash();")}')
text = text.replace('updateHash();', 'updateUrl();')

replace_once(
"""      hideCaption();
      updateUrl();
      renderMarkers();""",
"""      hideCaption();
      updateUrl();
      saveState();
      renderMarkers();""",
'persist closed panel state')

replace_once(
"""    renderStories();
    renderStages();
    const first=(route.places||[])[0];
    if(first)_tm(()=>flyTo(first.x,first.y,Math.min(view.w,900)),200);
    loadFromHash();

    // Auto-save last place to localStorage
    function saveState() {
      try {
        const st = { place: activePlaceId, story: activeStoryId };
        localStorage.setItem('me-map-state-' + (route.meta?.id || 'map'), JSON.stringify(st));
      } catch(e) {}
    }
    function loadSavedState() {
      try {
        const saved = localStorage.getItem('me-map-state-' + (route.meta?.id || 'map'));
        if (saved) {
          const st = JSON.parse(saved);
          if (st.story) { activeStoryId = st.story; updateUrl(); }
          if (st.place) {
            const p = (route.places||[]).find(pl => pl.id === st.place);
            if (p) setTimeout(() => open(p.id), 900);
          }
        }
      } catch(e) {}
    }
    // Save on every place open
    const origOpen = open;
    open = function(id) { origOpen(id); saveState(); return (route.places||[]).find(p => p.id === id); };
    // Load saved state after init
    setTimeout(loadSavedState, 1000);""",
"""    renderStories();
    renderStages();

    // Persist the already-resolved state; no delayed reader may override URL intent.
    function saveState() {
      try {
        localStorage.setItem(stateStorageKey,JSON.stringify({place:activePlaceId,story:activeStoryId}));
      } catch(e) {}
    }
    const origOpen = open;
    open = function(id) { origOpen(id); saveState(); return (route.places||[]).find(p => p.id === id); };
    if(initialPlaceId){
      _tm(()=>open(initialPlaceId),200);
    }else if(initialState.source!=='default'){
      updateUrl();
      saveState();
    }""",
'replace competing init readers')

replace_once(
"""    getPanelModel,getPanelSections,getStoryViewport,getStoryState,getPlaceOrder,auditStoryDefinitions,
    // v0.3 rendering""",
"""    getPanelModel,getPanelSections,getStoryViewport,getStoryState,getPlaceOrder,auditStoryDefinitions,
    parseMapStateFromLocation,resolveInitialMapState,buildMapStateUrl,
    // v0.3 rendering""",
'export initial-state helpers')

path.write_text(text,encoding='utf-8')
print('map initial-state transaction applied')
