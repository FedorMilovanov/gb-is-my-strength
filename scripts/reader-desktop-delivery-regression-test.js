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
  function run({width=1121,search='',hasState=true,ready='loading',missingCss=-1,missingJs=-1,stallJs=-1,notReady=false,manualLoad=false,hash='',navigation='navigate',targetTop=1500,targetHidden=false}={}) {
    const links=plan.links.map((l,i)=>({...l,sheet:i===missingCss?null:{},events:{},addEventListener(type,fn){this.events[type]=fn;}}));
    const scripts=[],listeners={},errors=[],timers=new Map(),redirects=[];
    const makeMedia=(matches)=>({matches,change:null,addEventListener(type,fn){assert.equal(type,'change');this.change=fn;},
      set(value){this.matches=value;this.change?.({matches:value});}});
    const media=makeMedia(width>=1121),printMedia=makeMedia(false),screenMedia=makeMedia(true);
    let reloads=0,nextTimer=0,nextFrame=0,prepared=false,fragmentScrolls=0;
    const frames=new Map();
    const window={innerWidth:width,innerHeight:900,location:{search,hash,href:'https://example.test/articles/fixture/'+search+'#paragraph',reload(){reloads++;},replace(href){redirects.push(href);}},
      matchMedia(q){if(q===MEDIA)return media;if(q==='print')return printMedia;if(q==='screen')return screenMedia;throw Error('unexpected media '+q);},
      addEventListener(type,fn){listeners[type]=fn;},removeEventListener(type){delete listeners[type];}};
    const target={closest(s){return s==='.faq-accordion__body'?this:targetHidden?this:null;},getBoundingClientRect(){return {height:100,top:targetTop};},scrollIntoView(){fragmentScrolls++;}};
    const document={getElementById(id){return id==='faq-a'?target:null;},documentElement:{hasAttribute(name){assert.equal(name,'data-gb-print-prepared');return prepared;}},
      readyState:ready,querySelectorAll(){return links;},addEventListener(type,fn){listeners[type]=fn;},createElement(tag){assert.equal(tag,'script');return{};},
      body:{classList:{contains(){return !notReady&&scripts.length===6;}},appendChild(script){
        const index=scripts.length;scripts.push(script);
        if(index===missingJs)script.onerror();
        else if(index!==stallJs&&!manualLoad){if(index===5&&!notReady){window.__NP_UNIVERSAL_PREVIEW__={ready:true};window.__NP_W57_ANNOTATIONS__={ready:true};}script.onload();}
      }}};
    const ctx=vm.createContext({window,document,URL,URLSearchParams,AbortController,performance:{getEntriesByType(){return [{type:navigation}]}},console:{error(s){errors.push(s);}},
      setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
      requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}});
    const state=()=>{if(hasState)window.ReaderState={subscribe(){},getSnapshot(){}};};
    if(ready!=='loading')state();
    vm.runInContext(plan.bootstrap.code,ctx);
    const before=scripts.length;
    state(); listeners.DOMContentLoaded?.();
    vm.runInContext(plan.bootstrap.code,ctx);
    return {links,scripts,before,listeners,media,printMedia,screenMedia,errors,redirects,timers,reloads:()=>reloads,
      completeScript(index){assert.equal(scripts.length,index+1);if(index===5&&!notReady){window.__NP_UNIVERSAL_PREVIEW__={ready:true};window.__NP_W57_ANNOTATIONS__={ready:true};}scripts[index].onload();},
      fragmentScrolls:()=>fragmentScrolls,changeHash(value){window.location.hash=value;listeners.hashchange?.({isTrusted:true});},prepared(value){prepared=value;},
      resize(value,height=900){window.innerWidth=value;window.innerHeight=height;listeners.resize?.();},
      flush(){for(const [id,fn] of [...frames]){frames.delete(id);fn();}},
      timeout(){const timer=[...timers.values()].find(t=>t.ms===12000);assert.ok(timer);timer.fn();}};
  }
  let d=run(); assert.ok(d.links.every(l=>l.media===MEDIA)); assert.equal(d.before,0);assert.deepEqual(d.scripts.map(s=>s.src),expected);assert.ok(d.scripts.every(s=>s.async===true));assert.equal(d.timers.size,0);
  const fragment=run({hash:'#faq-a'});fragment.flush();assert.equal(fragment.fragmentScrolls(),1);
  for(const options of [{hash:'#other'},{hash:'#faq-a',targetTop:144},{hash:'#faq-a',targetHidden:true},{hash:'#faq-a',navigation:'back_forward'},{hash:'#faq-a',navigation:'reload'},{hash:'#faq-a',width:390}]){
    const trial=run(options);trial.flush();assert.equal(trial.fragmentScrolls(),0,JSON.stringify(options));
  }
  for(const type of ['wheel','touchstart','pointerdown','keydown','hashchange','pagehide']){
    const trial=run({hash:'#faq-a',manualLoad:true});
    trial.listeners[type]({isTrusted:true});
    for(let i=0;i<6;i++)trial.completeScript(i);
    trial.flush();assert.equal(trial.fragmentScrolls(),0,type);
  }
  const changed=run({hash:'#faq-a'});changed.changeHash('#other');changed.flush();assert.equal(changed.fragmentScrolls(),0);
  const serial=run({manualLoad:true});
  for(let i=0;i<6;i++){assert.deepEqual(serial.scripts.map(s=>s.src),expected.slice(0,i+1));serial.completeScript(i);}
  assert.equal(serial.timers.size,0);assert.equal(serial.redirects.length,0);
  d.media.set(false);d.resize(1120);d.flush();assert.equal(d.reloads(),1);
  let m=run({width:1120});assert.equal(m.scripts.length,0);assert.ok(m.links.every(l=>l.media==='not all'));m.resize(1121);m.flush();assert.equal(m.reloads(),0);m.media.set(true);m.flush();assert.equal(m.reloads(),1);
  let n=run({search:'?reader-pilot=0'});assert.equal(n.scripts.length,0);assert.ok(n.links.every(l=>l.media==='not all'));assert.equal(n.media.change,null);assert.equal(n.listeners.resize,undefined);
  // Model the two independently reported W30 event orders as well as
  // ordinary native print transitions. A width MQL alone must never reload.
  for(const width of [1120,1440]){
    const admitted=width>=1121,other=admitted?800:1440;
    const p=run({width});
    p.media.set(!admitted);p.flush();assert.equal(p.reloads(),0,'early width-only event');
    p.listeners.beforeprint();p.printMedia.set(true);p.screenMedia.set(false);
    p.resize(other);p.flush();assert.equal(p.reloads(),0,'physical print resize');
    p.listeners.afterprint();p.printMedia.set(false);p.screenMedia.set(true);p.flush();
    assert.equal(p.reloads(),0,'late width restoration after afterprint');
    p.media.set(admitted);p.flush();assert.equal(p.reloads(),0,'return without reload');
    // A genuine later screen crossing still reloads exactly once.
    p.resize(other);p.media.set(!admitted);p.flush();assert.equal(p.reloads(),1,'real crossing after print');
    const q=run({width});
    q.prepared(true);q.resize(other);q.media.set(!admitted);q.flush();assert.equal(q.reloads(),0,'prepared marker');
    q.listeners.beforeprint();q.listeners.afterprint();q.prepared(false);q.media.set(admitted);q.flush();assert.equal(q.reloads(),0);
    const s=run({width});s.screenMedia.set(false);s.resize(other);s.media.set(!admitted);s.flush();
    assert.equal(s.reloads(),0,'screen media absent before print event');
  }
  // Chromium screenshot capture transiently reports 1x1 despite a 1440px
  // outer window. It is not a usable screen viewport or a Reader mode switch.
  for(const width of [1120,1440]){
    const admitted=width>=1121,other=admitted?195:1440;
    for(const [w,h] of [[1,1],[0,900],[other,1]]){
      for(const mediaFirst of [false,true]){
        const p=run({width});
        if(mediaFirst)p.media.set(w>=1121);
        p.resize(w,h);if(!mediaFirst)p.media.set(w>=1121);p.flush();
        assert.equal(p.reloads(),0,'degenerate viewport must not reload');
        p.resize(width,900);p.media.set(admitted);p.flush();
        assert.equal(p.reloads(),0,'restored viewport must not reload');
        p.resize(other,320);p.media.set(!admitted);p.flush();
        assert.equal(p.reloads(),1,'real crossing, including 195px zoom, remains active');
      }
    }
  }
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
  console.log('PASS: admission, manifest URL order and 12 exact bytes, fail-before-copy, bootstrap hash, 1120/1121, opt-out, native readiness, duplicate bootstrap, viewport crossing, print lifecycle and adversarial event order, CSS/JS errors, timeout, readiness and loop-free Classic rollback');
} finally { rmSync(root,{recursive:true,force:true}); }
