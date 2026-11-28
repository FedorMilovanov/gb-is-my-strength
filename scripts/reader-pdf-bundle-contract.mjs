// Synthetic contract fixtures only; no real rights grants or publication.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareReaderPdfBundle } from './lib/reader-pdf-bundle.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
const root = mkdtempSync(join(tmpdir(), 'gb-pdf-bundle-test-'));
const route = '/articles/synthetic/';
const revision = 'a'.repeat(40);
const textHash = hash('synthetic reviewed text');
const html = '<article>synthetic</article>';
const pdf = Buffer.from('%PDF-1.4 synthetic fixture only');
const sourceDist = join(root, 'dist');
const stage = join(root, 'stage');
mkdirSync(join(sourceDist, route), { recursive: true });
mkdirSync(stage);
writeFileSync(join(sourceDist, route, 'index.html'), html);
for (const w of [390,1440]) writeFileSync(join(stage, w+'.pdf'), pdf);
const receipt = { scope:'private-qa-only', revision, route, rendererProfile:'reader-native-a4-v1', sourceHash:hash(html), results:[390,1440].map(width=>({width,pages:2,bytes:pdf.length,sha256:hash(pdf),textHash})) };
const writeReceipt = r => writeFileSync(join(stage,'receipt.json'),JSON.stringify(r));
writeReceipt(receipt);
const args = { stages:[stage], revision, sourceDist, registry:{errors:[],entries:[{route,routeRole:'reading',owner:'astro',status:'production-dist'}]}, approvals:[{route,scope:'standalone-pdf-distribution',status:'approved',evidence:'synthetic fixture only'}], reviews:[{route,textHash,evidence:'synthetic fixture only'}] };
let passed=0;
function positive(overrides, count) { const out=prepareReaderPdfBundle({...args,...overrides}); try { assert.equal(out.result.artifacts,count); if(count) assert.deepEqual(readFileSync(join(out.dir,out.manifest.entries[0].url)),pdf); passed++; } finally {rmSync(out.dir,{recursive:true,force:true});} }
function negative(overrides, mutate, pattern) {writeReceipt(receipt); if(mutate) writeReceipt(mutate(structuredClone(receipt))); assert.throws(()=>prepareReaderPdfBundle({...args,...overrides}),pattern); passed++;}
try {
 positive({},1); positive({stages:[],approvals:[],reviews:[]},0);
 negative({approvals:[]},null,/no explicit PDF approval/);
 negative({reviews:[]},null,/independent text review/);
 negative({revision:'b'.repeat(40)},null,/stale staged revision/);
 negative({},r=>({...r,sourceHash:'f'.repeat(64)}),/stale staged HTML/);
 negative({},r=>({...r,results:r.results.slice(0,1)}),/viewport pair/);
 negative({},r=>{r.results[1].pages=3;return r;},/page parity/);
 negative({},r=>{r.results[0].textHash='f'.repeat(64);return r;},/reviewed text hash/);
 negative({},r=>{r.results[1].sha256='f'.repeat(64);return r;},/staged digest/);
 negative({},r=>{r.results[1].bytes++;return r;},/staged byte/);
 negative({registry:{errors:[],entries:[]}},null,/not a public reading route/);
 negative({stages:[stage,stage]},null,/EEXIST|duplicate/);
 console.log('PDF bundle contract: '+passed+'/13 PASS (synthetic fixtures)');
} finally {rmSync(root,{recursive:true,force:true});}
