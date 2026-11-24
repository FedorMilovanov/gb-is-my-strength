#!/usr/bin/env node
'use strict';
// Audit the rendered table headers, not CSS declarations. Run after the
// production-like dist build, with AUDIT_BASE pointing at that exact dist.
// Nagornaya has its own table engine. Its failures are reported separately,
// not treated as passing the common Reader contract.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const BASE=process.env.AUDIT_BASE;
assert.ok(BASE,'AUDIT_BASE must point to the exact built site');
const base=new URL(BASE).origin;
const dist=path.resolve(process.env.GB_TABLE_DIST||'dist');
const routes=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(entry.name.endsWith('.html')&&/<table\b/i.test(fs.readFileSync(file,'utf8'))){
      routes.push('/'+path.relative(dist,file).split(path.sep).join('/').replace(/index\.html$/,''));
    }
  }
}
walk(dist);
routes.sort();
assert.ok(routes.length>0,'table census empty');
const widths=[320,390,768,1121,1280,1440];
async function measure(page){
  return page.evaluate(()=>{
    const split=[],clip=[],scroll=[],count={headers:0,tables:0};
    for(const [index,table] of Array.from(document.querySelectorAll('table')).entries()){
      const bounds=table.getBoundingClientRect();
      if(!bounds.width||!bounds.height)continue;
      count.tables++;
      for(const cell of table.querySelectorAll('th')){
        const box=cell.getBoundingClientRect();
        if(!box.width||!box.height)continue;
        count.headers++;
        const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
        let node;
        while((node=walker.nextNode())){
          for(const match of node.textContent.matchAll(/[\p{L}\p{N}]{2,}/gu)){
            const range=document.createRange();
            range.setStart(node,match.index);
            range.setEnd(node,match.index+match[0].length);
            const rects=Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0);
            const detail={table:index,heading:cell.textContent.trim(),word:match[0]};
            if(new Set(rects.map(r=>Math.round(r.top))).size>1)split.push(detail);
            if(rects.some(r=>r.left<box.left-1||r.right>box.right+1))clip.push(detail);
          }
        }
      }
      // A wide table is legitimate if a reachable internal scroll container
      // contains its excess width; a whole-document scrollbar is not.
      if(table.scrollWidth>table.clientWidth+2){
        let owner=table;
        while(owner&&owner!==document.body){
          const style=getComputedStyle(owner);
          if(/^(auto|scroll)$/.test(style.overflowX)&&owner.scrollWidth>owner.clientWidth+2)break;
          owner=owner.parentElement;
        }
        if(!owner||owner===document.body)scroll.push({table:index,width:table.scrollWidth,client:table.clientWidth});
      }
    }
    return {count,split,clip,scroll,docOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });
}
(async()=>{
  const failures=[],special=[],coverage=[];
  for(const [name,engine] of Object.entries({chromium,webkit})){
    const browser=await engine.launch();
    try{
      for(const width of widths){
        const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
        try{
          await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
          for(const route of routes){
            const page=await context.newPage();
            try{
              const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:20000});
              assert.ok(response?.ok(),'HTTP response not OK');
              // A known desktop Reader bootstrap must finish before measuring.
              if(width>=1121&&await page.locator('script[src*="reader-universal"],script[src*="reader_universal"]').count()){
                await page.waitForFunction(()=>window.__NP_UNIVERSAL_PREVIEW__?.ready,{},{timeout:12000});
              }
              await page.evaluate(()=>document.fonts.ready);
              await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
              const result=await measure(page);
              assert.ok(result.count.tables>0,'no visible table on inventoried route');
              coverage.push({name,width,route,...result.count});
              if(result.split.length||result.clip.length||result.scroll.length||result.docOverflow){
                const detail={name,width,route,...result};
                (route.startsWith('/nagornaya/')?special:failures).push(detail);
                console.error(JSON.stringify(detail));
              }
            }catch(error){
              failures.push({name,width,route,error:error.message});
              console.error(JSON.stringify(failures.at(-1)));
            }finally{await page.close();}
          }
        }finally{await context.close();}
      }
    }finally{await browser.close();}
  }
  console.log(JSON.stringify({routes:routes.length,expected:routes.length*widths.length*2,coverage:coverage.length,headers:coverage.reduce((n,c)=>n+c.headers,0),failures:failures.length,nagornayaFailures:special.length}));
  assert.equal(coverage.length,routes.length*widths.length*2,'incomplete coverage');
  assert.equal(failures.length,0,'common table header contract failed');
  assert.equal(special.length,0,'Nagornaya table contract failed (separate owner)');
})().catch(error=>{console.error(error);process.exitCode=1});
