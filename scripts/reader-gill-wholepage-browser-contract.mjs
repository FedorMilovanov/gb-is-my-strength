import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const shots=path.join(root,'reports','reader-gill-wholepage');
fs.mkdirSync(shots,{recursive:true});
const types={'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css',
  '.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  try {
    const url=decodeURIComponent(new URL(req.url,'http://local').pathname);
    const target=path.resolve(dist,'.'+(url.endsWith('/')?url+'index.html':url));
    const rel=path.relative(dist,target);
    if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(target)){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream',
      'cache-control':'no-store'});
    fs.createReadStream(target).pipe(res);
  }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const route='/articles/dzhon-gill-istoricheskiy-kontekst/';
const results=[];
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(process.env.GITHUB_ACTIONS==='true')assert.match(sourceSha,/^[0-9a-f]{40}$/);

const atlasExpected = [
  ['dzhon-gill-istoricheskiy-kontekst','Введение','Исторический контекст','28 мин'],
  ['dzhon-gill-chast-1-chelovek','I','Человек','32 мин'],
  ['dzhon-gill-chast-2-uchenyi','II','Учёный','39 мин'],
  ['dzhon-gill-chast-4-ekzeget','III','Экзегет','71 мин'],
  ['dzhon-gill-chast-3-nasledie','IV','Наследие','54 мин'],
  ['dzhon-gill-spravochnik','Справочный раздел','Справочник по Гиллу','15 мин'],
].map(([slug,mark,name,time])=>({href:'/articles/'+slug+'/',mark,name,time}));
function atlasSnapshot(){
  const roots=[...document.querySelectorAll('.gill-atlas')], root=roots[0];
  if(!root)return {count:roots.length};
  const rect=e=>e.getBoundingClientRect(), outer=rect(root), faults=[];
  const cv=document.createElement('canvas');cv.width=cv.height=1;
  const c=cv.getContext('2d',{willReadFrequently:true});
  function color(value){
    c.clearRect(0,0,1,1);c.fillStyle=value;c.fillRect(0,0,1,1);
    return [...c.getImageData(0,0,1,1).data].map(v=>v/255);
  }
  const lum=x=>x.slice(0,3).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3])).concat(1);
  function contrast(el){
    const layers=[];let n=el;
    while(n){
      const s=getComputedStyle(n),v=color(s.backgroundColor);
      if(s.backgroundImage!=='none'||Number(s.opacity)!==1)return null;
      layers.push(v);if(v[3]===1)break;n=n.parentElement;
    }
    if(!layers.length||layers.at(-1)[3]!==1)return null;
    const bg=layers.reverse().reduce((b,v)=>blend(v,b),[1,1,1,1]);
    const fg=blend(color(getComputedStyle(el).color),bg);
    const l=[lum(fg),lum(bg)].sort((a,b)=>b-a);
    return (l[0]+.05)/(l[1]+.05);
  }
  let minimum=Infinity;
  const links=[...root.querySelectorAll('a.atlas-node')];
  const nodes=links.map((a,i)=>{
    const r=rect(a);
    if(r.width<43.9||r.height<43.9||r.left<outer.left-1||r.right>outer.right+1||a.scrollWidth>a.clientWidth+1)faults.push('target/clip '+i);
    const icon=a.querySelector('svg.atlas-icon');
    if(!icon||!icon.querySelector('path[d]')||icon.getAttribute('aria-hidden')!=='true'||rect(icon).width<15)faults.push('icon '+i);
    for(const t of a.querySelectorAll('.atlas-name,.atlas-mark,.atlas-time,.atlas-here')){
      const range=document.createRange();range.selectNodeContents(t);
      for(const b of range.getClientRects())if(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1)faults.push('text clip '+i+' '+t.className);
      const ratio=contrast(t);if(ratio===null||ratio<4.5)faults.push('contrast '+i+' '+t.className+' '+ratio);
      if(ratio!==null)minimum=Math.min(minimum,ratio);
    }
    const text=s=>a.querySelector(s)?.textContent.trim()??null;
    return {href:a.getAttribute('href'),mark:text('.atlas-mark'),name:text('.atlas-name'),time:text('.atlas-time'),current:a.getAttribute('aria-current'),here:text('.atlas-here')};
  });
  const foot=root.querySelector('.atlas-foot');
  if(!foot){faults.push('missing editorial footer');}
  else {
    const s=getComputedStyle(foot);
    if(s.display!=='block'||[s.marginTop,s.marginBottom,s.paddingTop,s.paddingBottom,s.borderTopWidth].some(v=>Math.abs(parseFloat(v))>.5))faults.push('global footer chrome leaked into atlas');
    if(foot.scrollWidth>foot.clientWidth+1||!foot.querySelector('.atlas-rule path[d]')||!foot.querySelector('p')?.textContent.includes('Порядок чтения, а не хронология событий.'))faults.push('editorial footer geometry/content');
  }
  const rows=[...root.querySelectorAll('.atlas-row')];
  if(rows.length!==6||rows.some((r,i)=>i>0&&rect(r).top<rect(rows[i-1]).bottom-1))faults.push('row order');
  return {count:roots.length,legacy:document.querySelectorAll('.gbs2-timeline').length,
    visible:outer.width>0&&outer.height>0&&getComputedStyle(root).visibility==='visible',
    overflow:document.documentElement.scrollWidth-innerWidth,nodes,faults,minimum,theme:document.documentElement.classList.contains('dark')};
}
function checkAtlas(actual,index,dark){
  assert.equal(actual.count,1,'exactly one atlas');
  assert.equal(actual.legacy,0,'no duplicate legacy map');
  assert.ok(actual.visible&&actual.overflow<=1,'visible atlas without document overflow');
  assert.equal(actual.theme,dark,'theme projection');
  assert.deepEqual(actual.nodes,atlasExpected.map((v,i)=>({...v,current:i===index?'page':null,here:i===index?'Вы здесь':null})));
  assert.deepEqual(actual.faults,[],'atlas geometry, SVG and contrast');
}
async function runAtlasMatrix(){
  const rows=[];
  for(const [engine,driver] of Object.entries({chromium,firefox,webkit})){
    const browser=await driver.launch();
    try{
      for(const js of [false,true]){
        const ctx=await browser.newContext({javaScriptEnabled:js,serviceWorkers:'block',reducedMotion:'reduce'});
        try{
          const page=await ctx.newPage(),errors=[];
          page.on('pageerror',e=>errors.push(e.message));
          for(let index=0;index<atlasExpected.length;index++){
            const route=atlasExpected[index].href;
            const bytes=fs.readFileSync(path.join(dist,route.slice(1),'index.html'));
            const sha=createHash('sha256').update(bytes).digest('hex');
            for(const width of [390,1440])for(const dark of [false,true]){
              errors.length=0;
              await page.setViewportSize({width,height:844});
              const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
              assert.equal(response.status(),200);
              assert.ok((await response.body()).equals(bytes),'HTTP response differs from built dist');
              await page.evaluate(async dark=>{
                document.documentElement.classList.toggle('dark',dark);
                await document.fonts.ready;
              },dark);
              const atlas=page.locator('.gill-atlas');
              await atlas.scrollIntoViewIfNeeded();
              const info=await page.evaluate(atlasSnapshot);
              checkAtlas(info,index,dark);
              assert.deepEqual(errors,[],'uncaught page errors');
              if(!js&&(engine==='chromium'||width===390&&dark))
                await atlas.screenshot({path:path.join(shots,'atlas-'+engine+'-'+index+'-'+width+'-'+(dark?'dark':'light')+'.png'),animations:'disabled'});
              rows.push({engine,index,width,dark,js,sha,minimum:info.minimum});
              fs.writeFileSync(path.join(shots,'atlas-matrix.json'),JSON.stringify({source:sourceSha,expected:144,completed:rows.length,rows},null,2));
            }
          }
          if(!js){
            await page.goto(base+atlasExpected[2].href,{waitUntil:'domcontentloaded'});
            const links=page.locator('.gill-atlas a.atlas-node');await links.first().focus();
            for(let i=0;i<6;i++){
              assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),atlasExpected[i].href,'keyboard order');
              if(i<5)await page.keyboard.press('Tab');
            }
            await links.nth(3).click();
            assert.equal(new URL(page.url()).pathname,atlasExpected[3].href,'actual native navigation');
          }
        }finally{await ctx.close();}
      }
    }finally{await browser.close();}
  }
  assert.equal(rows.length,144);
  console.log('GILL ATLAS EXACT DIST: 144/144 PASS; theme projection (not theme-control test)');
}

const selectorGroups={
  summary:'.summary-card',
  illustration:'.article-img--vertical.float-right',
  bibliography:'.reading-list-section',
  timeline:'.gill-atlas'
};
try {
  for(const [engine,driver] of Object.entries({chromium,webkit})){
    const browser=await driver.launch();
    for(const width of [320,390,768,1440]){
      for(const theme of ['light','dark']){
        const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<500,
          hasTouch:width<500,serviceWorkers:'block',reducedMotion:'reduce'});
        const page=await ctx.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        const r=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
        assert.equal(r.status(),200,engine+' '+width+' route');
        if(theme==='dark')await page.evaluate(()=>document.documentElement.classList.add('dark'));
        await page.evaluate(()=>document.fonts.ready);
        const info=await page.evaluate(()=>{
          const nodes=selector=>[...document.querySelectorAll('article.article-body '+selector)];
          const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,w:r.width,right:r.right,height:r.height}};
          const figures=nodes('figure.article-img');
          const bibliography=nodes('.reading-list-section')[0];
          const sourceLinks=[...(bibliography?.querySelectorAll('.reading-list-section__items a')||[])];
          const nonemptyText=el=>Boolean(el.textContent?.trim());
          const m={
            viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
            summary: nodes('.summary-card__item').length,
            figures:figures.length,
            figureAlt:figures.every(x=>x.querySelector('img[alt]')?.getAttribute('alt')?.trim()),
            captions:figures.filter(x=>nonemptyText(x.querySelector('figcaption')||x)).length,
            sourceGroups:nodes('.reading-list-section__group').length,
            sourceItems:nodes('.reading-list-section__items li').length,
            sourceLinks:sourceLinks.length,
            brokenLink:sourceLinks.filter(x=>!x.getAttribute('href')||x.getAttribute('href')==='#').length,
            author:nodes('.author-card').length,next:nodes('.gbs2-next-card').length,
            timeline:nodes('.gill-atlas').length,eras:nodes('.atlas-row').length,
            areas:Object.fromEntries(Object.entries({
              summary:'.summary-card',illustration:'.article-img--vertical.float-right',
              bibliography:'.reading-list-section',timeline:'.gill-atlas',
              wide:'.article-img.wide',next:'.gbs2-next-card'
            }).map(([k,s])=>[k,nodes(s).map(rect)])),
          };
          return m;
        });
        const tag=engine+' '+width+' '+theme;
        assert.equal(info.summary,5,tag+' five authored summary points');
        assert.equal(info.figures,7,tag+' seven narrative figures');
        assert.ok(info.figureAlt,tag+' authored figure alt text');
        assert.equal(info.captions,7,tag+' all seven captions retained');
        assert.equal(info.sourceGroups,6,tag+' six source sections');
        assert.equal(info.sourceItems,38,tag+' 38 bibliography entries retained');
        assert.equal(info.sourceLinks,38,tag+' 38 annotated source links retained');
        assert.equal(info.brokenLink,0,tag+' all source links have destinations');
        assert.equal(info.author,1,tag+' author block');
        assert.equal(info.next,1,tag+' next chapter');
        assert.equal(info.timeline,1,tag+' one editorial series atlas');
        assert.equal(info.eras,6,tag+' six atlas rows');
        assert.ok(info.overflow<=1,tag+' no full-document horizontal overflow: '+info.overflow);
        for(const [kind,boxes] of Object.entries(info.areas)){
          assert.ok(boxes.length,tag+' missing '+kind);
          assert.ok(boxes.every(b=>b.w>0&&b.height>0&&b.x>=-1&&b.right<=width+1),
            tag+' '+kind+' outside viewport: '+JSON.stringify(boxes));
        }
        assert.deepEqual(errors,[],tag+' no uncaught JS');
        if((engine==='chromium'&&theme==='light'&&[320,390,1440].includes(width))
            ||(engine==='webkit'&&theme==='dark'&&width===390)){
          for(const [label,selector] of Object.entries(selectorGroups)){
            const el=page.locator('article.article-body '+selector).first();
            await el.scrollIntoViewIfNeeded();
            if(label==='illustration'){
              // W92 had a BLANK Chromium 390/1440 visual despite "16/16
              // PASS": the lazy source/caption existed, but screenshot ran
              // before the actual image was painted. No eager-loading or
              // duplicate image transport in the published article.
              await page.waitForFunction(selector=>{
                const figure=document.querySelector('article.article-body '+selector);
                const img=figure?.querySelector('img');
                if(!img||!img.complete||img.naturalWidth<1||img.naturalHeight<1)return false;
                let node=img;
                while(node&&node instanceof HTMLElement){
                  const style=getComputedStyle(node);
                  if(style.display==='none'||style.visibility==='hidden'||
                     Number(style.opacity||1)<.9)return false;
                  node=node.parentElement;
                }
                return true;
              },selector,{timeout:18000});
              const image=el.locator('img').first();
              await image.evaluate(async img=>{if(img.decode)await img.decode();});
              const ready=await image.evaluate(img=>{
                const rect=img.getBoundingClientRect();
                return {src:img.currentSrc||img.src,loading:img.loading,
                  complete:img.complete,naturalWidth:img.naturalWidth,
                  naturalHeight:img.naturalHeight,paintWidth:rect.width,
                  paintHeight:rect.height};
              });
              assert.ok(ready.naturalWidth>0&&ready.naturalHeight>0&&
                ready.paintWidth>80&&ready.paintHeight>80,
                tag+' illustration not decoded/paintable: '+JSON.stringify(ready));
              console.log('GILL ILLUSTRATION PAINT-READY '+tag+' '+JSON.stringify(ready));
              await page.evaluate(()=>new Promise(done=>
                requestAnimationFrame(()=>requestAnimationFrame(done))));
            }
            await el.screenshot({path:path.join(shots,engine+'-'+width+'-'+theme+'-'+label+'.png'),
              animations:'disabled',timeout:12000});
          }
        }
        results.push({engine,width,theme,sourceItems:info.sourceItems,links:info.sourceLinks,
          overflow:info.overflow,figures:info.figures});
        await ctx.close();
      }
    }
    await browser.close();
  }
  await runAtlasMatrix();
} finally {await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(path.join(shots,'metrics.json'),JSON.stringify(results,null,2));
console.log('READER GILL WHOLE-PAGE: '+results.length+'/'+results.length+' PASS');
