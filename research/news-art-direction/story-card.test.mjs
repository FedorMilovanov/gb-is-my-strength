import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNewsStoryCard as check } from '../../src/components/journal/editorial/news-story-card-model.mjs';
const valid = { title:'Test article', label:'Research', href:'/journal/dossiers/g3/history/' };
const media={src:'/images/journal/example.webp',alt:'Illustration',caption:'Editorial illustration',width:1200,height:675,sizes:'100vw',webpSrcset:'/images/journal/example.webp 1200w'};
for (const variant of ['feature','analysis','brief']) test(variant,()=>assert.doesNotThrow(()=>check({...valid,variant})));
test('document metadata and media',()=>assert.doesNotThrow(()=>check({...valid,media,publishedAt:'2026-11-24T00:00:00+03:00',publishedLabel:'24 November 2026'})));
for(const href of ['https://example.com/a','//example.com/','/journal/','/journal/a//b/','/journal/../a/','/journal/a?x=1/','/journal/a']) test('reject route '+href,()=>assert.throws(()=>check({...valid,href})));
for(const card of [{title:''},{label:' '},{variant:'unknown'},{headingLevel:1},{deck:''},{publishedAt:'2026-11-24T00:00:00Z'},{publishedLabel:'Today'},{publishedAt:'2026-02-30T00:00:00Z',publishedLabel:'Invalid'},{media:{...media,alt:''}},{media:{...media,caption:''}},{media:{...media,width:0}},{media:{...media,src:'https://example.com/x.webp'}},{media:{...media,webpSrcset:'https://example.com/x.webp 1200w'}}]) test('reject '+JSON.stringify(card),()=>assert.throws(()=>check({...valid,...card})));

// NEWS-QA-006: wrong format, duplicate width, malformed or unordered sizes.
test('accept canonical responsive candidates',()=>assert.doesNotThrow(()=>check({...valid,media:{...media,avifSrcset:'/images/a.avif 640w, /images/b.avif 1200w',sizes:'(min-width: 1280px) 790px, (min-width: 691px) calc(67.74vw - 78.58px), calc(100vw - 40px)'}})));
for(const bad of [
 {avifSrcset:'/images/a.webp 640w'},
 {webpSrcset:'/images/a.avif 640w'},
 {avifSrcset:'/images/a.avif 640w, /images/b.avif 640w'},
 {webpSrcset:'/images/a.webp 640w, /images/b.webp 640w'},
 {avifSrcset:'/images/a.avif 9999999999999999999w'},
 {sizes:'not a media size'},
 {sizes:'(min-width: 800px) 640px'},
 {sizes:'(min-width: 600px) 320px, (min-width: 900px) 640px, 100vw'},
 {sizes:'100vw, 100vw'},
 {sizes:'0px'},
]) test('NEWS-QA-006 reject '+JSON.stringify(bad),()=>assert.throws(()=>check({...valid,media:{...media,...bad}})));

// W3.2 actual routed variants and optional presentation-only values.
test('valid feature caption note and action',()=>assert.doesNotThrow(()=>check({...valid,variant:'feature',actionLabel:'Read',media:{...media,note:'21 sources'}})));
test('valid companion analysis',()=>assert.doesNotThrow(()=>check({...valid,variant:'analysis',companion:true})));
for(const bad of [{companion:'true'},{variant:'feature',companion:true},{actionLabel:''},{media:{...media,note:''}}]) test('reject routed presentation '+JSON.stringify(bad),()=>assert.throws(()=>check({...valid,...bad})));

// W3.4: documentary media is intrinsic unless caller explicitly chooses a cover crop.
for (const dims of [[675,1200],[1200,900],[1200,675]]) test('intrinsic media '+dims.join('x'),()=>assert.doesNotThrow(()=>check({...valid,media:{...media,width:dims[0],height:dims[1]}})));
test('explicit crop',()=>assert.doesNotThrow(()=>check({...valid,media:{...media,presentation:{mode:'crop',ratio:'4:3',focalX:25,focalY:75}}})));
test('explicit intrinsic',()=>assert.doesNotThrow(()=>check({...valid,media:{...media,presentation:{mode:'intrinsic'}}})));
test('single legacy hook on illustrated feature',()=>assert.doesNotThrow(()=>check({...valid,variant:'feature',landingLead:true,media})));
for(const bad of [{mode:'crop'},{mode:'crop',ratio:'4:3',focalX:-1,focalY:50},{mode:'crop',ratio:'4:3',focalX:50,focalY:101},{mode:'crop',ratio:'7:9',focalX:50,focalY:50},{mode:'crop',ratio:'4:3',focalX:'50',focalY:50},{mode:'intrinsic',ratio:'4:3'},{mode:'auto'},null])test('reject media presentation '+JSON.stringify(bad),()=>assert.throws(()=>check({...valid,media:{...media,presentation:bad}})));
for(const bad of [{landingLead:true},{landingLead:'true'},{variant:'feature',landingLead:true}])test('reject legacy hook '+JSON.stringify(bad),()=>assert.throws(()=>check({...valid,...bad})));
