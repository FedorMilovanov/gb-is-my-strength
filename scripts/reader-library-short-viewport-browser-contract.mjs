import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const shots = path.join(root, 'reports', 'reader-library-short');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html':'text/html;charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };
const server = http.createServer((req,res) => {
  try {
    const u = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const dest = path.resolve(dist, '.' + (u.endsWith('/') ? u + 'index.html' : u));
    const rel = path.relative(dist,dest);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(dest)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type':types[path.extname(dest)] || 'application/octet-stream', 'cache-control':'no-store' });
    fs.createReadStream(dest).pipe(res);
  } catch (e) { res.writeHead(500).end(String(e)); }
});
const article = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const fixture = {
  notes:[{ id:'qa-note-1', text:'Заметка с содержимым, которое должно быть видно на коротком экране без необходимости ловить двадцатипиксельную полоску.', url:article, articleTitle:'Герменевтика', savedAt:1781300000000 }],
  quotes:[{ id:'qa-quote-1', text:'Короткая проверочная цитата с контекстом и сохранённой ссылкой.', url:article, articleTitle:'Герменевтика', savedAt:1781200000000 }]
};
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const outcomes = [];
try {
  for (const [engine,driver] of Object.entries({chromium,webkit})) {
    const browser = await driver.launch();
    for (const [width,height,theme] of [[320,568,'light'],[360,640,'light'],[390,844,'dark']]) {
      const ctx = await browser.newContext({ viewport:{width,height}, isMobile:true, hasTouch:true,
        locale:'ru-RU', serviceWorkers:'block', reducedMotion:'reduce' });
      await ctx.addInitScript(data => {
        localStorage.setItem('gb-reader-notes-v1',JSON.stringify(data.notes));
        localStorage.setItem('gb-highlights-v1',JSON.stringify(data.quotes));
      }, fixture);
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror',e=>errors.push(e.message));
      const response = await page.goto(base+article,{waitUntil:'domcontentloaded',timeout:30000});
      assert.equal(response.status(),200);
      if (theme==='dark') await page.evaluate(()=>document.documentElement.classList.add('dark'));
      await page.locator('#gb-hl-fab').waitFor({state:'visible',timeout:10000});
      await page.locator('#gb-hl-fab').click();
      await page.locator('.gb-hl-item').first().waitFor();
      await page.waitForFunction(()=>{
        const panel=document.querySelector('#gb-hl-panel');
        return panel&&getComputedStyle(panel).opacity==='1'&&!panel.getAnimations().some(a=>a.playState==='running');
      },null,{timeout:7000});
      const before = await page.evaluate(()=>{
        const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
        return {panel:rect('#gb-hl-panel'),list:rect('#gb-hl-list'),margin:parseFloat(getComputedStyle(document.querySelector('#gb-hl-foot')).marginTop),
          foot:rect('#gb-hl-foot'),overflow:document.documentElement.scrollWidth-innerWidth};
      });
      const key=engine+' '+width+'x'+height;
      assert.ok(Math.abs(before.margin)<.25,key+' no global 64px footer leak');
      assert.ok(before.list.height>=100,key+' list visible, not 26px slit: '+JSON.stringify(before));
      assert.ok(before.panel.bottom<=height+1&&before.panel.y>=-1,key+' panel inside viewport');
      assert.ok(before.overflow<=1,key+' no page overflow');
      await page.screenshot({path:path.join(shots,engine+'-'+width+'-'+theme+'-list.png'),animations:'disabled'});
      await page.locator('#gb-hl-manage').click();
      await page.locator('#gb-hl-manage-panel').waitFor({state:'visible'});
      const manage = await page.evaluate(()=>{
        const section=document.querySelector('#gb-hl-manage-panel'),r=section.getBoundingClientRect();
        const actions=[...section.querySelectorAll('button')].slice(0,2).map(b=>{
          let q=b.getBoundingClientRect();return{top:q.top,bottom:q.bottom,h:q.height,visible:getComputedStyle(b).display!=='none'}});
        return {height:r.height,top:r.top,bottom:r.bottom,actions,tabHidden:getComputedStyle(document.querySelector('#gb-hl-tabs')).display==='none',
          listHidden:getComputedStyle(document.querySelector('#gb-hl-list')).display==='none',scrollHeight:section.scrollHeight,clientHeight:section.clientHeight};
      });
      assert.ok(manage.height>=145,key+' backup actions need readable height: '+JSON.stringify(manage));
      assert.ok(manage.listHidden&&manage.tabHidden,key+' backup panel owns available space');
      assert.ok(manage.actions.every(a=>a.visible&&a.h>=35),key+' export/import buttons accessible');
      await page.screenshot({path:path.join(shots,engine+'-'+width+'-'+theme+'-manage.png'),animations:'disabled'});
      await page.locator('#gb-hl-manage').click();
      assert.equal(await page.locator('#gb-hl-list').isVisible(),true,key+' list restored after closing manage');
      assert.ok((await page.locator('#gb-hl-list').boundingBox()).height>=100,key+' list restored readable');
      await page.locator('[data-library-tab="note"]').click();
      assert.equal(await page.locator('.gb-hl-item').count(),1,key+' note available after manage toggle');
      assert.deepEqual(errors,[],key+' no JS errors');
      outcomes.push({engine,width,height,theme,listHeight:before.list.height,manageHeight:manage.height});
      await ctx.close();
    }
    await browser.close();
  }
} finally { await new Promise(resolve=>server.close(resolve)); }
fs.writeFileSync(path.join(shots,'metrics.json'),JSON.stringify(outcomes,null,2));
console.log(JSON.stringify({passed:outcomes.length,metrics:outcomes,shots}));
