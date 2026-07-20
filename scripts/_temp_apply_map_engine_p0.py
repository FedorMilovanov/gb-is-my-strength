#!/usr/bin/env python3
from pathlib import Path

engine_path = Path('karty/_engine/map-engine.js')
text = engine_path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    """    let view = {x:0, y:0, w:cfg.W0, h:cfg.H0};
    
    // Cleanup tracking""",
    """    let view = {x:0, y:0, w:cfg.W0, h:cfg.H0};

    function getState() {
      return { place: activePlaceId, story: activeStoryId };
    }
    
    // Cleanup tracking""",
    'share state helper',
)

replace_once(
    """    const q = searchInput.value.toLowerCase().trim();
    const allG = markersG.querySelectorAll('g[transform]');
    if (!q) { allG.forEach(g => { g.style.opacity = ''; }); return; }
    let matchCount = 0;
    allG.forEach(g => {
      const text = g.querySelector('text');""",
    """    const q = searchInput.value.toLowerCase().trim();
    const allG = markersG.querySelectorAll('g[transform]');
    if (!q) {
      const visibleIds = new Set(visiblePlaces().map(p => p.id));
      allG.forEach(g => {
        const placeId = g.getAttribute('data-place-id');
        g.style.opacity = !placeId || visibleIds.has(placeId) ? '1' : '.15';
      });
      return;
    }
    let matchCount = 0;
    allG.forEach(g => {
      const placeId = g.getAttribute('data-place-id');
      const text = g.querySelector('text');""",
    'search clear opacity',
)

replace_once(
    """      if (!match) {
        const placeId = g.getAttribute('data-place-id');
        if (placeId) {""",
    """      if (!match) {
        if (placeId) {""",
    'search marker id scope',
)

replace_once(
    """          _tm(() => { labelEl.setAttribute('fill', inStory?'#f4eedd':'#555'); labelEl.setAttribute('font-weight',''); }, 3000);""",
    """          _tm(() => {
            const markerStillInStory = !placeId || visiblePlaces().some(p => p.id === placeId);
            labelEl.setAttribute('fill', markerStillInStory ? '#f4eedd' : '#555');
            labelEl.setAttribute('font-weight','');
          }, 3000);""",
    'delayed search highlight',
)

replace_once(
    """      const stagePaths=Array.from({length:(route.stages||[]).length},()=>[]);
      allPlaces.forEach(p=>{if(typeof p.stage==='number')stagePaths[p.stage]=stagePaths[p.stage]||[];stagePaths[p.stage].push(p)});""",
    """      const stagePaths=Array.from({length:(route.stages||[]).length},()=>[]);
      allPlaces.forEach(p=>{
        if(!Number.isInteger(p.stage)||p.stage<0||p.stage>=stagePaths.length)return;
        stagePaths[p.stage].push(p);
      });""",
    'stage path guard',
)

replace_once(
    """    let zoomRepeatTimer = null;
    function startZoomRepeat(dir) {
      const doZoom = () => {
        if (zoomRepeatTimer === null) return;
        const cx=view.x+view.w/2,cy=view.y+view.h/2;
        const nw=dir==='in'?Math.max(cfg.minW,view.w*0.85):Math.min(cfg.maxW,view.w*1.15);
        flyTo(cx,cy,nw,150);
      };
      doZoom();
      zoomRepeatTimer = setInterval(doZoom, 120);
    }
    function stopZoomRepeat() { if (zoomRepeatTimer) { clearInterval(zoomRepeatTimer); zoomRepeatTimer = null; } }
    ['in','out'].forEach(dir => {
      const btn = zoomControls.querySelector('[data-zoom='+dir+']');
      if (!btn) return;
      _on(btn, 'mousedown', (e) => { e.preventDefault(); startZoomRepeat(dir); });
      _on(btn, 'mouseup', stopZoomRepeat);
      _on(btn, 'mouseleave', stopZoomRepeat);
      _on(btn, 'touchstart', (e) => { e.preventDefault(); startZoomRepeat(dir); });
      _on(btn, 'touchend', stopZoomRepeat);
      _on(btn, 'click', (e) => { e.preventDefault(); }); // Prevent double-fire
    });""",
    """    let zoomRepeatTimer = null;
    let suppressZoomClickUntil = 0;
    function zoomOnce(dir) {
      const cx=view.x+view.w/2,cy=view.y+view.h/2;
      const nw=dir==='in'?Math.max(cfg.minW,view.w*0.85):Math.min(cfg.maxW,view.w*1.15);
      flyTo(cx,cy,nw,150);
    }
    function startZoomRepeat(dir) {
      zoomOnce(dir);
      zoomRepeatTimer = setInterval(() => zoomOnce(dir), 120);
    }
    function stopZoomRepeat() { if (zoomRepeatTimer) { clearInterval(zoomRepeatTimer); zoomRepeatTimer = null; } }
    ['in','out'].forEach(dir => {
      const btn = zoomControls.querySelector('[data-zoom='+dir+']');
      if (!btn) return;
      _on(btn, 'mousedown', (e) => { e.preventDefault(); suppressZoomClickUntil=Date.now()+800; startZoomRepeat(dir); });
      _on(btn, 'mouseup', stopZoomRepeat);
      _on(btn, 'mouseleave', stopZoomRepeat);
      _on(btn, 'touchstart', (e) => { e.preventDefault(); suppressZoomClickUntil=Date.now()+800; startZoomRepeat(dir); });
      _on(btn, 'touchend', stopZoomRepeat);
      _on(btn, 'click', (e) => {
        e.preventDefault();
        if(Date.now()<suppressZoomClickUntil)return;
        zoomOnce(dir);
      });
    });""",
    'zoom click support',
)

engine_path.write_text(text, encoding='utf-8')

guard_path = Path('.github/workflows/shared-files-guard.yml')
guard = guard_path.read_text(encoding='utf-8')
old = """      - name: Runtime integrity regressions
        run: node scripts/runtime-integrity-test.js

      - name: Guard shared/system files (strict on main/PR)"""
new = """      - name: Runtime integrity regressions
        run: node scripts/runtime-integrity-test.js

      - name: Map engine P0 regressions
        run: |
          node --check karty/_engine/map-engine.js
          node scripts/map-engine-p0-regression-test.js

      - name: Guard shared/system files (strict on main/PR)"""
if guard.count(old) != 1:
    raise SystemExit(f'shared guard insertion: expected exactly one match, found {guard.count(old)}')
guard_path.write_text(guard.replace(old, new, 1), encoding='utf-8')
