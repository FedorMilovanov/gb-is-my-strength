'use strict';
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { createDesktopDelivery, PREFIX, MEDIA } = require('./lib/reader-desktop-delivery.js');
const hash = input => createHash('sha256').update(input).digest('hex');
const root = mkdtempSync(join(tmpdir(), 'reader-desktop-delivery-'));
try {
  const source = join(root,'source'), dist = join(root,'dist');
  mkdirSync(source); mkdirSync(dist);
  const make = (ext, index) => {
    const name = `reader_fixture_${index}.${ext}`;
    const bytes = Buffer.from(`${ext}:${index}`);
    writeFileSync(join(source,name),bytes);
    return {name,bytes:bytes.length,sha256:hash(bytes)};
  };
  const contract = {routes:['/articles/fixture/'],styles:Array.from({length:6},(_,i)=>make('css',i)),scripts:Array.from({length:6},(_,i)=>make('js',i))};
  const delivery = createDesktopDelivery(contract);
  const plan = delivery.headFor('/articles/fixture/');
  assert.equal(delivery.headFor('/articles/'), null);
  assert.equal(delivery.headFor('/journal/dossiers/g3/'), null);
  assert.equal(delivery.headFor('/nagornaya/chast-1/'), null);
  assert.equal(plan.links.length,6);
  assert.deepEqual(plan.links.map(l=>l.href),contract.styles.map(a=>`${PREFIX}${a.name}?v=${a.sha256}`));
  assert.ok(plan.links.every(l=>l.media==='not all'));
  assert.equal(hash(plan.bootstrap.code),plan.bootstrap.sha256);
  assert.equal(delivery.materializeAssets(dist,source).length,12);
  assert.equal(hash(readFileSync(join(dist,PREFIX.slice(1),'bootstrap.js'))),plan.bootstrap.sha256);
  for(const asset of [...contract.styles,...contract.scripts]) assert.equal(hash(readFileSync(join(dist,PREFIX.slice(1),asset.name))),asset.sha256);
  writeFileSync(join(source,contract.scripts[5].name),'tampered');
  const rejected = join(root,'rejected');
  assert.throws(()=>delivery.materializeAssets(rejected,source),/asset drift/);
  assert.equal(existsSync(rejected),false,'all bytes must be checked before any copy');
  const expected = contract.scripts.map(a=>`${PREFIX}${a.name}?v=${a.sha256}`);
  function run({width=1121,search='',hasState=true,ready='loading',missingCss=-1,missingJs=-1,stallJs=-1,notReady=false}={}) {
    const links=plan.links.map((l,i)=>({...l,sheet:i===missingCss?null:{},events:{},addEventListener(type,fn){this.events[type]=fn;}}));
    const scripts=[],listeners={},errors=[],timers=new Map(),redirects=[];
    const media={matches:width>=1121,addEventListener(type,fn){listeners[type]=fn;}};
    let reloads=0,nextTimer=0;
    const window={location:{search,href:'https://example.test/articles/fixture/'+search+'#paragraph',reload(){reloads++;},replace(href){redirects.push(href);}},
      matchMedia(q){assert.equal(q,MEDIA);return media;},addEventListener(type,fn){listeners[type]=fn;},removeEventListener(type){delete listeners[type];}};
    const document={readyState:ready,querySelectorAll(){return links;},addEventListener(type,fn){listeners[type]=fn;},createElement(tag){assert.equal(tag,'script');return{};},
      body:{classList:{contains(){return !notReady&&scripts.length===6;}},appendChild(script){
        const index=scripts.length;scripts.push(script);
        if(index===missingJs)script.onerror();
        else if(index!==stallJs){if(index===5&&!notReady){window.__NP_UNIVERSAL_PREVIEW__={ready:true};window.__NP_W57_ANNOTATIONS__={ready:true};}script.onload();}
      }}};
    const ctx=vm.createContext({window,document,URL,URLSearchParams,console:{error(s){errors.push(s);}},
      setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}});
    const state=()=>{if(hasState)window.ReaderState={subscribe(){},getSnapshot(){}};};
    if(ready!=='loading')state();
    vm.runInContext(plan.bootstrap.code,ctx);
    const before=scripts.length;
    state(); listeners.DOMContentLoaded?.();
    vm.runInContext(plan.bootstrap.code,ctx);
    return {links,scripts,before,listeners,media,errors,redirects,timers,reloads:()=>reloads,
      timeout(){const timer=[...timers.values()].find(t=>t.ms===12000);assert.ok(timer);timer.fn();}};
  }
  let d=run(); assert.ok(d.links.every(l=>l.media===MEDIA)); assert.equal(d.before,0);assert.deepEqual(d.scripts.map(s=>s.src),expected);assert.ok(d.scripts.every(s=>s.async===false));assert.equal(d.timers.size,0);
  d.media.matches=false;d.listeners.change();assert.equal(d.reloads(),1);
  let m=run({width:1120});assert.equal(m.scripts.length,0);assert.ok(m.links.every(l=>l.media==='not all'));m.media.matches=true;m.listeners.change();assert.equal(m.reloads(),1);
  let n=run({search:'?reader-pilot=0'});assert.equal(n.scripts.length,0);assert.ok(n.links.every(l=>l.media==='not all'));assert.equal(n.listeners.change,undefined);
  function fallbackState(result) {
    assert.equal(result.redirects.length,1);assert.ok(result.links.every(l=>l.media==='not all'));assert.equal(result.errors.length,1);
    const url=new URL(result.redirects[0]);assert.equal(url.searchParams.get('reader-pilot'),'0');assert.equal(url.hash,'#paragraph');
    assert.equal(run({search:url.search}).redirects.length,0,'Classic fallback cannot loop');
  }
  let f=run({hasState:false});assert.equal(f.scripts.length,0);fallbackState(f);
  assert.deepEqual(run({ready:'complete'}).scripts.map(s=>s.src),expected);
  const repeated=run({search:'?reader-pilot=0&reader-pilot=1'});assert.deepEqual(repeated.scripts.map(s=>s.src),expected);
  let css=run({missingCss:2,search:'?paper=space&panel=open&reader-pilot=1'});assert.equal(css.scripts.length,0);css.links[2].events.error();fallbackState(css);assert.equal(new URL(css.redirects[0]).searchParams.get('paper'),'space');assert.equal(new URL(css.redirects[0]).searchParams.get('panel'),'open');
  let js=run({missingJs:4});assert.equal(js.scripts.length,5);fallbackState(js);
  let stall=run({stallJs:3});assert.equal(stall.scripts.length,4);stall.timeout();fallbackState(stall);
  let unready=run({notReady:true});unready.timeout();fallbackState(unready);
  let cssStall=run({missingCss:1});cssStall.timeout();fallbackState(cssStall);
  // Verify the actual build projector against fixture HTML, not HTTP rewriting.
  const { projectDesktopDist } = require('./lib/reader-desktop-dist');
  const output=join(root,'projected');
  const article=join(output,'articles','fixture'), catalog=join(output,'articles');
  mkdirSync(article,{recursive:true});
  const native='<html><head><link rel="stylesheet" href="/native.css"></head><body>original</body></html>';
  writeFileSync(join(article,'index.html'),native);writeFileSync(join(catalog,'index.html'),native);
  writeFileSync(join(source,contract.scripts[5].name),'js:5');
  assert.deepEqual(projectDesktopDist({distDir:output,sourceDir:source,contract}),{routes:1,assets:13});
  const html=readFileSync(join(article,'index.html'),'utf8');
  assert.ok(html.indexOf('/native.css')<html.indexOf('data-gb-reader-desktop-css'));
  assert.equal((html.match(/data-gb-reader-desktop-css/g)||[]).length,6);
  assert.equal((html.match(/data-gb-reader-desktop-bootstrap/g)||[]).length,1);
  assert.ok(html.includes('media="not all"'));
  assert.ok(html.endsWith('<body>original</body></html>'));
  assert.equal(readFileSync(join(catalog,'index.html'),'utf8'),native);
  assert.throws(()=>projectDesktopDist({distDir:output,sourceDir:source,contract}),/duplicate desktop head/);
  console.log('PASS: admission, manifest URL order and 12 exact bytes, fail-before-copy, bootstrap hash, 1120/1121, opt-out, native readiness, duplicate bootstrap, viewport crossing, CSS/JS errors, timeout, readiness and loop-free Classic rollback');
} finally { rmSync(root,{recursive:true,force:true}); }
