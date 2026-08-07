#!/usr/bin/env python3
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'karty' / '_engine' / 'map-engine.js'
EXPECTED_OLD = 'eaf85cd58ac8381d7d9b3fe6d9745b8ea89e8496'
EXPECTED_NEW = 'a13f9f900b06f4cd6261524b31d75f91166d730e'


def git_blob_sha(text: str) -> str:
    data = text.encode('utf-8')
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one source block, got {count}')
    return source.replace(old, new, 1)


source = PATH.read_text(encoding='utf-8')
current = git_blob_sha(source)
if current == EXPECTED_NEW:
    print(f'MapEngine already patched: {EXPECTED_NEW}')
    raise SystemExit(0)
if current != EXPECTED_OLD:
    raise SystemExit(f'refusing to patch unexpected MapEngine blob {current}; expected {EXPECTED_OLD}')

patches = [
    ('version header',
     'map-engine.js v0.57 — reusable biblical map rendering engine.',
     'map-engine.js v0.58 — reusable biblical map rendering engine.'),
    ('resize observer state',
     """    const _listeners = [];
    const _timers = [];
    let baseCssLeaseActive = false;
    let cleanupComplete = false;
""",
     """    const _listeners = [];
    const _timers = [];
    let scaleResizeObserver = null;
    let baseCssLeaseActive = false;
    let cleanupComplete = false;
"""),
    ('resize observer cleanup',
     """      cancelAnimationFrame(rafId);
      if (tourTimer) clearTimeout(tourTimer);
      if(baseCssLeaseActive){
""",
     """      cancelAnimationFrame(rafId);
      if (tourTimer) clearTimeout(tourTimer);
      scaleResizeObserver?.disconnect();
      scaleResizeObserver = null;
      if(baseCssLeaseActive){
"""),
    ('search visible ids owner',
     """    const q = searchInput.value.toLowerCase().trim();
    const allG = markersG.querySelectorAll('g[transform]');
    if (!q) {
      const visibleIds = new Set(visiblePlaces().map(p => p.id));
      allG.forEach(g => {
""",
     """    const q = searchInput.value.toLowerCase().trim();
    const allG = markersG.querySelectorAll('g[transform]');
    const visibleIds = new Set(visiblePlaces().map(p => p.id));
    if (!q) {
      allG.forEach(g => {
"""),
    ('search story boundary',
     """    allG.forEach(g => {
      const placeId = g.getAttribute('data-place-id');
      const text = g.querySelector('text');
""",
     """    allG.forEach(g => {
      const placeId = g.getAttribute('data-place-id');
      if (placeId && !visibleIds.has(placeId)) {
        g.style.opacity = '0';
        return;
      }
      const text = g.querySelector('text');
"""),
    ('canonical live region',
     """    const toastEl = document.createElement('div');
    toastEl.className = 'me-toast';
    container.appendChild(toastEl);
""",
     """    const toastEl = document.createElement('div');
    toastEl.className = 'me-toast';
    toastEl.setAttribute('role','status');
    toastEl.setAttribute('aria-live','polite');
    toastEl.setAttribute('aria-atomic','true');
    container.appendChild(toastEl);
"""),
    ('scale geometry and resize',
     """    function updateScaleBar() {
      const pxPerKm = 1 / cfg.kmPerUnit;
      const screenPxPerKm = (cfg.W0 / view.w) * pxPerKm;
      let km = 200;
      while (km * screenPxPerKm > 180 && km > 3) { km /= 2; }
      while (km * screenPxPerKm < 40 && km < 3200) { km *= 2; }
      const barW = Math.round(km * screenPxPerKm);
      const lineEl = document.getElementById('me-scale-line');
      const labelEl = document.getElementById('me-scale-label');
      if (lineEl) lineEl.style.width = barW + 'px';
      if (labelEl) labelEl.textContent = km + ' km';
    }
""",
     """    function updateScaleBar() {
      const pxPerKm = 1 / cfg.kmPerUnit;
      const renderedWidth = canvas.getBoundingClientRect().width;
      if (!(renderedWidth > 0 && view.w > 0)) return;
      const screenPxPerKm = (renderedWidth / view.w) * pxPerKm;
      let km = 200;
      while (km * screenPxPerKm > 180 && km > 3) { km /= 2; }
      while (km * screenPxPerKm < 40 && km < 3200) { km *= 2; }
      const barW = Math.round(km * screenPxPerKm);
      const lineEl = document.getElementById('me-scale-line');
      const labelEl = document.getElementById('me-scale-label');
      if (lineEl) lineEl.style.width = barW + 'px';
      if (labelEl) labelEl.textContent = km + ' km';
    }
    if (typeof ResizeObserver === 'function') {
      scaleResizeObserver = new ResizeObserver(() => updateScaleBar());
      scaleResizeObserver.observe(canvas);
    }
"""),
    ('waypoint screen anchors',
     """      (route.verified_waypoints||[]).forEach(wp=>{
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform',`translate(${wp.x},${wp.y})`);g.setAttribute('data-layer','wp');g.setAttribute('opacity','0.4');
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','3');c.setAttribute('fill','#e8c879');
        g.appendChild(c);
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','8');t.setAttribute('y','3');
        t.setAttribute('fill','#9aa2ae');t.setAttribute('font-size','7');t.textContent=wp.name||'';
        g.appendChild(t);
        waypointsG.appendChild(g);
      });
""",
     """      (route.verified_waypoints||[]).forEach(wp=>{
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform',`translate(${wp.x},${wp.y})`);
        g.setAttribute('data-screen-anchor','waypoint');
        g.setAttribute('data-map-x',String(wp.x));
        g.setAttribute('data-map-y',String(wp.y));
        g.setAttribute('data-layer','wp');
        g.setAttribute('data-layer-all','wp');
        g.setAttribute('opacity','0.9');
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','4');c.setAttribute('fill','#e8c879');
        g.appendChild(c);
        const labelText=wp.name||'';
        const labelWidth=Math.max(30,labelText.length*6.4+8);
        const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
        bg.setAttribute('x','7');bg.setAttribute('y','-9');bg.setAttribute('width',String(labelWidth));bg.setAttribute('height','18');bg.setAttribute('rx','4');
        bg.setAttribute('fill','var(--me-label-bg,rgba(7,10,16,.78))');bg.setAttribute('stroke','var(--me-border,rgba(255,255,255,.12))');bg.setAttribute('stroke-width','.6');
        g.appendChild(bg);
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','11');t.setAttribute('y','4');
        t.setAttribute('fill','var(--me-label-text,#f4eedd)');t.setAttribute('font-size','11');t.textContent=labelText;
        g.appendChild(t);
        waypointsG.appendChild(g);
      });
"""),
    ('single photo metadata',
     """          content.innerHTML = photos.map(ph=>`
            <div><img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy" class="me-clickable-photo" data-src="${esc(ph.src||'')}" data-label="${esc(ph.label||'')}" data-credit="${esc(ph.credit||'')}">
            <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div></div>
          `).join('');
""",
     """          content.innerHTML = photos.map(ph=>`
            <div><img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy" class="me-clickable-photo" data-photo-index="0" data-src="${esc(ph.src||ph.thumb||'')}" data-label="${esc(ph.label||'')}" data-credit="${esc(ph.credit||'')}">
            <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div></div>
          `).join('');
"""),
    ('multi photo metadata',
     """          const photosHtml = photos.map((ph,i) => `
            <div class="me-photo-slide" style="display:${i===0?'block':'none'}">
              <img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy">
              <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div>
            </div>`).join('');
""",
     """          const photosHtml = photos.map((ph,i) => `
            <div class="me-photo-slide" style="display:${i===0?'block':'none'}">
              <img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy" class="me-clickable-photo" data-photo-index="${i}" data-src="${esc(ph.src||ph.thumb||'')}" data-label="${esc(ph.label||'')}" data-credit="${esc(ph.credit||'')}">
              <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div>
            </div>`).join('');
"""),
    ('single notification owner',
     """    // Story toast for richer notification
    function showStoryToast(story) {
      const toastEl2 = document.createElement('div');
      toastEl2.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.9);z-index:26;padding:10px 20px;border-radius:12px;background:rgba(7,10,16,.92);border:1px solid rgba(232,200,121,.3);color:#e8c879;font-size:14px;backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:all .4s cubic-bezier(.34,1.56,.64,1);text-align:center;white-space:nowrap';
      toastEl2.innerHTML = '<div style="font-size:22px;margin-bottom:4px">📖</div>' + esc(story.t || story.label || story.id);
      container.appendChild(toastEl2);
      requestAnimationFrame(() => { toastEl2.style.opacity='1';toastEl2.style.transform='translate(-50%,-50%) scale(1)'; });
      _tm(() => { toastEl2.style.opacity='0';toastEl2.style.transform='translate(-50%,-50%) scale(.9)';_tm(()=>toastEl2.remove(),400); }, 1500);
    }
""",
     """    // Story notifications share the canonical polite status owner.
    function showStoryToast(story) {
      showToast('📖 ' + (story.t || story.label || story.id), 1800);
    }
"""),
    ('story notification call',
     """      renderStages();
      _tm(animateMarkersIn, 150);
      const mobileViewport=matchMedia('(max-width:560px)').matches?route.meta?.mobile_story_viewports?.[storyId]:null;
""",
     """      renderStages();
      _tm(animateMarkersIn, 150);
      showStoryToast(story);
      const mobileViewport=matchMedia('(max-width:560px)').matches?route.meta?.mobile_story_viewports?.[storyId]:null;
"""),
    ('reduced motion flyTo',
     """      const to={x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};
      cancelAnimationFrame(rafId);
      const t0=performance.now();
""",
     """      const to={x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};
      cancelAnimationFrame(rafId);
      const reduceMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reduceMotion||duration<=0){
        view={...to};
        applyViewBox();
        return;
      }
      const t0=performance.now();
"""),
    ('tour stage identity',
     """      if(place)open(place.id);
      showCaption(route.stages&&route.stages[tourStepIdx], tourStepIdx, (route.stages||[]).length);
      // Elastic animation on current stage dot
      const stageDots = stagesBar.querySelectorAll('.me-stage-dot');
      if (stageDots[tourStepIdx]) {
        stageDots[tourStepIdx].style.transition = 'transform .2s cubic-bezier(.34,1.56,.64,1)';
        stageDots[tourStepIdx].style.transform = 'scale(1.4)';
        _tm(() => { stageDots[tourStepIdx].style.transform = 'scale(1)'; }, 300);
      }
""",
     """      if(place)open(place.id);
      showCaption(route.stages?.[sid], tourStepIdx, stageIds);
      // Elastic animation follows authored stage identity, not sequence index.
      const stageDot = stagesBar.querySelector(`.me-stage-dot[data-stage="${sid}"]`);
      if (stageDot) {
        stageDot.style.transition = 'transform .2s cubic-bezier(.34,1.56,.64,1)';
        stageDot.style.transform = 'scale(1.4)';
        _tm(() => { stageDot.style.transform = 'scale(1)'; }, 300);
      }
"""),
    ('photo delegation ownership',
     """    _on(panel,'click',e=>{
      const img=e.target.closest('img');
      if(!img||!panel.contains(img))return;
      const src=img.dataset.src||img.currentSrc||img.src;
      if(!src)return;
      const photoContainer=img.closest('div');
      const label=img.dataset.label||photoContainer?.querySelector('.me-photo-label')?.textContent||'';
      openPhoto(src,label,img.dataset.credit||'');
    });
""",
     """    _on(panel,'click',e=>{
      const img=e.target.closest('img.me-clickable-photo');
      if(!img||!panel.contains(img))return;
      const src=img.dataset.src||img.currentSrc||img.src;
      if(!src)return;
      const photoContainer=img.closest('div');
      const label=img.dataset.label||photoContainer?.querySelector('.me-photo-label')?.textContent||'';
      const activePlace=getActivePlace();
      const parsedIndex=Number.parseInt(img.dataset.photoIndex||'0',10);
      const photoIndex=Number.isInteger(parsedIndex)?parsedIndex:0;
      openPhoto(src,label,img.dataset.credit||'',activePlace,photoIndex);
    });
"""),
    ('tour caption sequence',
     """    function showCaption(stage, idx, total) {
      if (!stage) { captionBar.classList.remove('me-caption--visible'); return; }
      captionBar.style.transform = 'translate(-50%, calc(50% + 10px))';
      captionBar.querySelector('.me-caption__stage').textContent = 'ЭТАП ' + (stage.n || '') + ' · ' + (stage.r || '');
      captionBar.querySelector('.me-caption__title').textContent = stage.t || '';
      captionBar.querySelector('.me-caption__dots').innerHTML = (route.stages||[]).map((_, i) => 
        `<span class="me-caption__dot${i === idx ? ' me-caption__dot--active' : ''}${i < idx ? ' me-caption__dot--past' : ''}"></span>`
      ).join('');
      captionBar.classList.add('me-caption--visible');
      requestAnimationFrame(() => { captionBar.style.transform = 'translate(-50%, 50%)'; });
    }
""",
     """    function showCaption(stage, sequenceIndex, stageIds) {
      if (!stage) { captionBar.classList.remove('me-caption--visible'); return; }
      captionBar.style.transform = 'translate(-50%, calc(50% + 10px))';
      captionBar.querySelector('.me-caption__stage').textContent = 'ЭТАП ' + (stage.n || '') + ' · ' + (stage.r || '');
      captionBar.querySelector('.me-caption__title').textContent = stage.t || '';
      const tourStageIds=Array.isArray(stageIds)?stageIds:[];
      captionBar.querySelector('.me-caption__dots').innerHTML = tourStageIds.map((_, i) =>
        `<span class="me-caption__dot${i === sequenceIndex ? ' me-caption__dot--active' : ''}${i < sequenceIndex ? ' me-caption__dot--past' : ''}"></span>`
      ).join('');
      captionBar.classList.add('me-caption--visible');
      requestAnimationFrame(() => { captionBar.style.transform = 'translate(-50%, 50%)'; });
    }
"""),
    ('loading opt-in',
     """    // ── Loading state ──
    const loadingEl=document.createElement('div');loadingEl.className='me-loading';
    const placeCount = (route.places||[]).length;
    loadingEl.innerHTML='<div class="me-loading__spinner"></div><div class="me-loading__text">Загрузка карты…</div><div style="font-size:10px;color:rgba(154,162,174,.4);margin-top:4px">'+placeCount+' мест · '+(route.stages||[]).length+' этапов</div>';
    container.appendChild(loadingEl);
    _tm(()=>{loadingEl.style.opacity='0';_tm(()=>loadingEl.remove(),400);},600);
""",
     """    // ── Loading state ──
    // createMap receives ready route data; a blocking overlay is therefore an
    // explicit opt-in for wrappers that genuinely still have pending work.
    if (opts.showLoading === true) {
      const loadingEl=document.createElement('div');loadingEl.className='me-loading';
      const placeCount = (route.places||[]).length;
      loadingEl.innerHTML='<div class="me-loading__spinner"></div><div class="me-loading__text">Загрузка карты…</div><div style="font-size:10px;color:rgba(154,162,174,.4);margin-top:4px">'+placeCount+' мест · '+(route.stages||[]).length+' этапов</div>';
      container.appendChild(loadingEl);
      _tm(()=>{loadingEl.style.opacity='0';_tm(()=>loadingEl.remove(),400);},600);
    }
"""),
    ('export version', "version:'0.57.0',buildDate:'2026-08-01'", "version:'0.58.0',buildDate:'2026-08-07'"),
]

for label, old, new in patches:
    source = replace_once(source, old, new, label)

result = git_blob_sha(source)
if result != EXPECTED_NEW:
    raise SystemExit(f'patched MapEngine blob {result} does not match expected {EXPECTED_NEW}')
PATH.write_text(source, encoding='utf-8')
print(f'MapEngine patched exactly: {EXPECTED_OLD} -> {EXPECTED_NEW}')
