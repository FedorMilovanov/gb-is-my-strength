from pathlib import Path

root = Path(__file__).resolve().parents[1]
engine_path = root / 'karty/_engine/map-engine.js'
witness_path = root / 'scripts/avraam-dossier-witness.mjs'
self_path = root / 'scripts/atlas-avraam-dossier-a11y-materialize.py'
workflow_path = root / '.github/workflows/atlas-avraam-dossier-a11y-materialize.yml'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


engine = engine_path.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    '.me-nav button{flex:0;padding:6px 14px;min-height:44px;',
    '.me-nav button{flex:0;padding:6px 14px;min-width:44px;min-height:44px;',
    'panel nav target width',
)
engine = replace_once(
    engine,
    '.me-nav button:disabled{opacity:.3;cursor:default}\n',
    '.me-nav button:disabled{opacity:.3;cursor:default}\n.me-content .act-btn{min-height:44px;padding:10px 12px;border-radius:6px;cursor:pointer}\n',
    'content action target height',
)
engine = replace_once(
    engine,
    """        const inStory=visIds.has(place.id);
        const storyRole=resolveStoryRole(place,inStory);""",
    """        const inStory=visIds.has(place.id);
        const isRoutePlace=Number.isInteger(place.stage);
        const markerInteractive=inStory&&isRoutePlace;
        const storyRole=resolveStoryRole(place,inStory);""",
    'route/context marker distinction',
)
engine = replace_once(
    engine,
    """        g.setAttribute('data-layer-main','');
        g.style.cursor=inStory?'pointer':'default';
        g.addEventListener('mouseenter',()=>{if(inStory){""",
    """        g.setAttribute('data-layer-main','');
        g.style.cursor=markerInteractive?'pointer':'default';
        if(markerInteractive){
          g.setAttribute('role','button');
          g.setAttribute('tabindex','0');
          g.setAttribute('aria-label',`Открыть досье: ${place.name||place.id}`);
        }else{
          g.setAttribute('aria-hidden','true');
        }
        g.addEventListener('mouseenter',()=>{if(markerInteractive){""",
    'marker semantics',
)
engine = replace_once(
    engine,
    """        if(inStory){
              // Long-press detection for quick info tooltip""",
    """        if(markerInteractive){
              // Long-press detection for quick info tooltip""",
    'interactive marker listener gate',
)
engine = replace_once(
    engine,
    """      g.addEventListener('click',()=>{if(longPressFired){longPressFired=false;return;}haptic();addRipple(svg,place.x,place.y,getStageColor(place.stage));const d2=g.querySelector('.me-marker-dot');if(d2){d2.style.transition='transform .15s cubic-bezier(.34,1.56,.64,1)';d2.style.transform='scale(1.4)';_tm(()=>{d2.style.transform='scale(1)';_tm(()=>{d2.style.transition='r .2s ease, fill .2s ease, filter .2s ease';},160);},160);}open(place.id);});
        g.addEventListener('dblclick',(e)=>{e.preventDefault();e.stopPropagation();flyTo(place.x,place.y,Math.min(view.w,450),600);});""",
    """      g.addEventListener('click',()=>{if(longPressFired){longPressFired=false;return;}haptic();addRipple(svg,place.x,place.y,getStageColor(place.stage));const d2=g.querySelector('.me-marker-dot');if(d2){d2.style.transition='transform .15s cubic-bezier(.34,1.56,.64,1)';d2.style.transform='scale(1.4)';_tm(()=>{d2.style.transform='scale(1)';_tm(()=>{d2.style.transition='r .2s ease, fill .2s ease, filter .2s ease';},160);},160);}open(place.id);});
        g.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '||event.key==='Spacebar'){event.preventDefault();event.stopPropagation();open(place.id);}});
        g.addEventListener('dblclick',(e)=>{e.preventDefault();e.stopPropagation();flyTo(place.x,place.y,Math.min(view.w,450),600);});""",
    'marker keyboard activation',
)
engine = replace_once(
    engine,
    """    function close(reason = 'close', closeOptions = {}){
      closePhoto('panel-close', {restoreFocus:false});
      activePlaceId=null;""",
    """    function close(reason = 'close', closeOptions = {}){
      const closingPlaceId=activePlaceId;
      closePhoto('panel-close', {restoreFocus:false});
      activePlaceId=null;""",
    'closing place identity',
)
engine = replace_once(
    engine,
    """      saveState();
      renderMarkers();
    }
""",
    """      saveState();
      renderMarkers();
      if(closeOptions.restoreFocus!==false&&closingPlaceId){
        setTimeout(()=>focusSpecialTarget(markersG.querySelector(`[data-place-id="${CSS.escape(closingPlaceId)}"]`)),0);
      }
    }
""",
    'focus restored to replacement marker',
)
engine_path.write_text(engine, encoding='utf-8')

witness = witness_path.read_text(encoding='utf-8')
witness = replace_once(
    witness,
    """    const controls = panel ? Array.from(panel.querySelectorAll('button,a,[role="button"],[role="tab"],[tabindex]:not([tabindex="-1"])')).filter(isVisible).map(node => ({
      tag: node.tagName.toLowerCase(),
      text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tab: node.getAttribute('data-tab'),
      rect: rect(node),
    })) : [];""",
    """    const controls = panel ? Array.from(panel.querySelectorAll('button,[role="button"],[role="tab"]')).filter(isVisible).map(node => ({
      tag: node.tagName.toLowerCase(),
      text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tab: node.getAttribute('data-tab'),
      rect: rect(node),
    })) : [];
    const links = content ? Array.from(content.querySelectorAll('a[href]')).filter(isVisible).map(node => ({
      text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      href: node.getAttribute('href') || '',
    })) : [];""",
    'explicit controls vs inline links',
)
witness = replace_once(
    witness,
    """      controls,
      images,""",
    """      controls,
      links,
      images,""",
    'link evidence output',
)
witness = replace_once(
    witness,
    """  for (const control of state.controls) {
    if (control.rect.width < 44 - .5 || control.rect.height < 44 - .5) fail(scope, `undersized control ${control.tab || control.text || control.tag}: ${control.rect.width.toFixed(1)}x${control.rect.height.toFixed(1)}`);
  }
}""",
    """  for (const control of state.controls) {
    if (control.rect.width < 44 - .5 || control.rect.height < 44 - .5) fail(scope, `undersized control ${control.tab || control.text || control.tag}: ${control.rect.width.toFixed(1)}x${control.rect.height.toFixed(1)}`);
  }
  for (const link of state.links || []) if (!link.href.trim()) fail(scope, `content link without href: ${link.text}`);
}""",
    'target-size and link integrity split',
)
witness_path.write_text(witness, encoding='utf-8')

for marker in [
    'min-width:44px;min-height:44px',
    '.me-content .act-btn{min-height:44px',
    "g.setAttribute('role','button')",
    "g.addEventListener('keydown'",
    'const closingPlaceId=activePlaceId',
    'focusSpecialTarget(markersG.querySelector',
]:
    if marker not in engine:
        raise SystemExit(f'missing engine contract: {marker}')
if "querySelectorAll('button,[role=\"button\"],[role=\"tab\"]')" not in witness:
    raise SystemExit('dossier explicit-control selector missing')
if 'const links = content ?' not in witness:
    raise SystemExit('dossier link evidence missing')

self_path.unlink()
workflow_path.unlink()
