/**
 * map-engine.js v0.5.2 — reusable biblical map rendering engine (modularized).
 *
 * PUBLIC API:
 *   // Data layer (v0.2):
 *   MapEngine.loadRoute(url) -> Promise<NormalizedRoute>
 *   MapEngine.validateRoute(route) -> {ok, errors, warnings, stats}
 *   MapEngine.compareRouteData(a, b) -> {ok, errors, warnings}
 *   MapEngine.normalizeRouteData(data) -> NormalizedRoute
 *   MapEngine.collectPhotoHosts(route) -> string[]
 *
 *   // Rendering layer (v0.3 — NEW):
 *   MapEngine.createMap(container, routeData, opts) -> MapInstance
 *
 *   MapInstance:
 *     .openPlace(id)           — open detail panel for a place
 *     .closePanel()            — close detail panel
 *     .setStory(storyId)       — filter places by story
 *     .startTour() / .stopTour() — auto-advance through stages
 *     .flyTo(cx, cy, zoom)     — animate viewport
 *     .destroy()               — cleanup
 *
 * DESIGN:
 *   - Self-contained: creates all DOM elements internally
 *   - Styleable via CSS custom properties and class names
 *   - No framework dependency
 *   - Works with any route.json conforming to route.schema.json
 */
'use strict';

const MapEngine = (function() {
  const DEFAULTS = { W0: 1900, H0: 1430, minW: 300, maxW: 2600, padX: 450, padY: 380, tourDelay: 2500 };
  const EASE = { outCubic: p => 1 - Math.pow(1 - p, 3) };
  const STAGE_COLORS = ['#e8c879','#e0813f','#4a9e6e','#cf5b6b','#8b6b4a','#4a80b4'];
  const TAB_LABELS = {story:'Сюжет',bible:'Писание',arch:'Археология',he:'Иврит',dispute:'Дискуссия',photos:'Фото',extra:'Библ.контекст'};
  const TAB_KEYS = ['story','bible','arch','he','dispute','photos','extra'];

  function clamp(n,a,b){return Math.min(Math.max(n,a),b)}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

  // ── v0.2 DATA LAYER (preserved) ──

  function normalizeRouteData(data={}){
    const places=Array.isArray(data.places)?data.places:(data.places_index||[]);
    const stages=Array.isArray(data.stages)?data.stages:(data.stages_index||[]);
    const ctx=Array.isArray(data.ctx)?data.ctx:(data.ctx_index||[]);
    const stories=Array.isArray(data.stories)?data.stories:[];
    return {...data,places,stages,ctx,stories};
  }

  async function loadRoute(url,opts={}){
    const res=await fetch(url,{credentials:opts.credentials||'same-origin',headers:{Accept:'application/json',...(opts.headers||{})}});
    if(!res.ok)throw new Error(`MapEngine.loadRoute: ${res.status} ${url}`);
    return normalizeRouteData(await res.json());
  }

  function validateRoute(data={}){
    const route=normalizeRouteData(data),errors=[],warnings=[],ids=new Set();
    route.places.forEach((p,i)=>{
      if(!p||!p.id)errors.push(`places[${i}] has no id`);
      if(p&&p.id){if(ids.has(p.id))errors.push(`duplicate place id: ${p.id}`);ids.add(p.id);}
      if(typeof p?.x!=='number'||typeof p?.y!=='number')warnings.push(`place ${p?.id||i}: x/y should be numbers`);
    });
    route.stories.forEach(st=>{
      (st.places||st.place_ids||[]).forEach(pid=>{if(!ids.has(pid))errors.push(`story ${st.id}: unknown place ${pid}`);});
      (st.stages||st.stage_ids||[]).forEach(si=>{if(si<0||si>=route.stages.length)errors.push(`story ${st.id}: unknown stage ${si}`);});
    });
    const metaStats=route.meta?.stats||{};
    if(metaStats.places&&metaStats.places!==route.places.length)warnings.push(`meta.stats.places mismatch`);
    if(metaStats.stages&&metaStats.stages!==route.stages.length)warnings.push(`meta.stats.stages mismatch`);
    return {ok:errors.length===0,errors,warnings,stats:{places:route.places.length,stages:route.stages.length,stories:route.stories.length,ctx:route.ctx.length}};
  }

  function compareRouteData(left={},right={}){
    const a=normalizeRouteData(left),b=normalizeRouteData(right),errors=[],warnings=[];
    const idsA=a.places.map(p=>p.id),idsB=b.places.map(p=>p.id);
    if(JSON.stringify(idsA)!==JSON.stringify(idsB))errors.push(`place id drift`);
    if(a.stages.length!==b.stages.length)errors.push(`stage count drift`);
    if(a.stories.length!==b.stories.length)errors.push(`story count drift`);
    a.places.forEach(pA=>{
      const pB=b.places.find(p=>p.id===pA.id);
      if(pB&&(pA.x!==pB.x||pA.y!==pB.y))errors.push(`place coord drift: ${pA.id}`);
    });
    return {ok:errors.length===0,errors,warnings,stats:{places:idsA.length,stages:a.stages.length,stories:a.stories.length}};
  }

  function collectPhotoHosts(route={}){
    const data=normalizeRouteData(route),hosts=new Set();
    data.places.forEach(p=>(p.photos||[]).forEach(ph=>{
      for(const key of['src','thumb']){if(!ph[key]||!/^https?:\/\//.test(ph[key]))continue;try{hosts.add(new URL(ph[key]).origin)}catch(_){}}
    }));
    return [...hosts].sort();
  }

  // Panel model helpers
  function getPlaceIndex(route,placeId){return (route.places||[]).findIndex(p=>p.id===placeId)}
  function getPlaceById(route,placeId){return (route.places||[]).find(p=>p.id===placeId)}
  function getStageForPlace(route,place){const st=route.stages||[];return place&&typeof place.stage==='number'?st[place.stage]||null:null}
  function getRelatedPlaceIds(route,placeId){
    const related=[];
    for(const p of(route.places||[])){if(p.related&&p.related.includes(placeId))related.push(p.id)}
    return related;
  }
  function getTabContentKey(place,tab){return place&&place[tab]?tab:null}

  function getPanelModel(route,placeId){
    const idx=getPlaceIndex(route,placeId);
    const place=idx>=0?route.places[idx]:null;
    return {index:idx,place,stage:getStageForPlace(route,place),relatedIds:place?getRelatedPlaceIds(route,place.id):[],photoCount:Array.isArray(place?.photos)?place.photos.length:0};
  }

  function getPanelSections(route,placeId,tab,relatedMap){
    const model=getPanelModel(route,placeId),place=model.place;
    return {
      hasStory:!!(place&&place.story),hasBible:!!(place&&place.bible),hasArch:!!(place&&place.arch),
      hasHe:!!(place&&place.he_deep),hasDispute:!!(place&&place.dispute),hasPhotos:!!(place&&Array.isArray(place.photos)&&place.photos.length),
      hasExtra:!!(place&&place.bible_extra),hasRelated:model.relatedIds.length>0,contentKey:place&&place[tab]?tab:null
    };
  }

  function getStoryState(route,storyId){
    const story=(route.stories||[]).find(s=>s.id===storyId);
    return story?{story,placeIds:story.places||story.place_ids||null,stageIds:story.stages||story.stage_ids||null}:null;
  }

  function getPlaceOrder(route,storyId,includeCandidates=true){
    const state=getStoryState(route,storyId);
    const places=route.places||[];
    let filtered=places;
    if(state&&state.placeIds){const ids=new Set(state.placeIds);filtered=places.filter(p=>ids.has(p.id))}
    if(!includeCandidates)filtered=filtered.filter(p=>p.type!=='cand');
    return {ids:filtered.map(p=>p.id),indexes:filtered.map(p=>places.indexOf(p)),includeCandidates,storyId,count:filtered.length};
  }

  function auditStoryDefinitions(route){
    const errors=[];
    (route.stories||[]).forEach(st=>{
      const ids=st.places||st.place_ids||[];
      ids.forEach(id=>{if(!(route.places||[]).find(p=>p.id===id))errors.push(`story ${st.id}: place ${id} not found`)});
    });
    return {ok:errors.length===0,errors};
  }

  // ── v0.3 RENDERING LAYER ──

  function createMap(container, routeData, opts={}) {
    const route = normalizeRouteData(routeData);
    const cfg = {...DEFAULTS, ...opts};
    
    // State
    let activePlaceId = null;
    let activeStoryId = (route.stories||[]).find(s=>s.active_by_default)?.id || ((route.stories||[])[0]?.id) || 'main';
    let touring = false;
    let tourStepIdx = 0;
    let rafId = null;
    let dragState = null;
    let view = {x:0, y:0, w:cfg.W0, h:cfg.H0};
    const initVp = route.meta?.viewport_init || {cx:cfg.W0/2, cy:cfg.H0/2, w:cfg.W0};
    view = {x:initVp.cx-initVp.w/2, y:initVp.cy-(initVp.w*cfg.H0/cfg.W0)/2, w:initVp.w, h:initVp.w*cfg.H0/cfg.W0};
    if(view.w<cfg.minW)view.w=cfg.minW;
    if(view.w>cfg.maxW)view.w=cfg.maxW;

    // ── DOM construction ──

    // Inject base CSS
    if(!document.getElementById('me-base-css')){
      const css=document.createElement('style');
      css.id='me-base-css';
      css.textContent=`
.me-map{position:relative;width:100%;height:100%;overflow:hidden;background:#070a10;user-select:none;font-family:Georgia,'Times New Roman',serif}
.me-map *{box-sizing:border-box}
.me-canvas{position:absolute;inset:0;cursor:grab}
.me-canvas:active{cursor:grabbing}
.me-canvas svg{width:100%;height:100%;display:block}
.me-header{position:absolute;top:0;left:0;right:0;padding:12px 16px;z-index:10;pointer-events:none;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap}
.me-header>*{pointer-events:auto}
.me-back{display:inline-flex;align-items:center;gap:6px;color:#9aa2ae;font-size:10px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);transition:color .2s}
.me-back:hover{color:#e8c879}
.me-title{color:#fff;font-size:22px;line-height:1.2;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.me-title-he{color:#e8c879;font-size:15px;letter-spacing:.2em;margin-top:2px;direction:rtl;text-shadow:0 2px 6px rgba(0,0,0,.5)}
.me-subtitle{color:#9aa2ae;font-size:11px;margin-top:2px}
.me-stories{display:flex;gap:6px;flex-wrap:wrap}
.me-story-chip{padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:11px;cursor:pointer;backdrop-filter:blur(8px);transition:all .2s;font-family:inherit;white-space:nowrap}
.me-story-chip:hover{border-color:rgba(255,255,255,.3);color:#e9e4d6}
.me-story-chip--active{background:rgba(232,200,121,.2);color:#e8c879;border-color:rgba(232,200,121,.4)}
.me-stages{position:absolute;bottom:8px;right:8px;z-index:10;display:flex;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px)}
.me-stage-dot{display:flex;align-items:center;gap:4px;font-size:10px;color:#9aa2ae;white-space:nowrap}
.me-stage-dot::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.me-panel{position:absolute;bottom:0;left:0;right:0;background:rgba(13,17,26,.95);backdrop-filter:blur(16px);border-top:1px solid rgba(232,200,121,.2);z-index:20;transition:transform .35s ease;transform:translateY(105%);display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.4)}
.me-panel--open{transform:translateY(0)}
.me-panel__close{position:absolute;top:10px;right:12px;z-index:5;background:none;border:none;font-size:20px;color:#9aa2ae;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1}
.me-panel__close:hover{color:#fff;background:rgba(255,255,255,.05)}
.me-panel__head{padding:14px 16px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
.me-panel__stage{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#e8c879;margin-bottom:4px}
.me-panel__name{font-size:20px;color:#fff;font-weight:700;margin-bottom:2px;padding-right:32px}
.me-panel__he{font-size:14px;color:#e8c879;margin-bottom:4px;direction:rtl}
.me-panel__kick{font-size:12px;color:#9aa2ae;font-weight:700}
.me-panel__meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.me-panel__meta span{font-size:9px;color:#9aa2ae;padding:2px 8px;border:1px solid rgba(255,255,255,.08);border-radius:4px}
.me-tabs{display:flex;gap:2px;padding:4px 12px 0;border-bottom:1px solid rgba(255,255,255,.05);overflow-x:auto}
.me-tab{padding:6px 12px;font-size:11px;border:none;background:none;color:#9aa2ae;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-family:inherit;white-space:nowrap}
.me-tab:hover{color:#e9e4d6}
.me-tab--active{color:#e8c879;border-bottom-color:#e8c879}
.me-content{padding:12px 16px;overflow-y:auto;flex:1;font-size:13px;line-height:1.65;color:#9aa2ae}
.me-content p{margin-bottom:8px;color:#e9e4d6}
.me-content .verse{font-style:italic;border-left:2px solid rgba(232,200,121,.5);padding-left:10px;margin:10px 0;color:#9aa2ae;font-size:12px}
.me-content .verse span{display:block;font-size:9px;color:#e8c879;margin-top:4px}
.me-content .note{background:rgba(255,255,255,.04);padding:10px 12px;border-radius:8px;font-size:11px;margin:8px 0}
.me-content .he-block{background:rgba(255,255,255,.04);padding:12px;border-radius:8px;margin:8px 0}
.me-content .hw{color:#e8c879;font-size:18px}
.me-content .he-tr{color:#9aa2ae;font-size:11px;margin-left:8px}
.me-content .he-etym{font-size:11px;margin-top:4px;color:#e9e4d6}
.me-content .he-refs{font-size:9px;color:rgba(154,162,174,.6);margin-top:4px}
.me-content .dispute-block{background:rgba(255,255,255,.04);padding:12px;border-radius:8px;margin:8px 0}
.me-content .dispute-title{font-weight:700;color:#e8c879;margin-bottom:6px}
.me-content .dispute-pos{padding-left:8px;margin:4px 0;border-left:2px solid rgba(255,255,255,.1)}
.me-content .dispute-note{font-size:10px;color:rgba(154,162,174,.6);font-style:italic;margin-top:6px}
.me-content .conf-hi{color:#4ade80;font-size:9px}
.me-content .conf-med{color:#facc15;font-size:9px}
.me-content .conf-lo{color:#f87171;font-size:9px}
.me-content .bib-note{background:rgba(255,255,255,.04);padding:10px 12px;border-radius:8px;font-size:11px;margin:8px 0}
.me-content .bib-note b{color:#e8c879}
.me-content img{max-width:100%;border-radius:6px;margin:6px 0}
.me-photo-label{font-size:9px;color:rgba(154,162,174,.5);margin-top:2px}
.me-nav{display:flex;align-items:center;padding:10px 16px;border-top:1px solid rgba(255,255,255,.08);gap:8px}
.me-nav button{flex:0;padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#9aa2ae;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
.me-nav button:hover:not(:disabled){border-color:#e8c879;color:#e8c879}
.me-nav button:disabled{opacity:.3;cursor:default}
.me-nav__dots{flex:1;display:flex;justify-content:center;gap:4px}
.me-nav__dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);transition:all .2s}
.me-nav__dot--active{background:#e8c879;transform:scale(1.4)}
.me-marker-pulse{animation:mePulse 2s ease-in-out infinite}
@keyframes mePulse{0%,100%{r:5;opacity:1}50%{r:8;opacity:.6}}
.me-panel__backdrop{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:19;opacity:0;pointer-events:none;transition:opacity .3s}
.me-panel__backdrop--active{opacity:1;pointer-events:auto}


.me-zoom{position:absolute;top:50%;right:8px;transform:translateY(-50%);z-index:10;display:flex;flex-direction:column;gap:4px}
.me-zoom-btn{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.6);color:#9aa2ae;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s;font-family:inherit;line-height:1}
.me-zoom-btn:hover{color:#e8c879;border-color:rgba(232,200,121,.4);background:rgba(0,0,0,.8)}
.me-nav__counter{font-size:10px;color:#9aa2ae;min-width:50px;text-align:center}
.me-tour-progress{position:absolute;top:0;left:0;right:0;height:2px;z-index:30;display:none}
.me-tour-progress__fill{height:100%;background:linear-gradient(90deg,#e8c879,#e0813f);transition:width .3s ease;width:0%}
.me-share-btn{position:absolute;top:10px;right:10px;z-index:15;width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s}
.me-share-btn:hover{color:#e8c879;border-color:rgba(232,200,121,.3)}
.me-legend{position:absolute;bottom:40px;left:8px;z-index:10;padding:8px 12px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);font-size:10px;display:none;cursor:pointer;max-width:180px;transition:all .2s}
.me-legend__title{color:#e8c879;font-weight:700;margin-bottom:4px;font-size:9px;letter-spacing:.08em;text-transform:uppercase}
.me-legend__item{display:flex;align-items:center;gap:6px;color:#9aa2ae;margin:2px 0}
.me-legend__dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.me-panel--open{transform:translateY(0)}
.me-panel__stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
@media(min-width:640px){.me-legend{display:block}}
.me-search{position:absolute;top:8px;right:48px;z-index:15;width:160px;padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#e9e4d6;font-size:11px;font-family:inherit;backdrop-filter:blur(8px);outline:none;transition:border-color .2s}
.me-search:focus{border-color:rgba(232,200,121,.4);width:200px}
.me-search::placeholder{color:rgba(154,162,174,.5)}
.me-loading{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(7,10,16,.9);transition:opacity .3s;gap:12px}
.me-loading__spinner{width:24px;height:24px;border:2px solid rgba(255,255,255,.1);border-top-color:#e8c879;border-radius:50%;animation:meSpin .8s linear infinite}
@keyframes meSpin{to{transform:rotate(360deg)}}
.me-loading__text{color:#9aa2ae;font-size:11px}

.me-panel--open{transform:translateY(0)}
.me-panel__stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
@media(min-width:640px){
  .me-title{font-size:28px}
  .me-panel{left:12px;right:auto;bottom:12px;width:420px;border-radius:14px;border:1px solid rgba(232,200,121,.2);transform:translateX(-120%)}
  .me-panel--open{transform:translateX(0)}
  .me-header{padding:16px 20px}
}
      `;
      document.head.appendChild(css);
    }

    // Build DOM
    container.innerHTML='';
    container.className='me-map';
    
    const canvas=document.createElement('div');canvas.className='me-canvas';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    
    // SVG layers
    const bgRect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    bgRect.setAttribute('x','-400');bgRect.setAttribute('y','-400');bgRect.setAttribute('width','2700');bgRect.setAttribute('height','2230');
    bgRect.setAttribute('fill','#0d1d2e');bgRect.setAttribute('opacity','0.4');
    svg.appendChild(bgRect);
    
    const pathsG=document.createElementNS('http://www.w3.org/2000/svg','g');pathsG.id='me-paths';svg.appendChild(pathsG);
    const waypointsG=document.createElementNS('http://www.w3.org/2000/svg','g');waypointsG.id='me-waypoints';svg.appendChild(waypointsG);
    const markersG=document.createElementNS('http://www.w3.org/2000/svg','g');markersG.id='me-markers';svg.appendChild(markersG);
    canvas.appendChild(svg);
    container.appendChild(canvas);

    // Header
    const header=document.createElement('div');header.className='me-header';
    const headerLeft=document.createElement('div');
    const backLink=document.createElement('a');backLink.className='me-back';backLink.href=opts.backUrl||'/karty/';backLink.textContent='← Карты';
    const titleEl=document.createElement('div');titleEl.className='me-title';titleEl.textContent=route.meta?.title||'';
    headerLeft.appendChild(backLink);headerLeft.appendChild(titleEl);
    if(route.meta?.title_he){const he=document.createElement('div');he.className='me-title-he';he.textContent=route.meta.title_he;headerLeft.appendChild(he)}
    if(route.meta?.subtitle){const sub=document.createElement('div');sub.className='me-subtitle';sub.textContent=route.meta.subtitle;headerLeft.appendChild(sub)}
    header.appendChild(headerLeft);
    
    const storiesBar=document.createElement('div');storiesBar.className='me-stories';
    header.appendChild(storiesBar);
    // Search input
const searchInput=document.createElement('input');searchInput.className='me-search';searchInput.type='text';searchInput.placeholder='Поиск места…';
searchInput.addEventListener('input',()=>{
  const q=searchInput.value.toLowerCase();
  const allG=markersG.querySelectorAll('g[transform]');
  allG.forEach(g=>{
    const text=g.querySelector('text');
    if(text&&text.textContent){
      g.style.opacity=text.textContent.toLowerCase().includes(q)?'1':'.08';
    }
  });
});
header.appendChild(searchInput);
container.appendChild(header);

// Share button
const shareBtn=document.createElement('button');shareBtn.className='me-share-btn';shareBtn.title='Поделиться';shareBtn.textContent='↗';
shareBtn.addEventListener('click',()=>{
  const st=getState();
  const params=new URLSearchParams();
  if(st.place)params.set('place',st.place);
  if(st.story&&st.story!=='main')params.set('story',st.story);
  const url=location.origin+location.pathname+(params.toString()?'?'+params:'');
  if(navigator.share)navigator.share({title:document.title,url}).catch(()=>navigator.clipboard?.writeText(url));
  else navigator.clipboard?.writeText(url).then(()=>{
    shareBtn.textContent='✓';setTimeout(()=>shareBtn.textContent='↗',1500);
  });
});
header.appendChild(shareBtn);

    // Stage dots
    const stagesBar=document.createElement('div');stagesBar.className='me-stages';
    container.appendChild(stagesBar);

    // Zoom controls
    const zoomControls=document.createElement('div');zoomControls.className='me-zoom';
    zoomControls.innerHTML='<button class="me-zoom-btn" data-zoom="in" title="Приблизить">+</button><button class="me-zoom-btn" data-zoom="out" title="Отдалить">−</button><button class="me-zoom-btn" data-zoom="reset" title="Сбросить">⌂</button>';
    container.appendChild(zoomControls);
    zoomControls.querySelector('[data-zoom=in]').addEventListener('click',()=>{
      const cx=view.x+view.w/2,cy=view.y+view.h/2;
      const nw=Math.max(cfg.minW,view.w*0.7);
      flyTo(cx,cy,nw,300);
    });
    zoomControls.querySelector('[data-zoom=out]').addEventListener('click',()=>{
      const cx=view.x+view.w/2,cy=view.y+view.h/2;
      const nw=Math.min(cfg.maxW,view.w*1.4);
      flyTo(cx,cy,nw,300);
    });
    zoomControls.querySelector('[data-zoom=reset]').addEventListener('click',()=>{
      const initVp=route.meta?.viewport_init||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0};
      flyTo(initVp.cx,initVp.cy,initVp.w,500);
    });

    // Panel
    const panel=document.createElement('div');panel.className='me-panel';
    panel.innerHTML='<button class="me-panel__close">×</button><div class="me-tour-progress" id="me-tour-bar"><div class="me-tour-progress__fill"></div></div><div class="me-panel__head"></div><div class="me-tabs"></div><div class="me-content"></div><div class="me-nav"></div>';
    // Legend
const legend=document.createElement('div');legend.className='me-legend';
const legendItems=(route.stages||[]).map((st,i)=>`<div class="me-legend__item"><span class="me-legend__dot" style="background:${STAGE_COLORS[i]}"></span>${st.t||''}</div>`).join('');
legend.innerHTML=`<div class="me-legend__title">Этапы</div>${legendItems}`;
container.appendChild(legend);
container.appendChild(panel);

    // Toggle legend on click
    legend.addEventListener('click', () => {
      legend.classList.toggle('me-legend--expanded');
    });


    // ── State helpers ──
    function visiblePlaces(){
      const story=(route.stories||[]).find(s=>s.id===activeStoryId);
      if(!story||!(story.places||story.place_ids))return route.places||[];
      const ids=new Set(story.places||story.place_ids||[]);
      return (route.places||[]).filter(p=>ids.has(p.id));
    }
    function getActivePlace(){return activePlaceId?(route.places||[]).find(p=>p.id===activePlaceId)||null:null}
    function placeIndexInStory(){
      const v=visiblePlaces();
      return activePlaceId?v.findIndex(p=>p.id===activePlaceId):-1;
    }

    // ── SVG rendering ──
    function applyViewBox(){
      svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
    }

    function renderMarkers(){
      markersG.innerHTML='';
      waypointsG.innerHTML='';
      pathsG.innerHTML='';
      const vis=visiblePlaces();
      const visIds=new Set(vis.map(p=>p.id));
      const allPlaces=route.places||[];

      // Stage paths
      const stagePaths=Array.from({length:(route.stages||[]).length},()=>[]);
      allPlaces.forEach(p=>{if(typeof p.stage==='number')stagePaths[p.stage]=stagePaths[p.stage]||[];stagePaths[p.stage].push(p)});
      stagePaths.forEach((places,i)=>{
        if(places.length<2)return;
        const d=places.map((p,j)=>`${j===0?'M':'L'}${p.x},${p.y}`).join(' ');
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',STAGE_COLORS[i]||STAGE_COLORS[0]);
        path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('opacity','0.5');
        pathsG.appendChild(path);
      });

      // Waypoints
      (route.verified_waypoints||[]).forEach(wp=>{
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform',`translate(${wp.x},${wp.y})`);g.setAttribute('opacity','0.4');
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','3');c.setAttribute('fill','#e8c879');
        g.appendChild(c);
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','8');t.setAttribute('y','3');
        t.setAttribute('fill','#9aa2ae');t.setAttribute('font-size','7');t.textContent=wp.name||'';
        g.appendChild(t);
        waypointsG.appendChild(g);
      });

      // Place markers
      allPlaces.forEach(place=>{
        const inStory=visIds.has(place.id);
        const isActive=place.id===activePlaceId;
        const color=STAGE_COLORS[place.stage]||STAGE_COLORS[0];
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform',`translate(${place.x},${place.y})`);
        g.style.cursor=inStory?'pointer':'default';
        g.style.opacity=inStory?'1':'.15';
        if(inStory)g.addEventListener('click',()=>open(place.id));
        
        const hit=document.createElementNS('http://www.w3.org/2000/svg','circle');hit.setAttribute('r','16');hit.setAttribute('fill','transparent');
        g.appendChild(hit);
        const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
        dot.setAttribute('r',isActive?'8':'5');dot.setAttribute('fill',isActive?'#fff':color);
        dot.setAttribute('stroke',isActive?color:'#0b0f16');dot.setAttribute('stroke-width','2');
        g.appendChild(dot);
        
        const side=place.side||'r';
        const label=document.createElementNS('http://www.w3.org/2000/svg','text');
        label.setAttribute('x',side==='l'?'-14':'14');label.setAttribute('y','4');
        label.setAttribute('text-anchor',side==='l'?'end':'start');
        label.setAttribute('fill',inStory?'#f4eedd':'#555');label.setAttribute('font-size','10');
        label.textContent=place.name||'';
        g.appendChild(label);
        markersG.appendChild(g);
      });
    }

    // ── Panel rendering ──
    function renderPanel(){
      const place=getActivePlace();
      if(!place)return;
      const head=panel.querySelector('.me-panel__head');
      const tabsEl=panel.querySelector('.me-tabs');
      const content=panel.querySelector('.me-content');
      const nav=panel.querySelector('.me-nav');
      const vis=visiblePlaces();
      const idx=placeIndexInStory();
      const stage=route.stages&&place.stage>=0?route.stages[place.stage]:null;

      // Check available tabs
      const availTabs=TAB_KEYS.filter(k=>{
        if(k==='bible')return!!place.bible;
        if(k==='arch')return!!place.arch;
        if(k==='he')return!!place.he_deep;
        if(k==='dispute')return!!place.dispute;
        if(k==='photos')return!!(place.photos&&place.photos.length);
        if(k==='extra')return!!place.bible_extra;
        return k==='story';
      });
      const activeTab=availTabs[0]; // default to first available

      // Head
      head.innerHTML=`
        <div class="me-panel__stage"><span class="me-panel__stage-dot" style="background:${STAGE_COLORS[place.stage]||STAGE_COLORS[0]}"></span>Этап ${(place.stage||0)+1} · ${esc(place.id2||'')}</div>
        <div class="me-panel__name">${esc(place.name)}</div>
        ${place.he?`<div class="me-panel__he">${esc(place.he)}</div>`:''}
        ${place.kick?`<div class="me-panel__kick">${esc(place.kick)}</div>`:''}
        <div class="me-panel__meta">
          ${place.id1?`<span>${esc(place.id1)}</span>`:''}
          ${place.ep1?`<span>${esc(place.ep1)}</span>`:''}
          ${stage?`<span>${esc(stage.t||'')}</span>`:''}
        </div>`;

      // Tabs
      tabsEl.innerHTML=availTabs.map(k=>`<button class="me-tab${k===activeTab?' me-tab--active':''}" data-tab="${k}">${TAB_LABELS[k]||k}</button>`).join('');
      tabsEl.querySelectorAll('.me-tab').forEach(btn=>{
        btn.addEventListener('click',()=>{
          tabsEl.querySelectorAll('.me-tab').forEach(b=>b.classList.remove('me-tab--active'));
          btn.classList.add('me-tab--active');
          renderTabContent(btn.dataset.tab||'story',place);
        });
      });

      // Content
      renderTabContent(activeTab,place);

      // Nav
      const totalInStory=vis.length;
    const counterText=idx>=0?`${idx+1} / ${totalInStory}`:'';
    nav.innerHTML=`
        <button ${idx<=0?'disabled':''} id="me-prev">← ${idx>0?esc(vis[idx-1].name):''}</button>
        <div class="me-nav__dots">${vis.map((p,i)=>`<div class="me-nav__dot${i===idx?' me-nav__dot--active':''}"></div>`).join('')}</div>
        <button ${idx>=vis.length-1?'disabled':''} id="me-next">${idx<vis.length-1?esc(vis[idx+1].name):''} →</button>
      `;
      nav.querySelector('#me-prev')?.addEventListener('click',()=>{if(idx>0)open(vis[idx-1].id)});
      nav.querySelector('#me-next')?.addEventListener('click',()=>{if(idx<vis.length-1)open(vis[idx+1].id)});
    }

    function renderTabContent(tab,place){
      const content=panel.querySelector('.me-content');
      const map={story:place.story,bible:place.bible,arch:place.arch,he:place.he_deep,dispute:place.dispute,extra:place.bible_extra};
      if(tab==='photos'&&place.photos){
        content.innerHTML=place.photos.map(ph=>`
          <div><img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy">
          <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div></div>
        `).join('');
      }else if(map[tab]){
        content.innerHTML=map[tab];
      }else{
        content.innerHTML='';
      }
    }

    // ── Public API ──
    function open(id){
      const place=(route.places||[]).find(p=>p.id===id);
      if(!place)return;
      activePlaceId=id;
      panel.classList.add('me-panel--open');
      updateHash();
      renderMarkers();
      renderPanel();
      // Scroll panel content to top
      const content = panel.querySelector('.me-content');
      if (content) content.scrollTop = 0;
      if(place.x!==undefined&&place.y!==undefined)flyTo(place.x,place.y,Math.min(view.w,800));
    }

    function close(){
      activePlaceId=null;
      panel.classList.remove('me-panel--open');
      updateHash();
      renderMarkers();
    }

    panel.querySelector('.me-panel__close')?.addEventListener('click',close);

    function setStory(storyId){
      const story=(route.stories||[]).find(s=>s.id===storyId);
      if(!story)return;
      activeStoryId=storyId;
      close();
      updateHash();
      renderStories();
      renderMarkers();
      renderStages();
      setTimeout(animateMarkersIn, 150);
      if(story.viewport&&Array.isArray(story.viewport))flyTo(story.viewport[0],story.viewport[1],story.viewport[2]);
    }

    function renderStories(){
      storiesBar.innerHTML=(route.stories||[]).map(s=>`
        <button class="me-story-chip${s.id===activeStoryId?' me-story-chip--active':''}" data-story="${s.id}">${esc(s.label)}</button>
      `).join('');
      storiesBar.querySelectorAll('.me-story-chip').forEach(chip=>{
        chip.addEventListener('click',()=>setStory(chip.dataset.story||'main'));
      });
    }

    function renderStages(){
      stagesBar.innerHTML=(route.stages||[]).map((st,i)=>`
        <div class="me-stage-dot" style="color:${STAGE_COLORS[i]}">${esc(st.n||'')}</div>
      `).join('');
    }

    function flyTo(cx,cy,w,duration=700){
      const from={...view};
      const h=w*cfg.H0/cfg.W0;
      const to={x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};
      cancelAnimationFrame(rafId);
      const t0=performance.now();
      function step(t){
        let p=clamp((t-t0)/Math.max(1,duration),0,1);p=EASE.outCubic(p);
        view.x=from.x+(to.x-from.x)*p;view.y=from.y+(to.y-from.y)*p;
        view.w=from.w+(to.w-from.w)*p;view.h=from.h+(to.h-from.h)*p;
        applyViewBox();
        if(p<1)rafId=requestAnimationFrame(step);
      }
      rafId=requestAnimationFrame(step);
    }

    // ── Pan/Zoom ──
    canvas.addEventListener('pointerdown',e=>{
      if(e.target.closest('button,a,.me-story-chip'))return;
      canvas.setPointerCapture(e.pointerId);
      dragState={sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};
    });
    canvas.addEventListener('pointermove',e=>{
      if(!dragState)return;
      const r=canvas.getBoundingClientRect();
      const sc=r.width/view.w;
      view.x=clamp(dragState.vx-(e.clientX-dragState.sx)/sc,-cfg.padX,cfg.W0+cfg.padX-view.w);
      view.y=clamp(dragState.vy-(e.clientY-dragState.sy)/sc,-cfg.padY,cfg.H0+cfg.padY-view.h);
      applyViewBox();
    });
    canvas.addEventListener('pointerup',()=>{dragState=null});
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      const sc=r.width/view.w;
      const mx=view.x+(e.clientX-r.left)/sc;
      const my=view.y+(e.clientY-r.top)/sc;
      const nw=clamp(view.w*Math.exp(e.deltaY*.0014),cfg.minW,cfg.maxW);
      const k=nw/view.w;
      view.x=clamp(mx-(mx-view.x)*k,-cfg.padX,cfg.W0+cfg.padX-nw);
      view.y=clamp(my-(my-view.y)*k,-cfg.padY,cfg.H0+cfg.padY-nw*cfg.H0/cfg.W0);
      view.w=nw;view.h=nw*cfg.H0/cfg.W0;
      applyViewBox();
    },{passive:false});

    // ── Tour ──
    let tourTimer=null;
    function startTour(){
      touring=true;tourStepIdx=0;close();runTourStep();
    }
    function stopTour(){
      touring=false;clearTimeout(tourTimer);
    const bar=document.getElementById('me-tour-bar');
    if(bar){bar.style.display='none';bar.querySelector('.me-tour-progress__fill').style.width='0%';}
    }
    function runTourStep(){
      if(!touring)return;
      const story=(route.stories||[]).find(s=>s.id===activeStoryId);
      const stageIds=story?.stage_ids||Array.from({length:(route.stages||[]).length},(_,i)=>i);
      if(tourStepIdx>=stageIds.length){stopTour();return;}
      const sid=stageIds[tourStepIdx];
      const place=(route.places||[]).find(p=>p.stage===sid&&visiblePlaces().some(v=>v.id===p.id));
      if(place)open(place.id);
      tourStepIdx++;
      const pct=Math.round((tourStepIdx/stageIds.length)*100);
      const bar=document.getElementById('me-tour-bar');
      if(bar){bar.style.display='block';bar.querySelector('.me-tour-progress__fill').style.width=pct+'%';}
      tourTimer=setTimeout(runTourStep,cfg.tourDelay);
    }

    // ── Keyboard ──
    // Show keyboard shortcut hint
    if (opts.showHints !== false) {
      const hint = document.createElement('div');
      hint.className = 'me-hint';
      hint.style.cssText = 'position:absolute;bottom:60px;left:50%;transform:translateX(-50%);z-index:15;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.7);color:#9aa2ae;font-size:10px;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08);pointer-events:none;opacity:0;transition:opacity .5s';
      hint.textContent = '← → навигация · Esc закрыть · колёсико масштаб';
      container.appendChild(hint);
      setTimeout(() => { hint.style.opacity = '1'; setTimeout(() => { hint.style.opacity = '0'; }, 4000); }, 2000);
    }
    
    // Touch swipe-to-close on mobile
    let touchStartY = 0;
    panel.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, {passive: true});
    panel.addEventListener('touchmove', (e) => {
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 40 && panel.querySelector('.me-content')?.scrollTop <= 5) {
        close();
      }
    }, {passive: true});

    document.addEventListener('keydown',function kh(e){
      if(!container.contains(document.activeElement)&&document.activeElement!==document.body)return;
      if(e.key==='Escape'){close();return}
      if(!activePlaceId)return;
      const vis=visiblePlaces();const idx=placeIndexInStory();
      if(e.key==='ArrowRight'&&idx<vis.length-1)open(vis[idx+1].id);
      if(e.key==='ArrowLeft'&&idx>0)open(vis[idx-1].id);
    });

    // ── Marker entrance animation ──
    function animateMarkersIn() {
      const allMarkers = markersG.querySelectorAll('g[transform]');
      allMarkers.forEach((g, i) => {
        g.style.opacity = '0';
        g.style.transform = g.getAttribute('transform') + ' scale(0.3)';
        g.style.transition = `opacity .4s ${i * 50}ms ease-out, transform .5s ${i * 60}ms cubic-bezier(.34,1.56,.64,1)`;
        requestAnimationFrame(() => {
          g.style.opacity = '1';
          const orig = g.getAttribute('transform');
          g.style.transform = orig;
        });
      });
    }

    // ── Hash-based deep linking ──
    function loadFromHash() {
      const hash = location.hash.replace('#','');
      if (!hash) return;
      const parts = hash.split('&');
      for (const part of parts) {
        const [key, val] = part.split('=');
        if (key === 'story') { activeStoryId = val; }
        if (key === 'place') {
          const p = (route.places||[]).find(pl => pl.id === val);
          if (p) setTimeout(() => open(p.id), 800);
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
    }

    // ── Loading state ──
    const loadingEl=document.createElement('div');loadingEl.className='me-loading';
    loadingEl.innerHTML='<div class="me-loading__spinner"></div><div class="me-loading__text">Загрузка карты…</div>';
    container.appendChild(loadingEl);
    setTimeout(()=>{loadingEl.style.opacity='0';setTimeout(()=>loadingEl.remove(),400);},600);

    // ── Init ──
    applyViewBox();
    renderMarkers();
    
    // Load base-geo.svg if provided
    if (opts.baseGeoUrl) {
      fetch(opts.baseGeoUrl).then(r => r.text()).then(svgText => {
        const parser = new DOMParser();
        const geoDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const geoRoot = geoDoc.querySelector('svg');
        if (geoRoot) {
          // Insert base-geo as first child of SVG (behind paths/markers)
          const baseGeoG = document.createElementNS('http://www.w3.org/2000/svg','g');
          baseGeoG.id = 'me-base-geo';
          baseGeoG.setAttribute('opacity','0.5');
          while (geoRoot.firstChild) baseGeoG.appendChild(geoRoot.firstChild);
          svg.insertBefore(baseGeoG, svg.firstChild);
        }
      }).catch(e => console.warn('Base geo load failed:', e));
    }
    renderStories();
    renderStages();
    const first=(route.places||[])[0];
    if(first)setTimeout(()=>flyTo(first.x,first.y,Math.min(view.w,900)),200);
    loadFromHash();

    // ── Instance ──
    const instance={
      open,close,setStory,startTour,stopTour,flyTo,
      get routeData(){return route},
      destroy(){
        stopTour();cancelAnimationFrame(rafId);
        container.innerHTML='';container.className='';
      }
    };
    return instance;
  }

  // ── Public exports ──
  return {
    // v0.2 data layer
    loadRoute,validateRoute,compareRouteData,normalizeRouteData,collectPhotoHosts,
    getPlaceIndex,getPlaceById,getStageForPlace,getRelatedPlaceIds,getTabContentKey,
    getPanelModel,getPanelSections,getStoryState,getPlaceOrder,auditStoryDefinitions,
    // v0.3 rendering
    createMap,
    version:'0.6.0',buildDate:'2026-06-16'
  };
})();

if(typeof window!=='undefined')window.MapEngine=MapEngine;
if(typeof module!=='undefined')module.exports=MapEngine;
