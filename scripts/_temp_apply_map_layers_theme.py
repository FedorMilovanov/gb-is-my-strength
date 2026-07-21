#!/usr/bin/env python3
from pathlib import Path

path=Path('karty/_engine/map-engine.js')
text=path.read_text(encoding='utf-8')


def replace_once(old,new,label):
    global text
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text=text.replace(old,new,1)

helpers=r'''
  const MAP_THEME_PALETTES=Object.freeze({
    dark:Object.freeze({id:'dark',bg:'#070a10',panelBg:'rgba(13,17,26,.95)',text:'#e9e4d6',muted:'#9aa2ae',accent:'#e8c879',controlBg:'rgba(0,0,0,.55)',border:'rgba(255,255,255,.12)',labelBg:'rgba(7,10,16,.78)',labelText:'#f4eedd',baseFill:'#0d1d2e',baseOpacity:'0.4',svgFilter:'none'}),
    light:Object.freeze({id:'light',bg:'#eee4d1',panelBg:'rgba(250,246,236,.97)',text:'#332b20',muted:'#6c6255',accent:'#986a16',controlBg:'rgba(250,246,236,.88)',border:'rgba(72,55,31,.22)',labelBg:'rgba(250,246,236,.9)',labelText:'#332b20',baseFill:'#d7c7a8',baseOpacity:'0.58',svgFilter:'sepia(.16) saturate(.72) brightness(1.28) contrast(.84)'})
  });

  function getMapThemePalette(theme){return MAP_THEME_PALETTES[theme]||MAP_THEME_PALETTES.dark}

  function normalizeLayerTokens(value){
    const values=Array.isArray(value)?value:[value];
    const out=[];
    const seen=new Set();
    values.forEach(item=>String(item||'').split(/[\s,]+/).forEach(token=>{
      token=token.trim();
      if(token&&!seen.has(token)){seen.add(token);out.push(token)}
    }));
    return out;
  }

  function _layerRefs(layer,a,b){
    const value=layer&&(layer[a]!==undefined?layer[a]:layer[b]);
    return Array.isArray(value)?value:[];
  }

  function getPlaceLayerMembership(data={},place={}){
    const route=normalizeRouteData(data);
    const all=new Set(['main']);
    const any=new Set();
    const stage=Number.isInteger(place.stage)?(route.stages||[])[place.stage]:null;
    if(Number.isInteger(place.stage))all.add('stage-'+place.stage);
    normalizeLayerTokens(stage&&stage.cls).forEach(token=>all.add(token));
    normalizeLayerTokens(place.type).filter(token=>token!=='main').forEach(token=>all.add(token));
    normalizeLayerTokens(place.layers||place.layer).forEach(token=>all.add(token));
    (route.layers||[]).forEach(layer=>{
      const id=String(layer&&layer.id||'').trim();
      if(!id)return;
      if(id==='main')all.add(id);
      const story=(route.stories||[]).find(item=>item&&item.id===id);
      if(story){
        const placeIds=story.places||story.place_ids||[];
        const stageIds=story.stages||story.stage_ids||[];
        if(placeIds.includes(place.id)||(Number.isInteger(place.stage)&&stageIds.includes(place.stage)))any.add(id);
      }
      const placeIds=_layerRefs(layer,'place_ids','places');
      const stageIds=_layerRefs(layer,'stage_ids','stages');
      const types=_layerRefs(layer,'types','place_types');
      if(placeIds.includes(place.id)||(Number.isInteger(place.stage)&&stageIds.includes(place.stage))||(place.type&&types.includes(place.type)))all.add(id);
      if(id===(stage&&stage.cls)||id===place.type)all.add(id);
    });
    any.forEach(token=>all.delete(token));
    return {all:[...all],any:[...any],tokens:[...new Set([...all,...any])]};
  }

  function getStageLayerMembership(data={},stageIndex){
    const route=normalizeRouteData(data);
    const all=new Set(['main','stage-'+stageIndex]);
    const any=new Set();
    const stage=(route.stages||[])[stageIndex]||{};
    normalizeLayerTokens(stage.cls).forEach(token=>all.add(token));
    normalizeLayerTokens(stage.layers||stage.layer).forEach(token=>all.add(token));
    (route.layers||[]).forEach(layer=>{
      const id=String(layer&&layer.id||'').trim();
      if(!id)return;
      if(id==='main')all.add(id);
      const story=(route.stories||[]).find(item=>item&&item.id===id);
      if(story&&((story.stages||story.stage_ids||[]).includes(stageIndex)))any.add(id);
      if(_layerRefs(layer,'stage_ids','stages').includes(stageIndex)||id===stage.cls)all.add(id);
    });
    any.forEach(token=>all.delete(token));
    return {all:[...all],any:[...any],tokens:[...new Set([...all,...any])]};
  }
'''
replace_once(
"""  function getPlaceOrder(route,storyId,includeCandidates=true){""",
helpers+"\n  function getPlaceOrder(route,storyId,includeCandidates=true){",
'insert layer/theme helpers')

replace_once(
"""    function getState() {
      return { place: activePlaceId, story: activeStoryId };
    }
    
    // Cleanup tracking""",
"""    function getState() {
      return { place: activePlaceId, story: activeStoryId };
    }

    const layerDefinitions=[...(opts.layers||route.layers||[])];
    if(route.signature&&route.signature.type)layerDefinitions.push({id:'signature',label:route.signature.label||'Сигнатура',color:'#e8c879',on:true,selector:'#me-signature'});
    const layerState=new Map(layerDefinitions.filter(layer=>layer&&layer.id).map(layer=>[String(layer.id),layer.on!==false]));
    const themeStorageKey='me-map-theme';
    let activeTheme='dark';
    try{activeTheme=localStorage.getItem(themeStorageKey)==='light'?'light':'dark'}catch(e){}
    
    // Cleanup tracking""",
'insert runtime layer/theme state')

replace_once(
""".me-map{position:relative;width:100%;height:100%;overflow:hidden;overscroll-behavior:contain;background:#070a10;user-select:none;font-family:Georgia,'Times New Roman',serif}""",
""".me-map{position:relative;width:100%;height:100%;overflow:hidden;overscroll-behavior:contain;background:var(--me-bg,#070a10);color:var(--me-text,#e9e4d6);user-select:none;font-family:Georgia,'Times New Roman',serif;transition:background .35s ease,color .35s ease}""",
'base theme variables')
replace_once(
""".me-canvas{position:absolute;inset:0;cursor:grab;will-change:transform;touch-action:none}.me-canvas svg{will-change:transform}""",
""".me-canvas{position:absolute;inset:0;cursor:grab;will-change:transform;touch-action:none}.me-canvas svg{will-change:transform;filter:var(--me-svg-filter,none);transition:filter .35s ease}""",
'svg theme filter')

palette_css=r'''
/* Functional map palette — changes actual canvas and key chrome, not only the icon. */
.me-map .me-title,.me-map .me-panel__name,.me-map .me-search{color:var(--me-text,#e9e4d6)}
.me-map .me-subtitle,.me-map .me-panel__kick,.me-map .me-layer__name,.me-map .me-layers__name{color:var(--me-muted,#9aa2ae)}
.me-map .me-title-he,.me-map .me-panel__stage,.me-map .me-panel__he,.me-map .me-theme-btn:hover{color:var(--me-accent,#e8c879)}
.me-map .me-panel{background:var(--me-panel-bg,rgba(13,17,26,.95));border-color:var(--me-border,rgba(255,255,255,.12))}
.me-map .me-story-chip,.me-map .me-back,.me-map .me-search,.me-map .me-theme-btn,.me-map .me-share-btn,.me-map .me-zoom,.me-map .me-layers,.me-map .me-legend{background:var(--me-control-bg,rgba(0,0,0,.55));border-color:var(--me-border,rgba(255,255,255,.12));color:var(--me-muted,#9aa2ae)}
.me-map .me-story-chip--active{background:color-mix(in srgb,var(--me-accent,#e8c879) 20%,transparent);border-color:color-mix(in srgb,var(--me-accent,#e8c879) 45%,transparent);color:var(--me-accent,#e8c879)}
.me-map [data-me-layer-hidden="1"]{visibility:hidden;pointer-events:none}
'''
replace_once('''/* Media queries */''',palette_css+'\n/* Media queries */','insert palette CSS')

replace_once(
"""    bgRect.setAttribute('fill','#0d1d2e');bgRect.setAttribute('opacity','0.4');""",
"""    bgRect.setAttribute('class','me-map-bg');bgRect.setAttribute('fill','#0d1d2e');bgRect.setAttribute('opacity','0.4');""",
'map background semantic class')
replace_once(
"""    let signatureG=document.createElementNS('http://www.w3.org/2000/svg','g');signatureG.id='me-signature';svg.appendChild(signatureG);""",
"""    let signatureG=document.createElementNS('http://www.w3.org/2000/svg','g');signatureG.id='me-signature';signatureG.setAttribute('data-layer','signature');signatureG.setAttribute('data-layer-all','signature');svg.appendChild(signatureG);""",
'signature layer membership')

old_theme="""    // Theme toggle
    const themeBtn = document.createElement('button');
    themeBtn.className = 'me-theme-btn';
    themeBtn.title = 'Сменить тему';
    themeBtn.textContent = '🌙';
    themeBtn.setAttribute('aria-label', 'Переключить тему');
    let isDark = true;
    themeBtn.addEventListener('click', () => {
      isDark = !isDark;
      themeBtn.textContent = isDark ? '🌙' : '☀️';
      if (isDark) {
        container.style.setProperty('--me-bg','#070a10');
        container.style.setProperty('--me-panel-bg','rgba(13,17,26,.95)');
        container.style.setProperty('--me-text','#e9e4d6');
        container.style.setProperty('--me-gold','#e8c879');
      } else {
        container.style.setProperty('--me-bg','#f5f0e8');
        container.style.setProperty('--me-panel-bg','rgba(255,252,245,.97)');
        container.style.setProperty('--me-text','#3a2f1f');
        container.style.setProperty('--me-gold','#b8860b');
      }
      showToast(isDark ? 'Тёмная тема' : 'Светлая тема', 1200);
    });
    header.appendChild(themeBtn);"""
new_theme="""    // Theme toggle — one palette drives canvas, SVG and chrome.
    const themeBtn = document.createElement('button');
    themeBtn.className = 'me-theme-btn';
    themeBtn.title = 'Сменить тему';
    themeBtn.setAttribute('aria-label', 'Переключить тему');
    function applyMapTheme(theme,persist=true,announce=true){
      const palette=getMapThemePalette(theme);
      activeTheme=palette.id;
      container.setAttribute('data-map-theme',palette.id);
      container.style.setProperty('--me-bg',palette.bg);
      container.style.setProperty('--me-panel-bg',palette.panelBg);
      container.style.setProperty('--me-text',palette.text);
      container.style.setProperty('--me-muted',palette.muted);
      container.style.setProperty('--me-accent',palette.accent);
      container.style.setProperty('--me-control-bg',palette.controlBg);
      container.style.setProperty('--me-border',palette.border);
      container.style.setProperty('--me-label-bg',palette.labelBg);
      container.style.setProperty('--me-label-text',palette.labelText);
      container.style.setProperty('--me-svg-filter',palette.svgFilter);
      bgRect.setAttribute('fill',palette.baseFill);
      bgRect.setAttribute('opacity',palette.baseOpacity);
      themeBtn.textContent=palette.id==='dark'?'🌙':'☀️';
      themeBtn.setAttribute('aria-pressed',palette.id==='light'?'true':'false');
      if(persist){try{localStorage.setItem(themeStorageKey,palette.id)}catch(e){}}
      if(announce)showToast(palette.id==='dark'?'Тёмная тема':'Светлая тема',1200);
      return palette;
    }
    themeBtn.addEventListener('click',()=>applyMapTheme(activeTheme==='dark'?'light':'dark'));
    header.appendChild(themeBtn);"""
replace_once(old_theme,new_theme,'replace theme toggle')
replace_once(
"""    function showToast(msg, duration = 2000) {
      toastEl.textContent = msg;
      toastEl.classList.add('me-toast--visible');
      clearTimeout(toastEl._timeout);
      toastEl._timeout = setTimeout(() => toastEl.classList.remove('me-toast--visible'), duration);
    }

    // Stage dots""",
"""    function showToast(msg, duration = 2000) {
      toastEl.textContent = msg;
      toastEl.classList.add('me-toast--visible');
      clearTimeout(toastEl._timeout);
      toastEl._timeout = setTimeout(() => toastEl.classList.remove('me-toast--visible'), duration);
    }
    applyMapTheme(activeTheme,false,false);

    // Stage dots""",
'initialize theme')

old_layers="""    // Layer toggles
    {
      const layerData = [...(opts.layers || route.layers || [])];
      if (route.signature && route.signature.type) {
        layerData.push({ id:'signature', label: route.signature.label || 'Сигнатура', color:'#e8c879', on:true, selector:'#me-signature', pathSelector:'#me-signature' });
      }
      if (layerData.length) {
      const layerPanel = document.createElement('div');
      layerPanel.className = 'me-layers';
      layerPanel.innerHTML = '<div class="me-layers__title">Слои</div>';
      layerData.forEach((layer, i) => {
        const row = document.createElement('div');
        row.className = 'me-layers__row';
        row.setAttribute('data-layer-id', layer.id || '');
        const color = layer.color || STAGE_COLORS[i] || '#888';
        row.innerHTML = `<span class="me-layers__dot" style="background:${color}"></span><span class="me-layers__name">${esc(layer.label||layer.id||'')}</span>`;
        const toggle = document.createElement('button');
        toggle.className = `me-layers__toggle${layer.on !== false ? ' me-layers__toggle--on' : ''}`;
        toggle.setAttribute('aria-label', `Переключить слой ${layer.label||layer.id}`);
        toggle.addEventListener('click', () => {
          const isOn = toggle.classList.toggle('me-layers__toggle--on');
          // Apply opacity to all markers with matching layer
          const selector = layer.selector || `[data-layer="${layer.id}"]`;
          try {
            const elements = svg.querySelectorAll(selector);
            elements.forEach(el => {
              el.style.transition = 'opacity .35s ease';
              el.style.opacity = isOn ? '1' : '0.15';
            });
          } catch(e) {}
          showToast((layer.label||layer.id) + (isOn ? ' показан' : ' скрыт'), 1200);
          // Also toggle path visibility
          if (layer.pathSelector) {
            try {
              const paths = svg.querySelectorAll(layer.pathSelector);
              paths.forEach(p => { p.style.display = isOn ? '' : 'none'; });
            } catch(e) {}
          }
        });
        row.appendChild(toggle);
        layerPanel.appendChild(row);
      });
      container.appendChild(layerPanel);
      }
    }"""
new_layers="""    // Layer toggles — persistent token membership, reapplied after every render.
    function collectLayerElements(layer){
      const elements=new Set();
      svg.querySelectorAll('[data-layer]').forEach(el=>{
        if(normalizeLayerTokens(el.getAttribute('data-layer')).includes(String(layer.id)))elements.add(el);
      });
      if(layer.selector){try{svg.querySelectorAll(layer.selector).forEach(el=>elements.add(el))}catch(e){}}
      if(layer.pathSelector){try{svg.querySelectorAll(layer.pathSelector).forEach(el=>elements.add(el))}catch(e){}}
      return [...elements];
    }
    function applyLayerVisibility(){
      const membership=new Map();
      layerDefinitions.forEach(layer=>{
        if(!layer||!layer.id)return;
        collectLayerElements(layer).forEach(el=>{
          if(!membership.has(el))membership.set(el,{all:new Set(normalizeLayerTokens(el.getAttribute('data-layer-all'))),any:new Set(normalizeLayerTokens(el.getAttribute('data-layer-any'))),explicit:new Set()});
          const info=membership.get(el);
          if(!info.all.has(String(layer.id))&&!info.any.has(String(layer.id)))info.explicit.add(String(layer.id));
        });
      });
      membership.forEach((info,el)=>{
        if(el.getAttribute('data-me-layer-hidden')!=='1'){
          el.setAttribute('data-me-layer-visible-opacity',el.style.opacity||'');
          el.setAttribute('data-me-layer-visible-visibility',el.style.visibility||'');
          el.setAttribute('data-me-layer-visible-pointer',el.style.pointerEvents||'');
        }
        const restrictive=[...info.all,...info.explicit].filter(id=>layerState.has(id));
        const alternatives=[...info.any].filter(id=>layerState.has(id));
        const hidden=restrictive.some(id=>layerState.get(id)===false)||(alternatives.length>0&&!alternatives.some(id=>layerState.get(id)!==false));
        el.setAttribute('data-me-layer-hidden',hidden?'1':'0');
        if(hidden){
          el.style.opacity='0';el.style.visibility='hidden';el.style.pointerEvents='none';el.setAttribute('aria-hidden','true');
        }else{
          el.style.opacity=el.getAttribute('data-me-layer-visible-opacity')||'';
          el.style.visibility=el.getAttribute('data-me-layer-visible-visibility')||'';
          el.style.pointerEvents=el.getAttribute('data-me-layer-visible-pointer')||'';
          el.removeAttribute('aria-hidden');
        }
      });
    }
    function setLayerEnabled(id,enabled,announce=true){
      if(!layerState.has(id))return false;
      layerState.set(id,!!enabled);
      const row=container.querySelector(`.me-layers__row[data-layer-id="${id}"]`);
      const toggle=row&&row.querySelector('.me-layers__toggle');
      if(toggle){toggle.classList.toggle('me-layers__toggle--on',!!enabled);toggle.setAttribute('aria-pressed',enabled?'true':'false')}
      applyLayerVisibility();
      if(announce){const layer=layerDefinitions.find(item=>String(item.id)===String(id));showToast((layer?.label||id)+(enabled?' показан':' скрыт'),1200)}
      return true;
    }
    if(layerDefinitions.length){
      const layerPanel=document.createElement('div');
      layerPanel.className='me-layers';
      layerPanel.innerHTML='<div class="me-layers__title">Слои</div>';
      layerDefinitions.forEach((layer,i)=>{
        const id=String(layer.id||'');
        const row=document.createElement('div');row.className='me-layers__row';row.setAttribute('data-layer-id',id);
        const color=layer.color||STAGE_COLORS[i]||'#888';
        row.innerHTML=`<span class="me-layers__dot" style="background:${color}"></span><span class="me-layers__name">${esc(layer.label||id)}</span>`;
        const toggle=document.createElement('button');
        const enabled=layerState.get(id)!==false;
        toggle.className=`me-layers__toggle${enabled?' me-layers__toggle--on':''}`;
        toggle.setAttribute('aria-label',`Переключить слой ${layer.label||id}`);
        toggle.setAttribute('aria-pressed',enabled?'true':'false');
        toggle.addEventListener('click',()=>setLayerEnabled(id,layerState.get(id)===false));
        row.appendChild(toggle);layerPanel.appendChild(row);
      });
      container.appendChild(layerPanel);
    }"""
replace_once(old_layers,new_layers,'replace layer toggles')

# Semantic layer memberships for rendered geometry.
replace_once(
"""        under.setAttribute('stroke-width','9');under.setAttribute('stroke-linecap','round');under.setAttribute('stroke-linejoin','round');under.setAttribute('opacity','0.11');under.setAttribute('data-stage',String(i));under.setAttribute('data-route-kind','underlay');under.setAttribute('class','me-route-underlay');""",
"""        const stageMembership=getStageLayerMembership(route,i);
        under.setAttribute('stroke-width','9');under.setAttribute('stroke-linecap','round');under.setAttribute('stroke-linejoin','round');under.setAttribute('opacity','0.11');under.setAttribute('data-stage',String(i));under.setAttribute('data-route-kind','underlay');under.setAttribute('class','me-route-underlay');under.setAttribute('data-layer',stageMembership.tokens.join(' '));under.setAttribute('data-layer-all',stageMembership.all.join(' '));under.setAttribute('data-layer-any',stageMembership.any.join(' '));""",
'underlay membership')
replace_once(
"""        path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('opacity','0.5');path.setAttribute('marker-end','url(#me-arrow-'+i+')');path.setAttribute('data-stage',String(i));path.setAttribute('data-route-kind','main');path.setAttribute('class','me-route-main');""",
"""        path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('opacity','0.5');path.setAttribute('marker-end','url(#me-arrow-'+i+')');path.setAttribute('data-stage',String(i));path.setAttribute('data-route-kind','main');path.setAttribute('class','me-route-main');path.setAttribute('data-layer',stageMembership.tokens.join(' '));path.setAttribute('data-layer-all',stageMembership.all.join(' '));path.setAttribute('data-layer-any',stageMembership.any.join(' '));""",
'path membership')
replace_once(
"""          label.setAttribute('x',String(mid.x+10));label.setAttribute('y',String(mid.y-10));label.setAttribute('class','me-route-label');label.setAttribute('data-stage',String(i));label.textContent=(route.stages?.[i]?.n||(''+(i+1)));""",
"""          label.setAttribute('x',String(mid.x+10));label.setAttribute('y',String(mid.y-10));label.setAttribute('class','me-route-label');label.setAttribute('data-stage',String(i));label.setAttribute('data-layer',stageMembership.tokens.join(' '));label.setAttribute('data-layer-all',stageMembership.all.join(' '));label.setAttribute('data-layer-any',stageMembership.any.join(' '));label.textContent=(route.stages?.[i]?.n||(''+(i+1)));""",
'route label membership')
replace_once(
"""        wpLine.setAttribute('opacity', '0.5');
        waypointsG.appendChild(wpLine);""",
"""        wpLine.setAttribute('opacity', '0.5');
        wpLine.setAttribute('data-layer','wp');wpLine.setAttribute('data-layer-all','wp');
        waypointsG.appendChild(wpLine);""",
'waypoint path membership')
replace_once(
"""        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-layer', `stage-${place.stage||0}`);
        g.setAttribute('data-layer-main', '');
        if (place.type) g.setAttribute('data-layer', `${g.getAttribute('data-layer')} ${place.type}`);""",
"""        g.setAttribute('data-place-id', place.id);
        const membership=getPlaceLayerMembership(route,place);
        g.setAttribute('data-layer',membership.tokens.join(' '));
        g.setAttribute('data-layer-all',membership.all.join(' '));
        g.setAttribute('data-layer-any',membership.any.join(' '));
        g.setAttribute('data-layer-main','');""",
'place membership')

# Apply layer state after dynamic rendering and search/animations.
replace_once(
"""        markersG.appendChild(g);
      });
    }



    // ── Panel rendering ──""",
"""        markersG.appendChild(g);
      });
      applyLayerVisibility();
    }



    // ── Panel rendering ──""",
'apply layers after render')
replace_once(
"""      if (q) {
        const mc = markersG.querySelectorAll('g[transform]').length;
        let visibleCount = 0;
        markersG.querySelectorAll('g[transform]').forEach(g => {
          if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
        });
        if (visibleCount > 0 && visibleCount < mc) {
          showToast('Найдено: ' + visibleCount, 1500);
        }
      }
    }, 200);""",
"""      if (q) {
        const mc = markersG.querySelectorAll('g[transform]').length;
        let visibleCount = 0;
        markersG.querySelectorAll('g[transform]').forEach(g => {
          if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
        });
        if (visibleCount > 0 && visibleCount < mc) {
          showToast('Найдено: ' + visibleCount, 1500);
        }
      }
      applyLayerVisibility();
    }, 200);""",
'apply layers after search')
replace_once(
"""      allMarkers.forEach((g, i) => {
        g.style.opacity = '0';""",
"""      allMarkers.forEach((g, i) => {
        if(g.getAttribute('data-me-layer-hidden')==='1')return;
        g.style.opacity = '0';""",
'preserve hidden markers during animation')

replace_once(
"""    const instance={
      open,close,setStory,startTour,stopTour,flyTo,resetView,
      get routeData(){return route},""",
"""    const instance={
      open,close,setStory,startTour,stopTour,flyTo,resetView,setLayerEnabled,applyMapTheme,
      get routeData(){return route},
      get theme(){return activeTheme},
      get layers(){return Object.fromEntries(layerState)},""",
'instance layer/theme API')
replace_once(
"""    getPanelModel,getPanelSections,getStoryViewport,getStoryState,getPlaceOrder,auditStoryDefinitions,
    parseMapStateFromLocation,resolveInitialMapState,buildMapStateUrl,""",
"""    getPanelModel,getPanelSections,getStoryViewport,getStoryState,getPlaceOrder,auditStoryDefinitions,
    parseMapStateFromLocation,resolveInitialMapState,buildMapStateUrl,
    normalizeLayerTokens,getPlaceLayerMembership,getStageLayerMembership,getMapThemePalette,""",
'export layer/theme helpers')
replace_once("version:'0.53.0',buildDate:'2026-07-11'","version:'0.54.0',buildDate:'2026-07-21'",'engine version')

path.write_text(text,encoding='utf-8')
print('map layers/theme patch applied')
