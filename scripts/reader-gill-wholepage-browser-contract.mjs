import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

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
const selectorGroups={
  summary:'.summary-card',
  illustration:'.article-img--vertical.float-right',
  bibliography:'.reading-list-section',
  timeline:'.gbs2-timeline'
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
            timeline:nodes('.gbs2-timeline').length,eras:nodes('.gbs2-tl-item').length,
            areas:Object.fromEntries(Object.entries({
              summary:'.summary-card',illustration:'.article-img--vertical.float-right',
              bibliography:'.reading-list-section',timeline:'.gbs2-timeline',
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
        assert.equal(info.timeline,1,tag+' one historical chronology');
        assert.equal(info.eras,6,tag+' six timeline stages');
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
} finally {await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(path.join(shots,'metrics.json'),JSON.stringify(results,null,2));
console.log('READER GILL WHOLE-PAGE: '+results.length+'/'+results.length+' PASS');
