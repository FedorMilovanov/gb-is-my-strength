#!/usr/bin/env node
'use strict';
// Verifies one canonical floating controller per Reader route in built dist.
// --require-pagefind also checks the local handoff's search infrastructure.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../dist'),files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name==='index.html')files.push(f);}}
walk(ROOT);
assert(files.length>=100,'Expected at least 100 static routes, got '+files.length);
const issues=[];let readers=0,native=0,series=0,standalone=0,exceptions=0,duplicates=0,version=null;
for(const file of files){
 const html=fs.readFileSync(file,'utf8');
 const route='/'+path.relative(ROOT,file).replace(/\\/g,'/').replace(/index\.html$/,'');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map(m=>m[1]).filter(src=>/\/js\/floating-cluster-controller\.js(?:\?|$)/.test(src));
 const n=scripts.length;
 if(n>1){duplicates++;issues.push(route+': duplicate controller '+n)}
 const isNative=/<article\b[^>]*class=["'][^"']*\bastro-article\b/.test(html);
 const isSeries=/\bdata-gbs2-series=/.test(html),hasRail=/\bdata-fc-root\b/.test(html);
 const isStandalone=hasRail&&!isNative&&!isSeries;
 if(isNative||isSeries||hasRail){
   readers++;native+=Number(isNative);series+=Number(isSeries);standalone+=Number(isStandalone);
   if(n!==1)issues.push(route+': expected one controller, got '+n);
 }else exceptions++;
 if(n===1){
   const v=scripts[0].match(/[?&]v=([a-f0-9]{8})/);
   if(!v)issues.push(route+': unversioned controller URL '+scripts[0]);
   else if(version===null)version=v[1];
   else if(version!==v[1])issues.push(route+': mixed cache version '+v[1]+' vs '+version);
 }
}
if(process.argv.includes('--require-pagefind')&&!fs.existsSync(path.join(ROOT,'pagefind','pagefind.js')))
  issues.push('Pagefind missing from local handoff dist; search would be broken');
console.log(JSON.stringify({routes:files.length,readers,native,series,standalone,exceptions,duplicates,assetVersion:version,issues},null,2));
if(issues.length)process.exitCode=1;
