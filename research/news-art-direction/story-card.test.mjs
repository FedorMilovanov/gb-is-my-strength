import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNewsStoryCard as check } from '../../src/components/journal/editorial/news-story-card-model.mjs';
const valid = { title:'Test article', label:'Research', href:'/journal/dossiers/g3/history/' };
const media={src:'/images/journal/example.webp',alt:'Illustration',caption:'Editorial illustration',width:1200,height:675,sizes:'100vw',webpSrcset:'/images/journal/example.webp 1200w'};
for (const variant of ['feature','analysis','brief']) test(variant,()=>assert.doesNotThrow(()=>check({...valid,variant})));
test('document metadata and media',()=>assert.doesNotThrow(()=>check({...valid,media,publishedAt:'2026-11-24T00:00:00+03:00',publishedLabel:'24 November 2026'})));
for(const href of ['https://example.com/a','//example.com/','/journal/','/journal/a//b/','/journal/../a/','/journal/a?x=1/','/journal/a']) test('reject route '+href,()=>assert.throws(()=>check({...valid,href})));
for(const card of [{title:''},{label:' '},{variant:'unknown'},{headingLevel:1},{deck:''},{publishedAt:'2026-11-24T00:00:00Z'},{publishedLabel:'Today'},{publishedAt:'2026-02-30T00:00:00Z',publishedLabel:'Invalid'},{media:{...media,alt:''}},{media:{...media,caption:''}},{media:{...media,width:0}},{media:{...media,src:'https://example.com/x.webp'}},{media:{...media,webpSrcset:'https://example.com/x.webp 1200w'}}]) test('reject '+JSON.stringify(card),()=>assert.throws(()=>check({...valid,...card})));
