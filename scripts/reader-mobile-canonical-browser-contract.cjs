/* Reader mobile canonical interaction and hierarchical-navigation contract.
 * Tests the generated dist in Chromium and WebKit; no live server required. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const dist = path.resolve(__dirname, '../dist');
const mimes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
const server = http.createServer((req,res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let file = path.resolve(dist, decodeURIComponent(url.pathname).slice(1));
    if (!path.extname(file)) file = path.join(file, 'index.html');
    const rel = path.relative(dist, file);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return void res.end();
    }
    res.writeHead(200, {'content-type':mimes[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end(); }
});
let cases=0, passes=0;
const failures=[];
function check(test,label,data) {
  cases++; if (test) passes++; else failures.push({label,data});
}
async function run() {
  if (!fs.existsSync(path.join(dist,'index.html'))) throw new Error('Missing production-like dist');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  for (const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]) {
    const browser=await engine.launch({headless:true});
    try {
      for (const width of [320,390,430]) {
        const page=await browser.newPage({viewport:{width,height:760},serviceWorkers:'block',reducedMotion:'reduce'});
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>{try{localStorage.setItem('gb:audio:rate','1.5');localStorage.setItem('gbx-tts-rate','1.5')}catch{}});
        const tag=name+' '+width+'px';

        await page.goto(origin+'/baptisty-rossii/noch-na-kure/',{waitUntil:'domcontentloaded'});
        const badge=page.locator('#mobSpdBadge'),ember=page.locator('.mobile-top-ember');
        await badge.waitFor({state:'visible'});
        const before=await ember.boundingBox();
        await badge.click();
        await page.waitForTimeout(100);
        const gill=await page.evaluate(()=>{
          const bar=document.querySelector('.mobile-top-bar');
          const rail=document.querySelector('#mobileSpeedrail');
          const play=document.querySelector('.mobile-top-ember');
          const a=rail.getBoundingClientRect(),b=bar.getBoundingClientRect(),p=play.getBoundingClientRect();
          return {
            open:bar.classList.contains('speed-open'),
            rates:[...rail.querySelectorAll('[data-speed]')].map(x=>x.dataset.speed),
            railTop:a.top,railBottom:a.bottom,barBottom:b.bottom,railRight:a.right,playLeft:p.left,
            display:getComputedStyle(rail).display,railPosition:getComputedStyle(rail).position,
            nav:[...bar.querySelectorAll('#mobBackBtn,#mobHomeBtn,.mobile-learning-trigger')].map(x=>x.inert),
            ring:!!document.querySelector('#gbs2MobSeriesRing')&&!!document.querySelector('#gbs2MobArticleRing'),
            visiblePct: (()=>{const x=document.querySelector('#gbs2MobPct');return x?.getBoundingClientRect().width>3})()
          };
        });
        const during=await ember.boundingBox();
        check(gill.open&&gill.display==='flex'&&gill.railPosition==='absolute'&&gill.railBottom<=gill.barBottom+2&&gill.railRight<=gill.playLeft+2,tag+' Gill inline geometry',gill);
        check(gill.rates.join(',')==='0.75,1,1.25,1.5,1.75,2'&&gill.nav.every(Boolean),tag+' canonical six rates + hidden nav',gill);
        check(Math.abs((before.x+before.width/2)-(during.x+during.width/2))<.6,tag+' stationary Play', {before,during});
        check(gill.ring&&!gill.visiblePct,tag+' dual ring without visible digits',gill);
        await page.locator('#mobileSpeedrail [data-speed="1.75"]').click();
        // Existing UI motion accessibility owner releases inert only after
        // the 380ms visual fold plus its own bounded transition; assert the
        // final, interactive state, never a mid-transition frame.
        await page.waitForFunction(() => {
          const bar = document.querySelector('.mobile-top-bar');
          const nav = [...document.querySelectorAll('#mobBackBtn,#mobHomeBtn,.mobile-learning-trigger')];
          return !!bar && !bar.classList.contains('speed-open') && nav.length === 3 && nav.every(x => !x.inert);
        }, null, { timeout: 1800 });
        const chosen=await page.evaluate(()=>({
          rate:localStorage.getItem('gb:audio:rate'),
          badge:document.querySelector('#mobSpdBadge')?.textContent?.trim(),
          folded:!document.querySelector('.mobile-top-bar')?.classList.contains('speed-open'),
          nav:[...document.querySelectorAll('#mobBackBtn,#mobHomeBtn,.mobile-learning-trigger')].map(x=>x.inert),
          pending:document.querySelector('.mobile-top-ember')?.dataset.speedConfirm
        }));
        check(chosen.rate==='1.75'&&chosen.badge==='1.75×'&&chosen.folded&&chosen.nav.every(x=>!x)&&chosen.pending==='true',tag+' choose-and-confirm without auto-start',chosen);
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tag+' no page x overflow',null);
        check(!!await page.locator('#mobPartTocBtn').count(),tag+' series TOC retained',null);

        await page.goto(origin+'/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',{waitUntil:'domcontentloaded'});
        await page.locator('#hmSpdBadge').click();
        await page.waitForTimeout(100);
        const herm=await page.evaluate(()=>{
          const bar=document.querySelector('.hmtop'),rail=document.querySelector('#hmSpeedrail');
          const r=rail.getBoundingClientRect(),b=bar.getBoundingClientRect();
          return {
            rates:[...rail.querySelectorAll('[data-speed]')].map(x=>x.dataset.speed),
            inline:r.bottom<=b.bottom+2,
            checked:[...rail.querySelectorAll('[aria-checked="true"]')].map(x=>x.dataset.speed),
            singleRing:!!document.querySelector('#hmProgressFill'),
            visiblePct:document.querySelector('#hmProgressText')?.getBoundingClientRect().width>3,
            toc:!!document.querySelector('#hmSectionBtn')&&!!document.querySelector('.hmsheet-list')
          };
        });
        check(herm.inline&&herm.rates.join(',')==='0.75,1,1.25,1.5,1.75,2',tag+' Hermenevtika inline rates',herm);
        check(herm.singleRing&&!herm.visiblePct&&herm.toc,tag+' article ring and TOC retained',herm);
        await page.locator('#hmSpeedrail [data-speed="0.75"]').click();
        await page.waitForTimeout(300);
        check(await page.locator('#hmSpdBadge').textContent().then(s=>s.trim()==='0.75×'),tag+' Hermenevtika badge',null);
        check(errors.length===0,tag+' no uncaught page errors',errors.slice(0,5));
        await page.close();
      }
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify({cases,passes,failed:cases-passes,failures:failures.slice(0,30)},null,2));
  if(failures.length)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
