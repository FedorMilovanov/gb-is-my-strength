#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changes = [];

function update(rel, edits) {
  const file = path.join(root, rel);
  let source = fs.readFileSync(file, 'utf8');
  for (const edit of edits) {
    if (source.includes(edit.next)) continue;
    const count = source.split(edit.old).length - 1;
    if (count !== 1) throw new Error(`${rel}: ${edit.label} expected one source match, found ${count}`);
    source = source.replace(edit.old, edit.next);
  }
  const current = fs.readFileSync(file, 'utf8');
  if (source !== current) {
    fs.writeFileSync(file, source, 'utf8');
    changes.push(rel);
  }
}

update('karty/_engine/map-engine.js', [
  {
    label: '44px back target',
    old: `.me-back{display:inline-flex;align-items:center;gap:6px;color:#9aa2ae;font-size:10px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:11px 16px;min-height:36px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);transition:color .2s}`,
    next: `.me-back{display:inline-flex;align-items:center;justify-content:center;gap:6px;color:#9aa2ae;font-size:10px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:11px 16px;min-height:44px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);transition:color .2s}`,
  },
  {
    label: '44px story chip target',
    old: `.me-story-chip{padding:10px 14px;min-height:36px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:11px;cursor:pointer;backdrop-filter:blur(8px);transition:all .2s;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center}`,
    next: `.me-story-chip{padding:10px 14px;min-height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:11px;cursor:pointer;backdrop-filter:blur(8px);transition:all .2s;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center}`,
  },
  {
    label: 'closed panel fully hidden',
    old: `.me-panel{position:absolute;bottom:0;left:0;right:0;box-sizing:border-box;max-height:calc(100% - 8px);max-height:calc(100% - max(8px,env(safe-area-inset-top)));overflow:hidden;background:rgba(13,17,26,.95);backdrop-filter:blur(16px);border-top:1px solid rgba(232,200,121,.2);z-index:20;transition:transform .35s cubic-bezier(.4,0,.2,1);transform:translateY(105%);display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.4)}
.me-panel--open{transform:translateY(0)}`,
    next: `.me-panel{position:absolute;bottom:0;left:0;right:0;box-sizing:border-box;max-height:calc(100% - 8px);max-height:calc(100% - max(8px,env(safe-area-inset-top)));overflow:hidden;background:rgba(13,17,26,.95);backdrop-filter:blur(16px);border-top:1px solid rgba(232,200,121,.2);z-index:20;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .2s ease,visibility 0s linear .35s;transform:translateY(calc(100% + 32px));opacity:0;visibility:hidden;pointer-events:none;display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.4)}
.me-panel--open{transform:translateY(0);opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}`,
  },
  {
    label: '44px tabs',
    old: `.me-tab{padding:8px 14px;font-size:11px;border:none;background:none;color:#9aa2ae;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit;white-space:nowrap;position:relative;top:1px}`,
    next: `.me-tab{padding:8px 14px;min-height:44px;font-size:11px;border:none;background:none;color:#9aa2ae;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit;white-space:nowrap;position:relative;top:1px;display:inline-flex;align-items:center;justify-content:center}`,
  },
  {
    label: '44px panel navigation',
    old: `.me-nav button{flex:0;padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#9aa2ae;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}`,
    next: `.me-nav button{flex:0;padding:6px 14px;min-height:44px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#9aa2ae;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}`,
  },
  {
    label: 'collapsible layer CSS',
    old: `.me-layers{position:absolute;bottom:40px;right:8px;z-index:10;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);font-size:10px}
.me-layers__title{color:#e8c879;font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.me-layers__row{display:flex;align-items:center;gap:6px;margin:3px 0}`,
    next: `.me-layers{position:absolute;bottom:40px;right:8px;z-index:10;padding:0;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);font-size:10px;overflow:hidden;max-width:min(220px,calc(100% - 16px))}
.me-layers__summary{width:100%;min-width:88px;min-height:44px;padding:8px 12px;border:0;background:transparent;color:#e8c879;font:700 9px/1.2 Georgia,'Times New Roman',serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px}
.me-layers__summary::after{content:'▴';font-size:9px;transition:transform .2s ease}
.me-layers:not(.me-layers--expanded) .me-layers__summary::after{transform:rotate(180deg)}
.me-layers__body{padding:0 10px 8px}
.me-layers:not(.me-layers--expanded) .me-layers__body{display:none}
.me-layers__row{display:flex;align-items:center;gap:6px;margin:3px 0}`,
  },
  {
    label: 'quiet mobile chrome',
    old: `@media (max-width:560px){
  .me-layers{bottom:132px;right:6px;max-width:150px;padding:5px 8px;opacity:.94}
  .me-layers__name{white-space:normal;line-height:1.15}
  .me-shortcuts{display:none}
}`,
    next: `@media (max-width:560px){
  .me-header{padding:8px;gap:6px;display:block}
  .me-title,.me-title-he,.me-subtitle{display:none}
  .me-stories{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;margin-top:52px;padding:0 0 4px;scrollbar-width:none;overscroll-behavior-x:contain}
  .me-stories::-webkit-scrollbar{display:none}
  .me-story-chip{flex:0 0 auto}
  .me-search{top:8px;right:112px;width:calc(100% - 232px);min-width:120px;max-width:180px;height:44px;padding:0 10px}
  .me-search:focus{right:112px;width:calc(100% - 128px);max-width:none;background:var(--me-control-bg,rgba(0,0,0,.82));z-index:18}
  .me-theme-btn{top:8px;right:60px}
  .me-share-btn{top:8px;right:8px}
  .me-layers{bottom:64px;right:8px;max-width:min(210px,calc(100% - 16px));opacity:.96}
  .me-layers__name{white-space:normal;line-height:1.15}
  .me-layers--expanded{max-height:calc(100% - 136px);overflow:auto}
  .me-shortcuts{display:none}
  .me-stages{left:8px;right:8px;overflow-x:auto;justify-content:flex-start;scrollbar-width:none}
  .me-stages::-webkit-scrollbar{display:none}
}`,
  },
  {
    label: '44px intro action',
    old: `.me-intro__btn{padding:10px 28px;border-radius:999px;border:1px solid #e8c879;background:rgba(232,200,121,.1);color:#e8c879;font-size:14px;cursor:pointer;font-family:inherit;transition:all .2s}`,
    next: `.me-intro__btn{padding:10px 28px;min-height:44px;border-radius:999px;border:1px solid #e8c879;background:rgba(232,200,121,.1);color:#e8c879;font-size:14px;cursor:pointer;font-family:inherit;transition:all .2s;display:inline-flex;align-items:center;justify-content:center}`,
  },
  {
    label: 'desktop closed panel offset',
    old: `  .me-panel{left:12px;right:auto;bottom:12px;width:420px;max-height:calc(100% - 24px);border-radius:14px;border:1px solid rgba(232,200,121,.2);transform:translateX(-120%)}
  .me-panel--open{transform:translateX(0)}`,
    next: `  .me-panel{left:12px;right:auto;bottom:12px;width:420px;max-height:calc(100% - 24px);border-radius:14px;border:1px solid rgba(232,200,121,.2);transform:translateX(calc(-100% - 32px))}
  .me-panel--open{transform:translateX(0)}`,
  },
  {
    label: 'collapsible layer DOM head',
    old: `      const layerPanel=document.createElement('div');
      layerPanel.className='me-layers';
      layerPanel.innerHTML='<div class="me-layers__title">Слои</div>';
      layerDefinitions.forEach((layer,i)=>{`,
    next: `      const layerPanel=document.createElement('div');
      layerPanel.className='me-layers';
      const layerSummary=document.createElement('button');
      layerSummary.type='button';
      layerSummary.className='me-layers__summary';
      layerSummary.textContent='Слои';
      layerSummary.setAttribute('aria-expanded','false');
      const layerBody=document.createElement('div');
      layerBody.className='me-layers__body';
      layerBody.id=\`me-layers-body-\${mapInstanceToken}\`;
      layerSummary.setAttribute('aria-controls',layerBody.id);
      layerPanel.appendChild(layerSummary);
      layerPanel.appendChild(layerBody);
      _on(layerSummary,'click',()=>{
        const expanded=layerPanel.classList.toggle('me-layers--expanded');
        layerSummary.setAttribute('aria-expanded',expanded?'true':'false');
      });
      layerDefinitions.forEach((layer,i)=>{`,
  },
  {
    label: 'collapsible layer DOM body',
    old: `        row.appendChild(toggle);layerPanel.appendChild(row);
      });
      container.appendChild(layerPanel);`,
    next: `        row.appendChild(toggle);layerBody.appendChild(row);
      });
      container.appendChild(layerPanel);`,
  },
  {
    label: 'clean story focus',
    old: `      // Auto-open first place in story after animation
      _tm(() => {
        const firstPlace = (route.places||[]).find(p => visiblePlaces().some(v => v.id === p.id));
        if (firstPlace && !activePlaceId) open(firstPlace.id);
      }, 600);`,
    next: `      // Story selection focuses the narrative region without forcing a place panel.
      // The reader chooses a place explicitly, preserving a clean map-first state.`,
  },
  {
    label: 'Escape closes nested map surfaces',
    old: `      if(e.key==='Escape'){if(!overlayRuntime)close('escape');return}`,
    next: `      if(e.key==='Escape'){
        if(photoModal.classList.contains('me-photo-modal--open')){closePhoto('escape');return}
        if(activePlaceId||panel.classList.contains('me-panel--open')){close('escape');return}
        if(!overlayRuntime)close('escape');
        return
      }`,
  },
]);

update('scripts/avraam-reference-baseline.mjs', [
  {
    label: 'intro detach wait',
    old: `async function dismissIntro(page){
  const start=page.getByRole('button',{name:/Начать изучение/i});
  if(await start.isVisible().catch(()=>false)){
    await start.click({force:true});
    await page.waitForTimeout(400);
  }
  return !(await start.isVisible().catch(()=>false));
}`,
    next: `async function dismissIntro(page){
  const intro=page.locator('.me-intro');
  const start=page.getByRole('button',{name:/Начать изучение/i});
  if(await start.isVisible().catch(()=>false)){
    await start.click({force:true});
    await intro.waitFor({state:'detached',timeout:1600}).catch(()=>{});
  }
  return (await intro.count())===0;
}`,
  },
  {
    label: 'closed panel class check',
    old: `    result.keyboard.escapeClosedPanel=!(await page.locator(panelSelector).count());`,
    next: `    result.keyboard.escapeClosedPanel=!(await page.locator('.me-panel--open').count());`,
  },
  {
    label: 'geometry canvas source',
    old: `    const map=document.querySelector('.me-map,#mapRoot'),svg=document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg');`,
    next: `    const map=document.querySelector('.me-map,#mapRoot'),canvas=document.querySelector('.me-canvas'),svg=document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg');`,
  },
  {
    label: 'geometry canvas metrics',
    old: `      viewport:{width,height,devicePixelRatio},
      document:{clientWidth:html.clientWidth,scrollWidth:html.scrollWidth,horizontalOverflow:html.scrollWidth-html.clientWidth,clientHeight:html.clientHeight,scrollHeight:html.scrollHeight},
      map:{box:map?rect(map):null,svgBox:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')||null},`,
    next: `      viewport:{width,height,devicePixelRatio,scrollX,scrollY},
      document:{clientWidth:html.clientWidth,scrollWidth:html.scrollWidth,horizontalOverflow:html.scrollWidth-html.clientWidth,clientHeight:html.clientHeight,scrollHeight:html.scrollHeight},
      map:{box:map?rect(map):null,canvasBox:canvas?rect(canvas):null,svgBox:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')||null,canvasTransform:canvas?getComputedStyle(canvas).transform:null,svgTransform:svg?getComputedStyle(svg).transform:null},`,
  },
]);

console.log(changes.length ? `Patched: ${changes.join(', ')}` : 'Patch already materialized.');
