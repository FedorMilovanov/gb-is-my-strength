#!/usr/bin/env node
'use strict';
/**
 * Reader Platform typography source/dist guard:
 * no orphanable opening parenthesis immediately before a biblical reference.
 * Shared reader-atomic-citation is the only non-breaking markup contract.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const failures=[],stats={sourceFiles:0,sourceRefs:0,distFiles:0,distRefs:0};
const needle=/\(<button\s+class=["']bref(?:["']|\s)/g;
function walk(dir,cb){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f,cb);else cb(f);}}
function check(file,kind){
 const s=fs.readFileSync(file,'utf8');
 let match;let total=0;
 while((match=needle.exec(s))!==null){
   total++;
   const prefix=s.slice(Math.max(0,match.index-120),match.index);
   if(!/<span\s+class=["']reader-atomic-citation["']>\s*$/.test(prefix))
     failures.push(kind+':'+path.relative(base,file)+':'+s.slice(0,match.index).split('\n').length+': orphanable bracket');
 }
 stats[kind+'Files']++;
 stats[kind+'Refs']+=total;
}
walk(path.join(base,'src'),f=>{
 if(/\.(?:astro|mdx)$/.test(f)&&fs.statSync(f).size<900000)check(f,'source');
});
walk(path.join(base,'dist'),f=>{
 if(f.endsWith('index.html'))check(f,'dist');
});
assert(stats.sourceRefs>=100,'Expected >100 parenthesized scripture references; found '+stats.sourceRefs);
assert(stats.distRefs>=100,'Built references missing; found '+stats.distRefs);
const css=fs.readFileSync(path.join(base,'dist','css','site.css'),'utf8');
if(!css.includes('reader-atomic-citation')||!css.includes('white-space:nowrap'))failures.push('canonical CSS nowrap contract missing');
console.log('ATOMIC-CITATION',JSON.stringify({...stats,failures:failures.slice(0,20),totalFailures:failures.length}));
if(failures.length)process.exitCode=1;
