from pathlib import Path
import json, re
root=Path('.')
engine=root/'karty/_engine/map-engine.js'
routef=root/'karty/avraam/route.json'
svgf=root/'karty/avraam/base.svg'
s=engine.read_text('utf-8')
if 'Premium map-first chrome: one quiet timeline' in s:
    print('PASS2 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(old,new,label,count=1):
    global s
    n=s.count(old)
    if n<count: raise SystemExit(f'MISSING {label}: {n}')
    s=s.replace(old,new,count)

# Calm chrome and one timeline.
rep(".me-stories{display:flex;gap:6px;flex-wrap:wrap}",
".me-stories{position:absolute;top:10px;right:286px;max-width:calc(100% - 690px);display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;padding-bottom:3px}.me-stories::-webkit-scrollbar{display:none}", 'stories css')
rep(".me-search{position:absolute;top:8px;right:48px;z-index:15;width:160px;", 
".me-search{position:absolute;top:10px;right:116px;z-index:15;width:150px;", 'search css')
rep(".me-search:focus{border-color:rgba(232,200,121,.4);width:200px}",
".me-search:focus{border-color:rgba(232,200,121,.4);width:210px}", 'search focus')
rep(".me-route-underlay{filter:url(#me-gold-glow);pointer-events:none;mix-blend-mode:screen}",
".me-route-underlay{pointer-events:none;mix-blend-mode:screen}", 'underlay css')
rep(".me-route-label{font-size:8px;letter-spacing:.12em;fill:rgba(232,200,121,.72);stroke:#070a10;stroke-width:2.4;paint-order:stroke;pointer-events:none;text-transform:uppercase}",
".me-route-label{font-size:7px;letter-spacing:.12em;fill:rgba(232,200,121,.62);stroke:#070a10;stroke-width:2;paint-order:stroke;pointer-events:none;text-transform:uppercase}.me-map svg:not([data-zoom-bucket=\"overview\"]) .me-route-label{display:none}", 'route label css')
rep(".me-story-focus{fill:rgba(232,200,121,.035);stroke:rgba(232,200,121,.46);stroke-width:1.4;stroke-dasharray:9 9;vector-effect:non-scaling-stroke;filter:url(#me-gold-glow);pointer-events:none;animation:meStoryFocus 1.7s ease-out both}",
".me-story-focus{fill:none;stroke:rgba(232,200,121,.24);stroke-width:1;stroke-dasharray:3 8;vector-effect:non-scaling-stroke;pointer-events:none;opacity:.42}.me-map svg[data-zoom-bucket=\"overview\"] .me-story-focus{display:none}", 'focus css')
insert_css='''\n/* Premium map-first chrome: one quiet timeline, no duplicate stage rails or shortcut billboard. */\n.me-timeline,.me-stages,.me-shortcuts{display:none!important}\n.me-life{opacity:.78;border-top:1px solid rgba(255,255,255,.035)}\n.me-map[data-zoom-bucket="region"] .me-life,.me-map[data-zoom-bucket="detail"] .me-life{opacity:.48}\n'''
rep("/* Theme toggle */", insert_css+"\n/* Theme toggle */", 'premium css insert')
rep("  .me-stories{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;margin-top:52px;padding:0 0 4px;scrollbar-width:none;overscroll-behavior-x:contain}",
"  .me-stories{position:relative;top:auto;right:auto;max-width:none;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;margin-top:52px;padding:0 18px 6px 0;scrollbar-width:none;overscroll-behavior-x:contain;mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}", 'mobile stories')
rep("  .me-search{top:8px;right:112px;width:calc(100% - 232px);min-width:120px;max-width:180px;height:44px;padding:0 10px}",
"  .me-search{top:8px;right:112px;width:calc(100% - 220px);min-width:104px;max-width:190px;height:44px;padding:0 10px}", 'mobile search')
rep("  .me-stages{left:8px;right:8px;overflow-x:auto;justify-content:flex-start;scrollbar-width:none}",
"  .me-life{display:none!important}\n  .me-stages{left:8px;right:8px;overflow-x:auto;justify-content:flex-start;scrollbar-width:none}", 'mobile life')

s=s.replace("marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','8');\n      marker.setAttribute('refX','9');marker.setAttribute('refY','4');",
"marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','4');\n      marker.setAttribute('refX','4.6');marker.setAttribute('refY','2');marker.setAttribute('markerUnits','strokeWidth');marker.setAttribute('viewBox','0 0 5 4');",1)
s=s.replace("marker.innerHTML = `<path d=\"M0,0 L10,4 L0,8 L3,4 Z\" fill=\"${clr}\" opacity=\"0.7\"/>`;",
"marker.innerHTML = `<path d=\"M0,0 L5,2 L0,4 L1.4,2 Z\" fill=\"${clr}\" opacity=\"0.72\"/>`;",1)
rep("marker.setAttribute('id',id);marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','8');\n        marker.setAttribute('refX','9');marker.setAttribute('refY','4');marker.setAttribute('orient','auto');",
"marker.setAttribute('id',id);marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','4');\n        marker.setAttribute('refX','4.6');marker.setAttribute('refY','2');marker.setAttribute('orient','auto');marker.setAttribute('markerUnits','strokeWidth');marker.setAttribute('viewBox','0 0 5 4');", 'dynamic marker')
rep("arrow.setAttribute('d','M0,0 L10,4 L0,8 L3,4 Z');arrow.setAttribute('fill',color);arrow.setAttribute('opacity','0.7');",
"arrow.setAttribute('d','M0,0 L5,2 L0,4 L1.4,2 Z');arrow.setAttribute('fill',color);arrow.setAttribute('opacity','0.72');", 'dynamic arrow')

old="""    const canvas=document.createElement('div');canvas.className='me-canvas';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
"""
new="""    const canvas=document.createElement('div');canvas.className='me-canvas';
    function viewportAspect(){
      const r=canvas.isConnected?canvas.getBoundingClientRect():container.getBoundingClientRect();
      return r.width>1&&r.height>1?r.height/r.width:cfg.H0/cfg.W0;
    }
    function viewHeightForWidth(width){return width*viewportAspect()}
    function clampViewAround(cx,cy,width){
      const w=clamp(width,cfg.minW,cfg.maxW),h=viewHeightForWidth(w);
      return{x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};
    }
    const authoredMobileInit=route.meta?.mobile_viewport_init;
    if(matchMedia('(max-width:560px)').matches&&authoredMobileInit){
      const mv=Array.isArray(authoredMobileInit)?{cx:authoredMobileInit[0],cy:authoredMobileInit[1],w:authoredMobileInit[2]}:authoredMobileInit;
      view=clampViewAround(Number(mv.cx)||cfg.W0/2,Number(mv.cy)||cfg.H0/2,Number(mv.w)||Math.min(cfg.W0,680));
    }else{
      const centerX=view.x+view.w/2,centerY=view.y+view.h/2;
      view=clampViewAround(centerX,centerY,view.w);
    }
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
"""
rep(old,new,'aspect helper')

old="""      // Compass is anchored in screen space, not at a fixed map coordinate.
      const compass = svg.querySelector('#me-compass');
      if (compass) {
        const canvasRect=canvas.getBoundingClientRect();
        const unitsPerPixel=view.w/Math.max(1,canvasRect.width);
"""
new="""      const canvasRect=canvas.getBoundingClientRect();
      const unitsPerPixel=view.w/Math.max(1,canvasRect.width);
      svg.querySelectorAll('[data-screen-anchor][data-map-x][data-map-y]').forEach(anchor=>{
        const x=Number(anchor.getAttribute('data-map-x')),y=Number(anchor.getAttribute('data-map-y'));
        if(Number.isFinite(x)&&Number.isFinite(y))anchor.setAttribute('transform',`translate(${x},${y}) scale(${unitsPerPixel.toFixed(4)})`);
      });
      // Compass is anchored in screen space, not at a fixed map coordinate.
      const compass = svg.querySelector('#me-compass');
      if (compass) {
"""
rep(old,new,'screen anchors')

rep("""      function appendRenderedRoutePath(stageIndex,pathIndex,spec,membership){
        const color=resolveRoutePathColor(spec.colorKey,stageIndex);
""",
"""      const activeStoryState=getStoryState(route,activeStoryId);
      const activeStoryStages=new Set(activeStoryState?.stageIds||[]);
      const allStoryStages=activeStoryId==='main'||activeStoryStages.size===0;
      function appendRenderedRoutePath(stageIndex,pathIndex,spec,membership){
        const color=resolveRoutePathColor(spec.colorKey,stageIndex);
        const storyActive=allStoryStages||activeStoryStages.has(stageIndex);
""", 'active stages')
rep("""          element.setAttribute('data-route-dash',spec.dash?'1':'0');element.setAttribute('class',className);
          applyRouteLayerMembership(element,membership);
""",
"""          element.setAttribute('data-route-dash',spec.dash?'1':'0');element.setAttribute('data-story-active',storyActive?'1':'0');element.setAttribute('class',className);
          element.setAttribute('vector-effect','non-scaling-stroke');
          applyRouteLayerMembership(element,membership);
""", 'vector effect')
rep("under.setAttribute('stroke-width','9');under.setAttribute('opacity','0.11');",
"under.setAttribute('stroke-width','5.5');under.setAttribute('opacity',storyActive?'0.12':'0.018');", 'under styles')
rep("path.setAttribute('stroke-width','3');path.setAttribute('opacity','0.5');path.setAttribute('marker-end','url(#'+markerId+')');",
"path.setAttribute('stroke-width','2.2');path.setAttribute('opacity',storyActive?'0.72':'0.055');path.setAttribute('marker-end',storyActive?'url(#'+markerId+')':'');", 'main styles')
rep("label.setAttribute('data-stage',String(i));label.setAttribute('data-stage-index',String(i));",
"label.setAttribute('data-stage',String(i));label.setAttribute('data-stage-index',String(i));label.setAttribute('data-story-active',(allStoryStages||activeStoryStages.has(i))?'1':'0');", 'label active')
rep("applyRouteLayerMembership(label,stageMembership);label.textContent=stage.n||(''+(i+1));",
"applyRouteLayerMembership(label,stageMembership);label.setAttribute('opacity',(allStoryStages||activeStoryStages.has(i))?'0.62':'0');label.textContent=stage.n||(''+(i+1));", 'label opacity')

rep("""        g.setAttribute('transform',`translate(${place.x},${place.y})`);
        g.setAttribute('data-place-id', place.id);
""",
"""        g.setAttribute('transform',`translate(${place.x},${place.y})`);
        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-screen-anchor','place');g.setAttribute('data-map-x',String(place.x));g.setAttribute('data-map-y',String(place.y));
""", 'marker anchors')
rep("""      renderSignatureOverlay();
      renderStoryFocus();

      // Overview labels""",
"""      renderSignatureOverlay();
      renderStoryFocus();
      applyViewBox();

      // Overview labels""", 'apply after render')

rep("""        p.setAttribute('opacity', isActive ? (isUnder ? '0.26' : '0.88') : (isUnder ? '0.07' : '0.26'));
        p.setAttribute('stroke-width', isActive ? (isUnder ? '12' : '4') : (isUnder ? '8' : '2.4'));
""",
"""        const storyActive=p.dataset.storyActive!=='0';
        p.setAttribute('opacity', isActive ? (isUnder ? '0.2' : '0.94') : (storyActive ? (isUnder ? '0.06' : '0.18') : (isUnder ? '0.012' : '0.035')));
        p.setAttribute('stroke-width', isActive ? (isUnder ? '7' : '2.8') : (isUnder ? '5.5' : '2.2'));
""", 'open path styles')
rep("""      // Reset all stage paths to equal opacity
      const allPaths = pathsG.querySelectorAll('path[data-stage]');
      allPaths.forEach(p => {
        const isUnder = p.dataset.routeKind === 'underlay';
        p.setAttribute('opacity', isUnder ? '0.11' : '0.5');
        p.setAttribute('stroke-width', isUnder ? '9' : '3');
""",
"""      // Restore story-aware route hierarchy.
      const allPaths = pathsG.querySelectorAll('path[data-stage]');
      allPaths.forEach(p => {
        const isUnder = p.dataset.routeKind === 'underlay';
        const storyActive=p.dataset.storyActive!=='0';
        p.setAttribute('opacity', storyActive ? (isUnder ? '0.12' : '0.72') : (isUnder ? '0.018' : '0.055'));
        p.setAttribute('stroke-width', isUnder ? '5.5' : '2.2');
""", 'close path styles')
rep("pathsG.querySelectorAll('.me-route-label').forEach(lbl => lbl.setAttribute('opacity','0.72'));",
"pathsG.querySelectorAll('.me-route-label').forEach(lbl => lbl.setAttribute('opacity',lbl.dataset.storyActive==='0'?'0':'0.62'));", 'close labels')

rep("      showStoryToast(story);\n", "", 'remove story toast')
rep("""      const storyViewport = getStoryViewport(route, storyId);
      if(Array.isArray(storyViewport)) flyTo(storyViewport[0], storyViewport[1], storyViewport[2]);
""",
"""      const mobileViewport=matchMedia('(max-width:560px)').matches?route.meta?.mobile_story_viewports?.[storyId]:null;
      const storyViewport = Array.isArray(mobileViewport)?mobileViewport:getStoryViewport(route, storyId);
      if(Array.isArray(storyViewport)) flyTo(storyViewport[0], storyViewport[1], storyViewport[2]);
""", 'mobile story camera')
rep("const h=w*cfg.H0/cfg.W0;\n      const to={x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};",
"const h=viewHeightForWidth(w);\n      const to={x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};", 'fly aspect')
rep("view.h = nw * cfg.H0 / cfg.W0;", "view.h = viewHeightForWidth(nw);", 'pinch aspect')
rep("view.y=clamp(my-(my-view.y)*k,-cfg.padY,cfg.H0+cfg.padY-nw*cfg.H0/cfg.W0);\n      view.w=nw;view.h=nw*cfg.H0/cfg.W0;",
"const nh=viewHeightForWidth(nw);\n      view.y=clamp(my-(my-view.y)*k,-cfg.padY,cfg.H0+cfg.padY-nh);\n      view.w=nw;view.h=nh;", 'wheel aspect')
rep("""    function resetView(duration=800){
      const init=route.meta?.viewport_init||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0};
      flyTo(init.cx,init.cy,init.w,duration);
    }
""",
"""    function resetView(duration=800){
      const mobile=matchMedia('(max-width:560px)').matches?route.meta?.mobile_viewport_init:null;
      const raw=mobile||route.meta?.viewport_init||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0};
      const init=Array.isArray(raw)?{cx:raw[0],cy:raw[1],w:raw[2]}:raw;
      flyTo(init.cx,init.cy,init.w,duration);
    }
""", 'reset aspect')
rep("""      const initVp=route.meta?.viewport_init||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0};
      flyTo(initVp.cx,initVp.cy,initVp.w,500);
""",
"""      const raw=matchMedia('(max-width:560px)').matches?(route.meta?.mobile_viewport_init||route.meta?.viewport_init):route.meta?.viewport_init;
      const initVp=Array.isArray(raw)?{cx:raw[0],cy:raw[1],w:raw[2]}:(raw||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0});
      flyTo(initVp.cx,initVp.cy,initVp.w,500);
""", 'reset button')

engine.write_text(s,'utf-8')

r=json.loads(routef.read_text('utf-8'))
m=r.setdefault('meta',{})
m['mobile_viewport_init']={'cx':650,'cy':710,'w':640}
m['mobile_story_viewports']={
 'main':[650,710,640],
 'lekh-lekha':[820,520,760],
 'lot':[650,730,390],
 'war':[655,560,470],
 'akeda':[610,810,430],
}
views={'main':[1000,620,1950],'lekh-lekha':[900,500,1480],'lot':[650,730,720],'war':[655,560,760],'akeda':[610,810,680]}
for story in r.get('stories',[]):
    if story.get('id') in views: story['viewport']=views[story['id']]
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

v=svgf.read_text('utf-8')
v=v.replace('<stop offset="0" stop-color="#22241f"/><stop offset=".45" stop-color="#262318"/><stop offset="1" stop-color="#1d1c14"/>',
            '<stop offset="0" stop-color="#34352c"/><stop offset=".45" stop-color="#393424"/><stop offset="1" stop-color="#2c2b20"/>')
v=v.replace('<stop offset="0" stop-color="#0d1d2e"/><stop offset="1" stop-color="#0a1522"/>',
            '<stop offset="0" stop-color="#12314a"/><stop offset="1" stop-color="#0b2237"/>')
v=v.replace('<stop offset="0" stop-color="#1e2018"/>\n    <stop offset=".35" stop-color="#252318"/>\n    <stop offset=".7" stop-color="#1f1d12"/>\n    <stop offset="1" stop-color="#191710"/>',
            '<stop offset="0" stop-color="#303228"/>\n    <stop offset=".35" stop-color="#383327"/>\n    <stop offset=".7" stop-color="#302d21"/>\n    <stop offset="1" stop-color="#27251c"/>')
v=v.replace('fill="url(#richLandG)" opacity=".3" filter="url(#terrainTex)"','fill="url(#richLandG)" opacity=".48" filter="url(#terrainTex)"')
v=v.replace(' filter="url(#waterRipple)"','')
v=v.replace(' filter="url(#soft)"','')
v=v.replace('stroke="#6b6248" stroke-width="2" fill="none" opacity=".14"','stroke="#8e815f" stroke-width="1.4" fill="none" opacity=".24"')
v=v.replace('<g opacity=".22">','<g opacity=".34">')
v=v.replace('<g opacity=".12">','<g opacity=".22">')
v=v.replace('<stop offset="1" stop-color="#070a10" stop-opacity=".82"/>','<stop offset="1" stop-color="#070a10" stop-opacity=".52"/>')
svgf.write_text(v,'utf-8')
print('PASS2 APPLIED')
