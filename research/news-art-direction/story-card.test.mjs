import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNewsStoryCard as check } from '../../src/components/journal/editorial/news-story-card-model.mjs';
import { projectPublishedInvestigation as project } from '../../src/components/journal/editorial/published-investigation.mjs';
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

// W4.6 canonical existing article projection, not a duplicated publication.
const article={section:'articles',draft:false,noindex:false,slug:'existing-dossier',h1:'Existing dossier',description:'Existing description',publishedAt:new Date('2026-09-29T21:00:00Z'),readingTime:87,ogImage:'/images/articles/existing.webp',ogImageAlt:'Editorial illustration'};
test('project original published metadata',()=>{const {image,...card}=project(article);assert.equal(card.href,'/articles/existing-dossier/');assert.equal(card.title,article.h1);assert.equal(card.deck,article.description);assert.equal(card.publishedAt,article.publishedAt.toISOString());assert.equal(card.publishedLabel,'30 сентября 2026 г.');assert.equal(card.readingLabel,'87 мин чтения');assert.deepEqual(image,{src:article.ogImage,alt:article.ogImageAlt});check({...card,label:'Investigation',media:{...image,width:1200,height:630,sizes:'100vw',caption:'Illustration'}})});
for(const bad of [{draft:true},{noindex:true},{section:'biografii'},{canonicalOverride:'https://example.org/'},{slug:'../other'},{h1:''},{ogImageAlt:''},{publishedAt:new Date(NaN)},{readingTime:0}])test('reject unadmitted projection '+JSON.stringify(bad),()=>assert.throws(()=>project({...article,...bad})));
for(const href of ['/articles/','/articles/a/b/','/articles/../a/','/articles/a?x=1/','/articles/a','/biografii/a/'])test('reject noncanonical article route '+href,()=>assert.throws(()=>check({...valid,href})));

// W8.5: validation defaults must match the Astro renderer (undefined only).
for (const bad of [{variant:null},{headingLevel:null},{variant:null,companion:true},{variant:null,landingLead:true,media}]) test('reject explicit null '+JSON.stringify(bad),()=>assert.throws(()=>check({...valid,...bad})));
test('allow undefined renderer defaults',()=>assert.doesNotThrow(()=>check({...valid,variant:undefined,headingLevel:undefined,companion:true})));

// W62: HTML time hours, unique responsive candidates, safe intrinsic dimensions.
for(const bad of [
  {publishedAt:'2026-11-24T24:00:00Z',publishedLabel:'24 November'},
  {publishedAt:'2026-11-24T23:60:00Z',publishedLabel:'24 November'},
  {media:{...media,webpSrcset:'/images/a.webp 640w, /images/a.webp 1200w'}},
  {media:{...media,avifSrcset:'/images/a.avif 640w, /images/a.avif 1200w'}},
  {media:{...media,width:1e100}}, {media:{...media,height:Number.MAX_SAFE_INTEGER+1}},
]) test('W62 reject '+JSON.stringify(bad),()=>assert.throws(()=>check({...valid,...bad})));
test('W62 last valid clock second',()=>assert.doesNotThrow(()=>check({...valid,publishedAt:'2026-11-24T23:59:59Z',publishedLabel:'24 November'})));

// Gregorian boundary parity with Journal document metadata; no Date.UTC year remapping.
for (const day of ['0000-02-29','0004-02-29','0099-02-28','2000-02-29','2024-02-29']) test('accept Gregorian '+day,()=>assert.doesNotThrow(()=>check({...valid,publishedAt:day+'T00:00:00Z',publishedLabel:'Test date'})));
for (const day of ['0001-02-29','0100-02-29','1900-02-29','2026-02-30']) test('reject Gregorian '+day,()=>assert.throws(()=>check({...valid,publishedAt:day+'T00:00:00Z',publishedLabel:'Test date'})));
