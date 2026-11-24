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
  function run({width=1121,search='',hasState=true,ready='loading'}={}) {
    const links=plan.links.map(l=>({...l})), scripts=[], listeners={}, errors=[];
    const media={matches:width>=1121,addEventListener(type,fn){listeners[type]=fn;}};
    let reloads=0;
    const window={location:{search,reload(){reloads++;}},matchMedia(q){assert.equal(q,MEDIA);return media;}};
    const document={readyState:ready,querySelectorAll(){return links;},addEventListener(type,fn){listeners[type]=fn;},createElement(tag){assert.equal(tag,'script');return{};},body:{appendChild(script){scripts.push(script);}}};
    const ctx=vm.createContext({window,document,URLSearchParams,console:{error(s){errors.push(s);}}});
    const state=()=>{if(hasState)window.ReaderState={subscribe(){},getSnapshot(){}};};
    if(ready!=='loading')state();
    vm.runInContext(plan.bootstrap.code,ctx);
    const before=scripts.length;
    state(); listeners.DOMContentLoaded?.();
    vm.runInContext(plan.bootstrap.code,ctx); // duplicate execution must be a no-op
    return {links,scripts,before,listeners,media,errors,reloads:()=>reloads};
  }
  let d=run(); assert.ok(d.links.every(l=>l.media===MEDIA)); assert.equal(d.before,0);assert.deepEqual(d.scripts.map(s=>s.src),expected);assert.ok(d.scripts.every(s=>s.async===false));
  d.media.matches=false;d.listeners.change();assert.equal(d.reloads(),1);
  let m=run({width:1120});assert.equal(m.scripts.length,0);assert.ok(m.links.every(l=>l.media==='not all'));m.media.matches=true;m.listeners.change();assert.equal(m.reloads(),1);
  let n=run({search:'?reader-pilot=0'});assert.equal(n.scripts.length,0);assert.ok(n.links.every(l=>l.media==='not all'));assert.equal(n.listeners.change,undefined);
  let f=run({hasState:false});assert.equal(f.scripts.length,0);assert.ok(f.links.every(l=>l.media==='not all'));assert.equal(f.errors.length,1);
  assert.deepEqual(run({ready:'complete'}).scripts.map(s=>s.src),expected);
  const repeated=run({search:'?reader-pilot=0&reader-pilot=1'});assert.deepEqual(repeated.scripts.map(s=>s.src),expected);
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
  console.log('PASS: admission, manifest URL order and 12 exact bytes, fail-before-copy, bootstrap hash, 1120/1121, opt-out, native readiness, duplicate bootstrap, viewport crossing');
} finally { rmSync(root,{recursive:true,force:true}); }
