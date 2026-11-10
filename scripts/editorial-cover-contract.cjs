#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'data/baptist-editorial-cover-sources.json'),'utf8'));
const errors=[];
const entries=Object.entries(manifest.covers);
const retired=fs.readdirSync(path.join(ROOT,'images/baptisty-rossii')).filter(n=>/^cover-(?:landing|\d\d-[a-z-]+)\.(?:svg|webp)$/.test(n));
if(retired.length)errors.push('Retired synthetic image still shipped: '+retired.join(','));
if(entries.length!==11)errors.push('Expected 11 documented Russian Baptist covers, got '+entries.length);
for(const [key,item] of entries) {
  const target=path.join(ROOT,item.output);
  if(!fs.existsSync(target)){errors.push('Missing '+item.output);continue;}
  const sig=fs.readFileSync(target).subarray(0,12);
  if(sig.toString('ascii',0,4)!=='RIFF'||sig.toString('ascii',8,12)!=='WEBP')errors.push('Bad WebP '+item.output);
  if(!item.source_files.length) errors.push('Uncited cover '+key);
  for(const name of item.source_files) if(!fs.existsSync(path.join(ROOT,name))) errors.push('Missing archival source '+name);
}
function collect(dir){
 const all=[];
 for(const x of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,x.name);
  if(x.isDirectory())all.push(...collect(p));else all.push(p);
 }
 return all;
}
const srcFiles=collect(path.join(ROOT,'src')).filter(p=>/\.(?:astro|ts|tsx|js|mjs|json)$/.test(p));
const forbiddenBaptist=/baptisty-rossii\/cover-(?:landing|\d\d-[a-z-]+)\.(?:svg|webp)/;
const forbiddenHeart=/og-chto-bibliya-nazyvaet-serdcem(?:-600w)?\.(?:jpg|webp)/;
let heroSvgInspected=0;
for(const p of srcFiles){
 const txt=fs.readFileSync(p,'utf8');
 const rel=path.relative(ROOT,p);
 if(forbiddenBaptist.test(txt))errors.push(rel+': retired Baptist title-card artwork');
 if(forbiddenHeart.test(txt))errors.push(rel+': retired heart text-card artwork');
 if(!p.endsWith('.astro'))continue;
 for(const match of txt.matchAll(/<figure\b[^>]*\bclass="[^"]*(?:hero|cover)[^"]*"[^>]*>[\s\S]*?<\/figure>/g)){
  for(const img of match[0].matchAll(/<img\b[^>]*\bsrc="([^"]+\.svg)"[^>]*>/g)){
   const src=img[1].startsWith('/') ? '.'+img[1] : img[1];
   const abs=path.resolve(path.dirname(p),src);
   if(!abs.startsWith(ROOT+path.sep)||!fs.existsSync(abs))continue;
   heroSvgInspected++;
   if(/<text(?:\s|>)/i.test(fs.readFileSync(abs,'utf8')))errors.push(rel+': SVG text-rendered hero '+src);
  }
 }
}
const cfg=fs.readFileSync(path.join(ROOT,'src/components/article-pilots/_shared/series/baptistFlatSeriesConfig.ts'),'utf8');
const used=[...cfg.matchAll(/railCover:\s*['"][^'"]*\/([^/'"]+\.webp)['"]/g)].map(x=>x[1]);
const allowed=new Set(entries.map(([,v])=>v.output.split('/').pop()));
if(used.length!==10||new Set(used).size!==10)errors.push('Expected ten distinct book chapter source covers');
for(const name of used)if(!allowed.has(name))errors.push('Undocumented series cover '+name);
if(errors.length){
 console.error('EDITORIAL COVER POLICY FAIL ('+errors.length+')\n'+errors.map(e=>' - '+e).join('\n'));
 process.exitCode=1;
}else{
 console.log('EDITORIAL COVER POLICY PASS: 11 archive records, 10 series chapters, '+srcFiles.length+' sources scanned, '+heroSvgInspected+' SVG hero cases inspected.');
}
