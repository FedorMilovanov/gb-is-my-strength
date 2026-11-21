import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CATALOG_RESUME_KEY as key, catalogItemId, catalogReturnHref, catalogReturnItem, catalogResume, isCatalogActivation, installCatalogNavigation } from '../src/components/articles/articlesCatalogNavigation.ts';

const href='/articles/svoboda-vo-hriste/', next='/articles/skrytye-idoly-serdca/', url='https://example.test/articles/';
function fixture(hash='') {
  const listeners=new Map(),calls=[],body={},html={},nodes=new Map();
  const document={body,documentElement:html,activeElement:body,getElementById:id=>nodes.get(id)??null};
  function anchor(href){const a={id:catalogItemId(href),href:'https://example.test'+href,origin:'https://example.test',target:'',dataset:{catalogRoute:href},hasAttribute:n=>n==='download'&&!!a.download,getAttribute:n=>n==='href'?href:null,closest:()=>a,matches:()=>true,focus:options=>{document.activeElement=a;calls.push({href,options});}};nodes.set(a.id,a);return a;}
  const links=[anchor(href),anchor(next)];
  const topic={id:'catalog-topic-богословие',matches:()=>true,focus:options=>{document.activeElement=topic;calls.push({topic:true,options});}};nodes.set(topic.id,topic);
  const catalog={dataset:{},ownerDocument:document,contains:n=>[...nodes.values()].includes(n),querySelectorAll:()=>links};
  const view={location:{href:url+hash,origin:'https://example.test',hash},performance:{getEntriesByType:()=>[{type:view.navigationType}]},navigationType:'navigate',history:{state:{foreign:{preserved:true}},length:2,replaceState(state,...args){this.state=state;calls.push({state,args});}},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);}};
  const emit=(name,event={})=>{for(const fn of listeners.get(name)??[])fn(event);};
  const event=(patch={})=>({isTrusted:true,defaultPrevented:false,button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,target:links[0],...patch});
  const cleanup=installCatalogNavigation(catalog,view);
  const depart=(patch={})=>{const e=event(patch);emit('click',e);emit('pagehide');return e;};
  return{document,catalog,view,links,topic,calls,emit,event,depart,cleanup};
}

test('SSR item anchor is lossless, deterministic and a native fragment',()=>{
  for(const original of [href,next,'/path/a-b/','/path-a/b/','/кириллица/','/a/#part','/a/?b=c']){
    assert.equal(decodeURIComponent(new URL(catalogReturnHref(original),url).hash.slice(1)),catalogItemId(original));
  }
  assert.notEqual(catalogItemId('/path/a-b/'),catalogItemId('/path-a/b/'));
});
for(const field of ['status','publicationStatus','publicationGate']){
  test(`SSR return respects ${field} HOLD on either existing authority`,()=>{
    const item={type:'article',url:href};
    assert.equal(catalogReturnItem(href,[{...item,[field]:'PUBLICATION_HOLD'}],{[href]:{status:'production-dist'}}),undefined);
    assert.equal(catalogReturnItem(href,[item],{[href]:{status:'production-dist',[field]:'PUBLICATION_HOLD'}}),undefined);
  });
}
test('SSR return needs the real article AND positive published route; no series/orphan shortcut',()=>{
  const item={type:'article',url:href};
  assert.equal(catalogReturnItem(href,[item],{[href]:{status:'production-dist'}}),item);
  for(const [items,routes] of [[[],{[href]:{status:'production-dist'}}],[[item],{}],[[item],{[href]:{status:'draft'}}],[[{...item,type:'series'}],{[href]:{status:'production-dist'}}]]){
    assert.equal(catalogReturnItem(href,items,routes),undefined);
  }
});
test('identity is saved only at real departure; URL/history length and foreign state survive',()=>{
  const f=fixture();f.emit('click',f.event());assert.deepEqual(f.view.history.state,{foreign:{preserved:true}});
  f.emit('pagehide');assert.deepEqual(f.view.history.state.foreign,{preserved:true});
  assert.deepEqual(f.view.history.state[key],{version:1,url,href});assert.equal(f.view.history.length,2);
  assert.deepEqual(f.calls[0].args,['']);assert.equal(f.view.location.href,url);
});
for(const [name,patch] of [['Ctrl',{ctrlKey:true}],['Meta',{metaKey:true}],['Shift',{shiftKey:true}],['Alt',{altKey:true}],['middle',{button:1}],['right',{button:2}],['cancelled',{defaultPrevented:true}],['synthetic',{isTrusted:false}]]){
  test(`${name} activation does not write history or focus`,()=>{
    const f=fixture();f.depart(patch);assert.deepEqual(f.calls,[]);assert.deepEqual(f.view.history.state,{foreign:{preserved:true}});
  });
}
test('later cancellation is respected before pagehide, not guessed from the first handler',()=>{
  const f=fixture(),e=f.event();f.emit('click',e);e.defaultPrevented=true;f.emit('pagehide');assert.deepEqual(f.calls,[]);
});
for(const [name,patch] of [['new tab',{target:'_blank'}],['named window',{target:'reader'}],['download',{download:true}],['foreign origin',{origin:'https://other.test'}],['changed href identity',{dataset:{catalogRoute:'/different/'}}]]){
  test(`${name} link remains untouched`,()=>{const f=fixture();Object.assign(f.links[0],patch);f.depart();assert.deepEqual(f.calls,[]);});
}
test('cancelled selection cannot be reused by a later unrelated click/departure',()=>{
  const f=fixture();f.emit('click',f.event());f.emit('click',f.event({target:{closest:()=>null}}));f.emit('pagehide');assert.deepEqual(f.calls,[]);
});
for(const state of [1,'foreign',[],new Date(),new Map()]){
  test(`non-record foreign history state is never replaced (${state?.constructor.name})`,()=>{const f=fixture();f.view.history.state=state;f.depart();assert.equal(f.view.history.state,state);assert.deepEqual(f.calls,[]);});
}
for(const [name,type,persisted] of [['reload-style Back','back_forward',false],['BFCache pageshow','navigate',true]]){
  test(`${name} focuses the original anchor without scrolling`,()=>{
    const f=fixture();f.depart();f.calls.length=0;f.view.navigationType=type;f.emit('pageshow',{persisted});
    assert.equal(f.document.activeElement,f.links[0]);assert.deepEqual(f.calls,[{href,options:{preventScroll:true,focusVisible:true}}]);
    assert.equal(f.view.location.href,url);
  });
}
test('popstate traversal also restores identity; duplicate traversal does not refocus',()=>{
  const f=fixture();f.depart();f.calls.length=0;f.emit('popstate');f.emit('popstate');assert.equal(f.document.activeElement,f.links[0]);assert.equal(f.calls.length,1);
});
test('hash-entry identity belongs to that exact history entry, not the whole session',()=>{
  const f=fixture('#catalog-topic-богословие');f.depart();assert.equal(f.view.history.state[key].url,url+'#catalog-topic-богословие');
  f.view.location.href=url;f.emit('popstate');assert.equal(f.document.activeElement,f.document.body);
});
test('fresh/reload topic fragment has a semantic focus start without a scroll write',()=>{
  const f=fixture('#catalog-topic-богословие');f.emit('pageshow',{persisted:false});assert.equal(f.document.activeElement,f.topic);
  assert.deepEqual(f.calls,[{topic:true,options:{preventScroll:true,focusVisible:true}}]);
});
test('fresh SSR item fragment focuses its native anchor, not a fake tab stop',()=>{
  const f=fixture('#'+encodeURIComponent(catalogItemId(href)));f.emit('pageshow',{persisted:false});assert.equal(f.document.activeElement,f.links[0]);
});
test('reload is not silently reclassified as Back',()=>{
  const f=fixture();f.depart();f.calls.length=0;f.view.navigationType='reload';f.emit('pageshow',{persisted:false});assert.deepEqual(f.calls,[]);
});
test('focus already moved by the reader is not stolen',()=>{
  const f=fixture();f.depart();f.calls.length=0;f.document.activeElement=f.links[1];f.emit('popstate');assert.equal(f.document.activeElement,f.links[1]);assert.deepEqual(f.calls,[]);
});
test('removed/HOLD/foreign selection and malformed state do not focus anything',()=>{
  const f=fixture();for(const state of [null,{}, {[key]:{version:2,url,href}}, {[key]:{version:1,url,href:'/removed/'}}, {[key]:{version:1,url:'https://other.test/',href}}, {[key]:{version:1,url,href:40}}]){
    f.view.history.state=state;f.emit('popstate');assert.equal(f.document.activeElement,f.document.body);
  }
});
test('state clone/security failure leaves native navigation usable',()=>{
  const f=fixture();f.view.history.replaceState=()=>{throw Error('restricted');};assert.doesNotThrow(()=>f.depart());
});
test('binding is idempotent and removable without leaving document handlers',()=>{
  const f=fixture();installCatalogNavigation(f.catalog,f.view);f.depart();assert.equal(f.calls.length,1);f.calls.length=0;f.cleanup();f.depart();f.emit('popstate');assert.deepEqual(f.calls,[]);assert.equal(f.catalog.dataset.catalogNavigation,undefined);
});
test('implementation does not intercept navigation or introduce timing/scroll machinery',()=>{
  const source=fs.readFileSync(new URL('../src/components/articles/articlesCatalogNavigation.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\.preventDefault\s*\(|\.stopPropagation\s*\(|\b(?:setTimeout|setInterval|requestAnimationFrame|scrollTo|scrollIntoView)\s*\(|\.pushState\s*\(|scrollRestoration\s*=/);
  const shared=fs.readFileSync(new URL('../src/components/article-pilots/_shared/series/SeriesReaderChrome.astro',import.meta.url),'utf8');
  assert.equal((shared.match(/<ArticlesCatalogReturn\s*\/>/g)??[]).length,1);
  const fallback=fs.readFileSync(new URL('../src/components/articles/ArticlesCatalogReturn.astro',import.meta.url),'utf8');
  assert.match(fallback,/<nav class="articles-catalog-return"/);
  assert.doesNotMatch(fallback,/<nav class="breadcrumb"/); // Shared mobile breadcrumb CSS hides that class.
  assert.match(fallback,/min-height: 44px/);
});
