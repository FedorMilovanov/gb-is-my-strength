#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(DIST, rel);
      if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function visible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

(async () => {
  assert(fs.existsSync(path.join(DIST, 'nagornaya/chast-1/index.html')), 'run production-like build first');
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({serviceWorkers:'block'});
    await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort());
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (let part = 1; part <= 5; part += 1) {
        await page.goto(`http://127.0.0.1:${port}/nagornaya/chast-${part}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#bottomBar .nag-bar-controls', { state: 'attached' });
        await page.waitForTimeout(350);
        const state = await page.evaluate((isVisibleSource) => {
          const isVisible = eval(`(${isVisibleSource})`);
          const bar = document.getElementById('bottomBar');
          const cluster = document.querySelectorAll('#bottomBar .nag-bar-controls');
          const visibleEmbers = [...document.querySelectorAll('.gb-ember')].filter(isVisible).length;
          const visibleSaves = [...document.querySelectorAll('.gb-save')].filter(isVisible).length;
          return {
            barVisible: isVisible(bar),
            clusterCount: cluster.length,
            clusterEmberCount: document.querySelectorAll('#bottomBar .nag-bar-controls .gb-ember').length,
            clusterSaveCount: document.querySelectorAll('#bottomBar .nag-bar-controls .gb-save').length,
            clusterThemeCount: document.querySelectorAll('#bottomBar .nag-bar-controls .nag-sidebar-theme-btn').length,
            clusterFontCount: document.querySelectorAll('#bottomBar .nag-bar-controls .nag-fontsize-btns').length,
            visibleEmbers,
            visibleSaves,
          };
        }, visible.toString());
        assert(state.barVisible, `part ${part} @ ${width}: bottom bar hidden`);
        assert.strictEqual(state.clusterCount, 1, `part ${part} @ ${width}: duplicate/missing bar cluster`);
        assert.strictEqual(state.clusterEmberCount, 1, `part ${part} @ ${width}: bar Play count`);
        assert.strictEqual(state.clusterSaveCount, 1, `part ${part} @ ${width}: bar Save count`);
        assert.strictEqual(state.clusterThemeCount, 0, `part ${part} @ ${width}: cloned theme must be removed`);
        assert.strictEqual(state.clusterFontCount, 0, `part ${part} @ ${width}: cloned font controls must be removed`);
        assert.strictEqual(state.visibleEmbers, 1, `part ${part} @ ${width}: competing visible Play controls`);
        assert.strictEqual(state.visibleSaves, 1, `part ${part} @ ${width}: competing visible Save controls`);
        // Screen visibility is a CSS-owned state, not an inline important
        // escape hatch which could override the physical print contract.
        const snapshot = () => page.evaluate(() => {
          const bar = document.getElementById('bottomBar');
          const overlay = document.getElementById('btocOverlay');
          return {
            bar: getComputedStyle(bar).display,
            overlay: getComputedStyle(overlay).display,
            inline: [bar, overlay].map(el => el.style.getPropertyValue('display')),
            main: document.querySelector('#main-content').getClientRects().length > 0,
            cluster: bar.querySelectorAll('.nag-bar-controls').length
          };
        });
        const screen = await snapshot();
        assert.deepStrictEqual(screen, { bar: 'block', overlay: 'block', inline: ['', ''], main: true, cluster: 1 });
        await page.locator('#barSectionBtn').click();
        await page.waitForFunction(() => {
          const panel = document.getElementById('btocPanel');
          const r = panel.getBoundingClientRect();
          return r.top < innerHeight - 30 && r.bottom > 0 &&
            getComputedStyle(document.getElementById('btocOverlay')).opacity === '1';
        });
        await page.locator('#btocClose').click();
        await page.waitForFunction(() => !document.body.classList.contains('ng-toc-lock') &&
          !document.documentElement.hasAttribute('data-scroll-locked'));
        await page.emulateMedia({ media: 'print' });
        assert.deepStrictEqual(await snapshot(), { bar: 'none', overlay: 'none', inline: ['', ''], main: true, cluster: 1 });
        await page.emulateMedia({ media: 'screen' });
        assert.deepStrictEqual(await snapshot(), screen, 'screen controls restored without duplicate cluster');
      }
    }

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`http://127.0.0.1:${port}/nagornaya/chast-1/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    const desktop = await page.evaluate(() => {
      const bar = document.getElementById('bottomBar');
      const style = bar ? getComputedStyle(bar) : null;
      return {
        displayed: !!bar && style.display !== 'none',
        inlineDisplay: bar ? bar.style.getPropertyValue('display') : null,
      };
    });
    assert.strictEqual(desktop.displayed, false, 'desktop: bottom bar must remain hidden');
    assert.strictEqual(desktop.inlineDisplay, '', 'desktop: mobile inline display override must be removed');
    // Initial desktop load must bind the *same* mobile controls before
    // the floating controller scans. The page does not reload on resize.
    for (const [name, engine] of [['chromium',chromium],['webkit',webkit]]) {
      const adaptive=await engine.launch({headless:true});
      try {
        for(let part=1;part<=5;part++){
          const p=await adaptive.newPage({viewport:{width:1024,height:768},serviceWorkers:'block'});
          try {
            await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort());
            p.on('pageerror',error=>pageErrors.push(String(error)));
            await p.goto('http://127.0.0.1:'+port+'/nagornaya/chast-'+part+'/',{waitUntil:'load'});
            const readState=()=>{
              const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
              const bar=document.getElementById('bottomBar');
              const cluster=bar.querySelector('.nag-bar-controls');
              return {epoch:performance.timeOrigin,bar:visible(bar),
                clusters:bar.querySelectorAll('.nag-bar-controls').length,
                fallback:document.querySelectorAll('.gb-mobile-fallback-controls').length,
                play:[...document.querySelectorAll('.gb-ember')].filter(visible).length,
                save:[...document.querySelectorAll('.gb-save')].filter(visible).length,
                inBar:!!cluster&&visible(cluster.querySelector('.gb-ember'))&&visible(cluster.querySelector('.gb-save'))};
            };
            const read=()=>p.evaluate(readState);
            await p.waitForSelector('#bottomBar .nag-bar-controls',{state:'attached'});
            const initial=await read();
            assert.deepStrictEqual(initial,{epoch:initial.epoch,bar:false,clusters:1,fallback:0,play:1,save:1,inBar:false},name+' part '+part+' desktop initial');
            for(const width of [390,1024,360,1024]){
              await p.setViewportSize({width,height:844});
              const mobile=width<900;
              const expected={epoch:initial.epoch,bar:mobile,clusters:1,fallback:0,play:1,save:1,inBar:mobile};
              // WebKit may expose a layout rect before style visibility and
              // the responsive control owner have converged. Poll the actual
              // contract, not an unrelated presence-of-rect proxy.
              const deadline=Date.now()+3000;
              const samples=[];
              let state;
              do {
                state=await read();
                samples.push(state);
                if(Object.keys(expected).every(key=>state[key]===expected[key]))break;
                await p.evaluate(()=>new Promise(requestAnimationFrame));
              } while(Date.now()<deadline);
              try {
                assert.deepStrictEqual(state,expected,name+' part '+part+' @'+width);
                // Verify the exact state again on the next painted frame.
                await p.evaluate(()=>new Promise(requestAnimationFrame));
                assert.deepStrictEqual(await read(),expected,name+' part '+part+' @'+width+' settled');
              } catch(error) {
                console.error('NAGORNAYA_RESIZE_EVIDENCE '+JSON.stringify({name,part,width,expected,samples:samples.slice(-12),viewport:await p.evaluate(()=>({innerWidth,innerHeight,matches:matchMedia('(max-width:899px)').matches,barDisplay:getComputedStyle(document.getElementById('bottomBar')).display,barVisibility:getComputedStyle(document.getElementById('bottomBar')).visibility,body:document.body.className}))}));
                throw error;
              }
              if(mobile){
                const save=p.locator('#bottomBar .nag-bar-controls .gb-save');
                const before=await save.getAttribute('aria-pressed');
                assert(['true','false'].includes(before),name+' canonical Save state');
                await save.click();
                await p.waitForFunction(before=>[...document.querySelectorAll('.gb-save')].every(e=>e.getAttribute('aria-pressed')!==before),before);
                await save.click();
                await p.waitForFunction(before=>[...document.querySelectorAll('.gb-save')].every(e=>e.getAttribute('aria-pressed')===before),before);
              }
            }
            console.log('PASS resize '+name+' part '+part+' desktop/mobile x2, exact Save round trip');
          } finally {await p.close()}
        }
      } finally {await adaptive.close()}
    }
    assert.deepStrictEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`);
    console.log('✅ Nagornaya bar browser matrix: parts 1–5 @ 360/390 and desktop 1024');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
