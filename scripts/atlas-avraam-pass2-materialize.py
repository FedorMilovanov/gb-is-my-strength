from pathlib import Path

engine=Path('karty/_engine/map-engine.js')
s=engine.read_text('utf-8')

target="""      allMarkers.forEach((g, i) => {
        if(g.getAttribute('data-me-layer-hidden')==='1'||g.getAttribute('data-story-active')==='0'){
          g.style.opacity='0';
          return;
        }
"""
if target not in s:
    old="""      allMarkers.forEach((g, i) => {
        if(g.getAttribute('data-me-layer-hidden')==='1')return;
"""
    if old not in s:
        raise SystemExit('MISSING animateMarkersIn visibility anchor')
    s=s.replace(old,target,1)

engine.write_text(s,'utf-8')
print('PASS7.1 APPLIED')
