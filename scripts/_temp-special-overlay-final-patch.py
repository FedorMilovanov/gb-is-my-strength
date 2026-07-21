#!/usr/bin/env python3
from pathlib import Path
import json


def replace_exact(path, old, new, label):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


site_path = Path('js/site.js')
site_text = site_path.read_text(encoding='utf-8')

old_escape = 'document.addEventListener("keydown",function(e){t.classList.contains("is-open")&&r.isEscape(e)&&(e.stopImmediatePropagation(),u())})'
new_escape = 'document.addEventListener("keydown",function(e){!(window.OverlayRuntime||window.SiteUtils&&window.SiteUtils.OverlayRuntime)&&t.classList.contains("is-open")&&r.isEscape(e)&&(e.stopImmediatePropagation(),u())})'
if site_text.count(old_escape) != 1:
    raise SystemExit(f'site image Escape anchor: {site_text.count(old_escape)}')
site_text = site_text.replace(old_escape, new_escape, 1)

old_open = 'function d(e,r,d,u){if(!t.classList.contains("is-open")&&(null!==l&&(clearTimeout(l),l=null),a=document.activeElement,s=!!u,i.src=e,i.alt=r||"",o.textContent=d||"",t.classList.add("is-open"),document.documentElement.style.overflow="hidden",t.removeEventListener("keydown",c),t.addEventListener("keydown",c),n))try{n.focus({preventScroll:!0})}catch(e){n.focus()}}'
new_open = 'function d(e,r,d,h){if(!t.classList.contains("is-open")){var p=window.OverlayRuntime||window.SiteUtils&&window.SiteUtils.OverlayRuntime;null!==l&&(clearTimeout(l),l=null,p&&p.close&&p.close("site-image-viewer","reopen",{restoreFocus:!1})),a=document.activeElement,s=!!h,i.src=e,i.alt=r||"",o.textContent=d||"",t.classList.add("is-open"),p&&p.open?p.open("site-image-viewer",{element:t,opener:a,focusTarget:n,onRequestClose:function(){return u(),!1},closeOnEscape:!0,trapFocus:!0,restoreFocus:!0}):(window.SiteUtils&&window.SiteUtils.lockScroll&&window.SiteUtils.lockScroll("site-image-viewer"),t.removeEventListener("keydown",c),t.addEventListener("keydown",c),n&&function(){try{n.focus({preventScroll:!0})}catch(e){n.focus()}}())}}'
if site_text.count(old_open) != 1:
    raise SystemExit(f'site image open anchor: {site_text.count(old_open)}')
site_text = site_text.replace(old_open, new_open, 1)

old_close = 'function u(){t.classList.contains("is-open")&&(t.classList.remove("is-open"),t.removeEventListener("keydown",c),l=setTimeout(function(){if(l=null,document.documentElement.style.overflow="",s&&a&&a.focus)try{a.focus({preventScroll:!0})}catch(e){a.focus()}a=null,s=!1,i.removeAttribute("src"),o.textContent=""},290))}'
new_close = 'function u(){t.classList.contains("is-open")&&(t.classList.remove("is-open"),t.removeEventListener("keydown",c),l=setTimeout(function(){var e=window.OverlayRuntime||window.SiteUtils&&window.SiteUtils.OverlayRuntime;if(l=null,e&&e.close?e.close("site-image-viewer","transition-end"):window.SiteUtils&&window.SiteUtils.unlockScroll&&window.SiteUtils.unlockScroll("site-image-viewer"),(!e||!e.close)&&s&&a&&a.focus)try{a.focus({preventScroll:!0})}catch(e){a.focus()}a=null,s=!1,i.removeAttribute("src"),o.textContent=""},290))}'
if site_text.count(old_close) != 1:
    raise SystemExit(f'site image close anchor: {site_text.count(old_close)}')
site_text = site_text.replace(old_close, new_close, 1)

old_menu_open = 'window.SiteUtils&&window.SiteUtils.lockScroll?window.SiteUtils.lockScroll("home-mobile-menu"):document.body.style.overflow="hidden"'
new_menu_open = 'window.SiteUtils&&window.SiteUtils.lockScroll&&window.SiteUtils.lockScroll("home-mobile-menu")'
if site_text.count(old_menu_open) != 1:
    raise SystemExit(f'mobile menu open anchor: {site_text.count(old_menu_open)}')
site_text = site_text.replace(old_menu_open, new_menu_open, 1)

old_menu_close = 'window.SiteUtils&&window.SiteUtils.unlockScroll?window.SiteUtils.unlockScroll("home-mobile-menu"):document.body.style.overflow=""'
new_menu_close = 'window.SiteUtils&&window.SiteUtils.unlockScroll&&window.SiteUtils.unlockScroll("home-mobile-menu")'
if site_text.count(old_menu_close) != 1:
    raise SystemExit(f'mobile menu close anchor: {site_text.count(old_menu_close)}')
site_text = site_text.replace(old_menu_close, new_menu_close, 1)
site_path.write_text(site_text, encoding='utf-8')

built_path = Path('konfessii/russkij-baptizm/_app/index.html')
built = built_path.read_text(encoding='utf-8')
if built.count('</head>') != 1:
    raise SystemExit(f'built head anchor: {built.count("</head>")}')
built = built.replace('</head>', '<script src="../../../js/site-utils.js"></script></head>', 1)

old_prefix = 'function Rq(){const[n,e]=ie.useState(!1),[t,i]=ie.useState(!1),{theme:s}=Gf(),r=s==="light",a=ie.useCallback(()=>{iL(()=>Promise.resolve().then(()=>IB),void 0,import.meta.url)},[]),o=ie.useCallback(()=>{i(!0),e(!0),document.body.style.overflow="hidden",setTimeout(()=>i(!1),1800)},[]),u=ie.useCallback(()=>{e(!1),i(!1),document.body.style.overflow=""},[]);ie.useEffect(()=>()=>{document.body.style.overflow=""},[]),ie.useEffect(()=>{if(!n)return;const p=m=>{m.key==="Escape"&&u()};return window.addEventListener("keydown",p),()=>window.removeEventListener("keydown",p)},[n,u]);const d=r?"#7c6540":"#c4a67e",h=r?"#a87e4a":"#ddb87a";'
new_prefix = 'function Rq(){const[n,e]=ie.useState(!1),[t,i]=ie.useState(!1),{theme:s}=Gf(),r=s==="light",f="special:konfessii-mindmap-launcher",a=ie.useCallback(()=>{iL(()=>Promise.resolve().then(()=>IB),void 0,import.meta.url)},[]),o=ie.useCallback(()=>{i(!0),e(!0),setTimeout(()=>i(!1),1800)},[]),u=ie.useCallback(()=>{const p=window.OverlayRuntime||window.SiteUtils&&window.SiteUtils.OverlayRuntime;p&&p.close?p.close(f,"close"):window.SiteUtils&&window.SiteUtils.unlockScroll&&window.SiteUtils.unlockScroll(f),e(!1),i(!1)},[]);ie.useEffect(()=>{if(!n)return;const p=window.OverlayRuntime||window.SiteUtils&&window.SiteUtils.OverlayRuntime,m=document.getElementById("konfessii-mindmap-overlay"),y=m&&m.querySelector(\'button[title^="Закрыть 3D-карту"]\');if(p&&p.open)return p.open(f,{element:m,opener:document.activeElement,focusTarget:y,onRequestClose:function(){return u(),!1},closeOnEscape:!0,trapFocus:!0,restoreFocus:!0}),()=>{p.isOpen&&p.isOpen(f)&&p.close(f,"unmount",{restoreFocus:!1})};window.SiteUtils&&window.SiteUtils.lockScroll&&window.SiteUtils.lockScroll(f);const x=S=>{S.key==="Escape"&&u()};return window.addEventListener("keydown",x),()=>{window.removeEventListener("keydown",x),window.SiteUtils&&window.SiteUtils.unlockScroll&&window.SiteUtils.unlockScroll(f)}},[n,u]);const d=r?"#7c6540":"#c4a67e",h=r?"#a87e4a":"#ddb87a";'
if built.count(old_prefix) != 1:
    raise SystemExit(f'built launcher prefix: {built.count(old_prefix)}')
built = built.replace(old_prefix, new_prefix, 1)
old_root = 'className:"fixed inset-0 z-[9999]",style:{background:"#050508"}'
new_root = 'id:"konfessii-mindmap-overlay",className:"fixed inset-0 z-[9999]",style:{background:"#050508"}'
if built.count(old_root) != 1:
    raise SystemExit(f'built launcher root: {built.count(old_root)}')
built = built.replace(old_root, new_root, 1)
built_path.write_text(built, encoding='utf-8')

contract_path = Path('scripts/overlay-runtime-contract-test.js')
contract = contract_path.read_text(encoding='utf-8')
contract = contract.replace("const mindMap3D = fs.readFileSync('_build-tools/konfessii-baptizm/MindMap3D.tsx', 'utf8');", "const mindMap3D = fs.readFileSync('_build-tools/konfessii-baptizm/MindMap3D.tsx', 'utf8');\nconst builtMindMap = fs.readFileSync('konfessii/russkij-baptizm/_app/index.html', 'utf8');")
needle = "assert.ok(mindMap3D.includes('runtime.lockScroll(fullscreenOverlayOwner)') && mindMap3D.includes('runtime.unlockScroll(fullscreenOverlayOwner)'), 'MindMap3D must delegate fullscreen lock lifecycle to OverlayRuntime');\n"
extra = """assert.ok(mindMap3D.includes('runtime.lockScroll(fullscreenOverlayOwner)') && mindMap3D.includes('runtime.unlockScroll(fullscreenOverlayOwner)'), 'MindMap3D must delegate fullscreen lock lifecycle to OverlayRuntime');
assert.ok(!specialDirectWriter.test(site), 'site.js overlays and menu fallbacks must not write html/body lock styles');
assert.ok(!specialDirectWriter.test(builtMindMap), 'committed MindMap launcher must not write html/body lock styles');
assert.ok(site.includes('site-image-viewer'), 'site image viewer must have a canonical owner');
assert.ok(builtMindMap.includes('special:konfessii-mindmap-launcher'), 'built MindMap launcher must have a canonical owner');
assert.ok(builtMindMap.includes('id:\"konfessii-mindmap-overlay\"'), 'built MindMap launcher must expose its overlay root');
assert.ok(builtMindMap.includes('../../../js/site-utils.js'), 'built MindMap launcher must load canonical runtime');
"""
if contract.count(needle) != 1:
    raise SystemExit(f'contract insertion anchor: {contract.count(needle)}')
contract_path.write_text(contract.replace(needle, extra, 1), encoding='utf-8')

writer_test = r'''#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const child = require('node:child_process');

const tracked = child.execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const extensions = new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.astro','.html']);
const excluded = ['scripts/','docs/','.github/','reports/','archive/','projects/','node_modules/','dist/'];
const canonical = new Set(['js/site-utils.js']);
const direct = /document\.(?:body|documentElement)\.style\.(?:overflow|position|top|left|right|width|overscrollBehavior)\s*=/g;
const alias = /(?<![\w.])(?:body|html)\.style\.(?:overflow|position|top|left|right|width|overscrollBehavior)\s*=/g;
const hits = [];

for (const file of tracked) {
  if (!extensions.has(path.extname(file).toLowerCase())) continue;
  if (canonical.has(file) || excluded.some(prefix => file.startsWith(prefix))) continue;
  let source;
  try { source = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const pattern of [direct, alias]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      hits.push(`${file}:${source.slice(0, match.index).split('\n').length}:${match[0]}`);
    }
  }
}

assert.deepEqual(hits, [], `direct production lock writers remain:\n${hits.join('\n')}`);
const site = fs.readFileSync('js/site.js','utf8');
const built = fs.readFileSync('konfessii/russkij-baptizm/_app/index.html','utf8');
assert.ok(site.includes('site-image-viewer'));
assert.ok(site.includes('home-mobile-menu'));
assert.ok(built.includes('special:konfessii-mindmap-launcher'));
assert.ok(built.includes('../../../js/site-utils.js'));
console.log('✅ special-overlay-writer-regression-test: zero non-canonical production writers');
'''
Path('scripts/special-overlay-writer-regression-test.js').write_text(writer_test, encoding='utf-8')

browser_test = r'''#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const playwright = require('playwright');

const browserName = process.env.PW_BROWSER || 'chromium';
const browserType = playwright[browserName];
if (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);
const siteUtils = fs.readFileSync('js/site-utils.js','utf8');
const mapEngine = fs.readFileSync('karty/_engine/map-engine.js','utf8');
const builtMindMap = fs.readFileSync('konfessii/russkij-baptizm/_app/index.html','utf8');
const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const route = {meta:{id:'special-witness',title:'Witness',viewport_init:{cx:500,cy:350,w:1000}},stages:[{n:'I',t:'Stage'}],stories:[{id:'main',label:'Main',places:['p1'],stage_ids:[0],active_by_default:true}],places:[{id:'p1',name:'Place',stage:0,x:500,y:350,story:'Story',photos:[{thumb:pixel,src:pixel,label:'Photo',credit:'Fixture'}]}]};

async function builtLauncherWitness(browser) {
  const page = await browser.newPage({viewport:{width:844,height:620}});
  try {
    await page.route('https://fixture.test/**', async request => {
      const url = new URL(request.request().url());
      if (url.pathname === '/konfessii/russkij-baptizm/_app/index.html') return request.fulfill({status:200,contentType:'text/html',body:builtMindMap});
      if (url.pathname === '/js/site-utils.js') return request.fulfill({status:200,contentType:'application/javascript',body:siteUtils});
      return request.abort();
    });
    await page.goto('https://fixture.test/konfessii/russkij-baptizm/_app/index.html');
    await page.waitForFunction(() => window.OverlayRuntime && document.body.textContent.includes('Войти в 3D-карту'));
    await page.evaluate(() => {
      document.body.style.overflow='auto'; document.body.style.position='relative'; document.body.style.top='4px';
      const button=[...document.querySelectorAll('button')].find(item=>item.textContent.includes('Войти в 3D-карту'));
      button.focus({preventScroll:true});
      window.OverlayRuntime.open('foreign:witness',{lockScroll:true,trapFocus:false,restoreFocus:false});
      button.click();
    });
    await page.waitForFunction(() => document.getElementById('konfessii-mindmap-overlay') && window.OverlayRuntime.size() === 2);
    let state = await page.evaluate(() => ({size:window.OverlayRuntime.size(),top:window.OverlayRuntime.topLayer()?.ownerId,position:document.body.style.position}));
    assert.deepEqual(state,{size:2,top:'special:konfessii-mindmap-launcher',position:'fixed'});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('konfessii-mindmap-overlay') && window.OverlayRuntime.size() === 1);
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Войти в 3D-карту'));
    state = await page.evaluate(() => ({size:window.OverlayRuntime.size(),top:window.OverlayRuntime.topLayer()?.ownerId,position:document.body.style.position}));
    assert.deepEqual(state,{size:1,top:'foreign:witness',position:'fixed'});
    await page.evaluate(() => window.OverlayRuntime.close('foreign:witness','test'));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    state = await page.evaluate(() => ({overflow:document.body.style.overflow,position:document.body.style.position,top:document.body.style.top}));
    assert.deepEqual(state,{overflow:'auto',position:'relative',top:'4px'});

    await page.evaluate(() => [...document.querySelectorAll('button')].find(item=>item.textContent.includes('Войти в 3D-карту')).click());
    await page.waitForFunction(() => window.OverlayRuntime.size() === 1);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
  } finally { await page.close(); }
}

async function mapOwnershipWitness(browser) {
  const html='<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;min-height:1800px}#map{height:390px;width:844px;position:relative}</style></head><body style="overflow:auto;position:relative;top:4px"><button id="outside">Open</button><div id="map"></div></body></html>';
  const page = await browser.newPage({viewport:{width:844,height:390}});
  try {
    await page.setContent(html);
    await page.addScriptTag({content:siteUtils});
    await page.addScriptTag({content:mapEngine});
    await page.evaluate(route => {
      document.getElementById('outside').focus({preventScroll:true});
      window.OverlayRuntime.open('foreign:map',{lockScroll:true,trapFocus:false,restoreFocus:false});
      window.mapWitness=MapEngine.createMap(document.getElementById('map'),route,{showIntro:false,showCompass:false});
      window.mapWitness.open('p1');
    }, route);
    await page.waitForFunction(() => window.OverlayRuntime.size() === 2);
    await page.evaluate(() => {
      document.querySelector('.me-tab[data-tab="photos"]').click();
      const image=document.querySelector('.me-clickable-photo'); image.tabIndex=0; image.focus({preventScroll:true}); image.click();
    });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 3);
    await page.evaluate(() => { window.mapWitness.destroy(); window.mapWitness.destroy(); });
    await page.waitForFunction(() => window.OverlayRuntime.size() === 1);
    let state = await page.evaluate(() => ({top:window.OverlayRuntime.topLayer()?.ownerId,position:document.body.style.position,children:document.getElementById('map').children.length}));
    assert.deepEqual(state,{top:'foreign:map',position:'fixed',children:0});
    await page.evaluate(() => window.OverlayRuntime.close('foreign:map','test'));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0);
    state = await page.evaluate(() => ({overflow:document.body.style.overflow,position:document.body.style.position,top:document.body.style.top}));
    assert.deepEqual(state,{overflow:'auto',position:'relative',top:'4px'});
  } finally { await page.close(); }
}

async function mapFallbackWitness(browser) {
  const page = await browser.newPage({viewport:{width:844,height:390}});
  try {
    await page.setContent('<!doctype html><html><body><button id="outside">Open</button><div id="map" style="height:390px;width:844px;position:relative"></div></body></html>');
    await page.evaluate(() => { window.SiteUtils={locks:[],unlocks:[],lockScroll(id){this.locks.push(id)},unlockScroll(id){this.unlocks.push(id)}}; });
    await page.addScriptTag({content:mapEngine});
    await page.evaluate(route => { document.getElementById('outside').focus(); window.fallbackMap=MapEngine.createMap(document.getElementById('map'),route,{showIntro:false,showCompass:false}); window.fallbackMap.open('p1'); }, route);
    await page.waitForFunction(() => window.SiteUtils.locks.length === 1);
    await page.evaluate(() => { document.querySelector('.me-tab[data-tab="photos"]').click(); const image=document.querySelector('.me-clickable-photo'); image.tabIndex=0; image.focus(); image.click(); });
    await page.waitForFunction(() => window.SiteUtils.locks.length === 2);
    await page.click('.me-photo-modal__close');
    await page.waitForFunction(() => window.SiteUtils.unlocks.length === 1);
    await page.waitForFunction(() => document.activeElement?.classList?.contains('me-clickable-photo'));
    await page.click('.me-panel__close');
    await page.waitForFunction(() => window.SiteUtils.unlocks.length === 2);
    const state=await page.evaluate(() => ({locks:window.SiteUtils.locks,unlocks:window.SiteUtils.unlocks}));
    assert.equal(state.locks.length,2); assert.equal(state.unlocks.length,2);
    assert.match(state.locks[0],/:panel$/); assert.match(state.locks[1],/:photo$/);
    window;
  } finally { await page.close(); }
}

(async()=>{
  const browser=await browserType.launch({headless:true});
  try {
    await builtLauncherWitness(browser);
    await mapOwnershipWitness(browser);
    await mapFallbackWitness(browser);
    console.log(`✅ special-overlay-runtime-browser-test [${browserName}]: built launcher + foreign owner + double destroy + fallback`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
'''
Path('scripts/special-overlay-runtime-browser-test.js').write_text(browser_test, encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package['scripts']['overlay:special:writers:test'] = 'node scripts/special-overlay-writer-regression-test.js'
package['scripts']['overlay:special:browser:test'] = 'node scripts/special-overlay-runtime-browser-test.js'
package['scripts']['overlay:browser:all'] = 'npm run overlay:browser:test && npm run overlay:map:browser:test && npm run overlay:special:browser:test'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('✅ final special overlay patch materialized')
