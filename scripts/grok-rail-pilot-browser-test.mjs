#!/usr/bin/env node
// Flag-on and flag-off contracts for a fresh local candidate build.
// No published website is modified or served by this test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const TARGET = path.join(DIST, ROUTE.replace(/^\/+|\/+$/g, ''), 'index.html');
assert.ok(fs.existsSync(TARGET), 'fresh production-like Hermeneutics dist is required');
const flagOff = process.argv.includes('--flag-off');
const htmlCandidate = fs.readFileSync(TARGET,'utf8');
// A stylesheet may still contain a Grok selector in a flag-off build.
// Only the DOM itself is the feature flag's truthful witness.
assert.match(htmlCandidate, flagOff ? /<aside\s+class="hrail"/ : /<aside\s+class="hrail hrail--grok"/,
  'candidate build does not have the requested route-flag state');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png',
  '.webp':'image/webp', '.woff2':'font/woff2', '.json':'application/json' };
function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req,res) => {
      try {
        const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
        let target = path.resolve(DIST, pathname.replace(/^\/+/, ''));
        if (!path.extname(target)) target = path.join(target, 'index.html');
        const rel = path.relative(DIST, target);
        if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel) ||
          !fs.existsSync(target) || !fs.statSync(target).isFile()) {
          res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream',
          'cache-control':'no-store' });
        fs.createReadStream(target).pipe(res);
      } catch {
        res.writeHead(400); res.end('bad request');
      }
    });
    server.listen(0,'127.0.0.1',() => resolve({server, origin:'http://127.0.0.1:' + server.address().port}));
  });
}
// This is an offline Product contract. Yandex analytics is a third-party owner:
// the CI runner may deny its watch beacons; that must not masquerade as a
// ReaderRail exception. Do not filter or suppress first-party pageerror.
async function isolateAnalytics(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!/(^|\.)(?:yandex\.(?:ru|com)|yastatic\.net)$/i.test(url.hostname)) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: route.request().resourceType() === 'script'
        ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8',
      body: '',
    });
  });
}

const checks = [];
function check(engine, viewport, name, ok, evidence = null) {
  checks.push({engine, viewport, name, pass:Boolean(ok), evidence});
  assert.ok(ok, engine + ' ' + viewport + ' ' + name + ': ' + JSON.stringify(evidence));
}
const viewports = [
  {id:'mobile-390', width:390, height:844},
  {id:'mobile-1199', width:1199, height:768},
  {id:'desktop-1200', width:1200, height:800},
  {id:'desktop-short', width:1440, height:300},
  {id:'desktop-wide', width:1440, height:900},
];
const reports = path.join(ROOT, 'reports', 'grok-stage2');
fs.mkdirSync(reports, {recursive:true});
const {server,origin} = await serve();
try {
  for (const [name,engine] of Object.entries({chromium,firefox,webkit})) {
    const browser = await engine.launch({headless:true});
    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
        await isolateAnalytics(page);
        const errors = [];
        page.on('pageerror',e => errors.push(e.message));
        try {
          await page.goto(origin + ROUTE, {waitUntil:'domcontentloaded'});
          await page.waitForTimeout(500);
          if (flagOff) {
            const fallback = await page.evaluate(() => {
              const rail=document.querySelector('.hrail');
              const list=document.getElementById('hrailToc');
              const links=Array.from(list?.querySelectorAll(':scope > li:not(.hrail-track-slot) a[href]') || []);
              return {
                rail:!!rail, optIn:!!document.querySelector('.hrail--grok, .grok-toc'),
                oldFlatToc:!!list && list.classList.contains('hrail-toc'),
                links:links.length, allTargetsExist:links.every(a=>!!document.getElementById(decodeURIComponent(a.hash.slice(1)))),
                visible:rail && getComputedStyle(rail).display!=='none',
                mobileControls:!!document.querySelector('.hmbar') && !!document.querySelector('.hmtop'),
                floating:!!document.getElementById('gbFloatingControls'),
                content:!!document.querySelector('[data-hm-reader]'),
                overflow:document.documentElement.scrollWidth-innerWidth,
                decoration:links.length?getComputedStyle(links[0]).textDecorationLine:null
              };
            });
            check(name,viewport.id,'flag-off original rail renders',fallback.rail && fallback.oldFlatToc,fallback);
            check(name,viewport.id,'flag-off no Grok DOM elements',!fallback.optIn,fallback);
            check(name,viewport.id,'flag-off original canonical hrefs',fallback.links===10 && fallback.allTargetsExist,fallback);
            check(name,viewport.id,'flag-off mobile and desktop boundaries',
              viewport.width < 1200 ? !fallback.visible && fallback.mobileControls : fallback.visible && fallback.floating,fallback);
            check(name,viewport.id,'flag-off published text remains',fallback.content,fallback);
            check(name,viewport.id,'flag-off no horizontal overflow',fallback.overflow <= 2,fallback.overflow);
            check(name,viewport.id,'flag-off TOC links not underlined',fallback.decoration==='none',fallback.decoration);
            check(name,viewport.id,'flag-off no JavaScript errors',errors.length===0,errors);
            continue;
          }
          const snapshot = await page.evaluate(() => {
            const rail = document.querySelector('.hrail--grok');
            const menu = document.querySelector('#hrailToc');
            const scroll = document.querySelector('.hrail-scroll');
            const rect = rail?.getBoundingClientRect();
            const right = document.querySelector('#gbFloatingControls');
            const linkIds = Array.from(menu?.querySelectorAll('li[data-grok-heading] > .grok-entry > a') || [])
              .map(link => link.getAttribute('href'));
            return {rail:!!rail, hidden:rail ? getComputedStyle(rail).display === 'none' : null,
              menu:!!menu, ready:rail?.classList.contains('grok-ready'),
              links:linkIds, scrollHeight:scroll?.clientHeight, right:!!right,
              decoration:getComputedStyle(menu.querySelector('li[data-grok-heading] > .grok-entry > a')).textDecorationLine,
              overflow:document.documentElement.scrollWidth - innerWidth,
              actualHeadingIds:linkIds.map(href => !!document.getElementById(decodeURIComponent(href.slice(1)))),
              content:!!document.querySelector('[data-hm-reader]'),
              rect:rect && {x:rect.x,width:rect.width,height:rect.height}};
          });
          check(name,viewport.id,'route-flag and canonical menu',snapshot.rail && snapshot.menu && snapshot.links.length===10,snapshot);
          check(name,viewport.id,'canonical anchor targets',snapshot.actualHeadingIds.every(Boolean),snapshot.actualHeadingIds);
          check(name,viewport.id,'TOC links are never underlined',snapshot.decoration==='none',snapshot.decoration);
          check(name,viewport.id,'no horizontal overflow',snapshot.overflow <= 2,snapshot.overflow);
          check(name,viewport.id,'reading content untouched',snapshot.content,snapshot);
          check(name,viewport.id,'desktop visibility unchanged by pilot',
            viewport.width < 1200 ? snapshot.hidden : !snapshot.hidden,snapshot.hidden);
          if(viewport.width < 1200) {
            check(name,viewport.id,'mobile controls retained',
              await page.locator('.hmbar').count()>0 && await page.locator('.hmtop').count()>0);
            const mobileDocument = await page.evaluate(() => {
              const heading=document.querySelector('article h1');
              const notice=document.querySelector('aside.notice');
              const link=document.querySelector('.hmsheet-sub .hmsheet-link');
              return {
                titleTop:Math.round(heading?.getBoundingClientRect().top ?? -1),
                noticeAfterTitle:!!heading && !!notice &&
                  !!(heading.compareDocumentPosition(notice)&Node.DOCUMENT_POSITION_FOLLOWING),
                licenseLinks:notice?.querySelectorAll('a').length,
                nestedLink:!!link
              };
            });
            check(name,viewport.id,'article headline before rights in mobile first screen',
              mobileDocument.titleTop>=0 && mobileDocument.titleTop<viewport.height-100 &&
              mobileDocument.noticeAfterTitle && mobileDocument.licenseLinks===3,mobileDocument);
            const mobileTrigger=page.locator('#hmBottomBtn');
            await mobileTrigger.click();
            const nestedContrast=await page.locator('.hmsheet-sub .hmsheet-link').first().evaluate(el=>{
              const foreground=getComputedStyle(el).color;
              const background=getComputedStyle(el.closest('.hmsheet-panel')).backgroundColor;
              const read=c=>(c.match(/[\d.]+/g)||[]).map(Number);
              const fg=read(foreground),bg=read(background);
              const alpha=fg[3]??1;
              const color=fg.slice(0,3).map((x,i)=>x*alpha+bg[i]*(1-alpha));
              const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;})
                .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
              const a=luminance(color),b=luminance(bg);
              return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
            });
            check(name,viewport.id,'mobile nested TOC meets WCAG AA contrast',
              nestedContrast>=4.5,Number(nestedContrast.toFixed(2)));
            await page.locator('#hmSheetClose').click();
          } else {
            check(name,viewport.id,'existing right cluster retained',snapshot.right);
            check(name,viewport.id,'disclosure initialized',snapshot.ready);
            const integrated=await page.evaluate(()=>{
              const rail=document.querySelector('.hrail--grok'),r=rail.getBoundingClientRect(),style=getComputedStyle(rail);
              const library=document.querySelector('#gb-hl-fab');
              const toggle=document.querySelector('#hrailLayoutToggle');
              return {left:Math.round(r.left),top:Math.round(r.top),radius:style.borderRadius,
                shadow:style.boxShadow,width:Math.round(r.width),
                libraryDocked:library?.parentElement?.classList.contains('hrail-bottom'),
                toggleReady:toggle?.getAttribute('aria-expanded')==='true'};
            });
            check(name,viewport.id,'V26 integrated rail rather than floating rounded card',
              integrated.left===0 && integrated.top===0 &&
              integrated.radius==='0px' && integrated.shadow==='none' &&
              integrated.width>=280,integrated);
            check(name,viewport.id,'canonical Library V3 docked in Grok rail',
              integrated.libraryDocked,integrated);
            check(name,viewport.id,'Grok layout toggle ready',
              integrated.toggleReady,integrated);
            const articleBefore=await page.locator('main.article-main--hrail')
              .evaluate(el => ({left:el.getBoundingClientRect().left,width:el.getBoundingClientRect().width}));
            const axis=await page.evaluate(()=>{
              const toc=document.querySelector('.grok-toc'),track=toc?.querySelector('.hrail-track');
              const dots=Array.from(toc?.querySelectorAll(':scope > li.grok-row--h2 > .grok-entry > .hrail-dot')??[]);
              if(!track||dots.length<2)return null;
              const t=track.getBoundingClientRect();
              const ys=dots.map(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
              return {x:t.left+t.width/2,top:t.top,bottom:t.bottom,first:ys[0],last:ys[ys.length-1]};
            });
            check(name,viewport.id,'V17 optical H2 track anchored to real dot centres',
              !!axis && Math.abs(axis.x-axis.first.x)<.6 && Math.abs(axis.x-axis.last.x)<.6 &&
              Math.abs(axis.top-axis.first.y)<1 && Math.abs(axis.bottom-axis.last.y)<1,axis);
            const readingScrollBefore=await page.evaluate(() => Math.round(scrollY));
            await page.locator('#hrailLayoutToggle').click();
            await page.waitForFunction(() => Math.round(document.querySelector('.hrail--grok')?.getBoundingClientRect().width ?? 0) === 68, {timeout:1600});
            const compact=await page.evaluate(()=>{
              const rail=document.querySelector('.hrail--grok'),r=rail.getBoundingClientRect();
              return {width:Math.round(r.width),mode:document.body.classList.contains('grok-rail-compact'),
                aria:document.querySelector('#hrailLayoutToggle')?.getAttribute('aria-expanded'),
                inert:document.querySelector('.hrail-scroll')?.hasAttribute('inert')};
            });
            check(name,viewport.id,'real 68px compact rail with keyboard-inert TOC',
              compact.width===68 && compact.mode && compact.aria==='false' && compact.inert,compact);
            const articleAfter=await page.locator('main.article-main--hrail')
              .evaluate(el => ({left:el.getBoundingClientRect().left,width:el.getBoundingClientRect().width}));
            const focusTools=await page.evaluate(()=>{
              const tools=document.querySelector('#grokCompactTools');
              const original=document.querySelector('#gbFloatingControls');
              return {parent:original?.parentElement?.id,instances:document.querySelectorAll('#gbFloatingControls').length,
                hasTheme:!!tools?.querySelector('#gbFcTheme'),hasSearch:!!tools?.querySelector('#gbFcSearch'),
                hasPlayer:!!tools?.querySelector('.gb-ember'),hasSave:!!tools?.querySelector('.gb-save')};
            });
            check(name,viewport.id,'compact retains exact native four controls in left rail',
              focusTools.parent==='grokCompactTools'&&focusTools.instances===1&&focusTools.hasTheme&&
              focusTools.hasSearch&&focusTools.hasPlayer&&focusTools.hasSave,focusTools);
            // The original floating-cluster controller is delegated from BOTH
            // the floater and rail. A moved subtree must trigger exactly one
            // theme transition, not two toggles back to the original state.
            const themeBefore=await page.locator('html').getAttribute('data-reader-theme');
            await page.locator('#grokCompactTools #gbFcTheme').click();
            const themeAfter=await page.locator('html').getAttribute('data-reader-theme');
            check(name,viewport.id,'native theme fires once in compact rail',
              !!themeAfter && themeAfter!==themeBefore,
              {before:themeBefore,after:themeAfter});
            await page.locator('#grokCompactTools #gbFcTheme').click();
            const themeRestored=await page.locator('html').getAttribute('data-reader-theme');
            check(name,viewport.id,'compact theme action reversible',
              themeRestored===themeBefore,
              {before:themeBefore,restored:themeRestored});
            const readingScrollAfter=await page.evaluate(() => Math.round(scrollY));
            check(name,viewport.id,'compact rail rebalances actual article position',
              articleAfter.left+40<=articleBefore.left &&
              articleAfter.width>=articleBefore.width+50 &&
              readingScrollAfter===readingScrollBefore,
              {before:articleBefore,after:articleAfter,scrollBefore:readingScrollBefore,scrollAfter:readingScrollAfter});
            await page.locator('#hrailLayoutToggle').click();
            await page.waitForFunction(() => Math.round(document.querySelector('.hrail--grok')?.getBoundingClientRect().width ?? 0) >= 280, {timeout:1600});
            const reopened=await page.evaluate(()=>{
              const rail=document.querySelector('.hrail--grok');
              return {expanded:document.querySelector('#hrailLayoutToggle')?.getAttribute('aria-expanded'),
                width:Math.round(rail.getBoundingClientRect().width),
                inert:document.querySelector('.hrail-scroll')?.hasAttribute('inert')};
            });
            check(name,viewport.id,'rail reopens without leaving inert descendants',
              reopened.expanded==='true' && reopened.width>=280 && !reopened.inert,reopened);
            const nativeRestored=await page.evaluate(()=>({
              parent:document.querySelector('#gbFloatingControls')?.parentElement?.id,
              duplicates:document.querySelectorAll('#gbFloatingControls').length
            }));
            check(name,viewport.id,'real right controls restore to original host',
              nativeRestored.parent!=='grokCompactTools' && nativeRestored.duplicates===1,nativeRestored);
            if(viewport.height <= 420) {
              check(name,viewport.id,'usable short viewport',snapshot.scrollHeight >= 80,snapshot.scrollHeight);
            }
            const branch = page.locator('.grok-row--branch').first();
            const button = branch.locator(':scope > .grok-entry [data-grok-toggle]');
            const child = branch.locator('.grok-child-list').first();
            check(name,viewport.id,'real branch and disclosure',
              await button.count() === 1 && await child.locator('a').count()>=1);
            await page.evaluate(() => {
              const branch = document.querySelector('.grok-row--branch');
              const childLink = branch?.querySelector('.grok-child-list a');
              const disclosure = branch?.querySelector(':scope > .grok-entry [data-grok-toggle]');
              childLink?.focus({preventScroll:true});
              disclosure?.click();
            });
            const closed = await page.evaluate(() => {
              const branch = document.querySelector('.grok-row--branch');
              const child = branch?.querySelector('.grok-child-list');
              const button = branch?.querySelector(':scope > .grok-entry [data-grok-toggle]');
              return {collapsed:branch?.hasAttribute('data-grok-collapsed'),
                expanded:button?.getAttribute('aria-expanded'),
                inert:child?.hasAttribute('inert'),hidden:child?.getAttribute('aria-hidden'),
                focus:document.activeElement===button};
            });
            check(name,viewport.id,'focus-safe inert collapse',closed.collapsed &&
              closed.expanded==='false' && closed.inert && closed.hidden==='true' && closed.focus,closed);
            await button.evaluate(b => b.click());
            check(name,viewport.id,'reopen unlocks subtree',
              await child.getAttribute('inert')===null && await button.getAttribute('aria-expanded')==='true');
            await page.emulateMedia({reducedMotion:'reduce'});
            const duration = await page.locator('.grok-child-motion').first().evaluate(el=>getComputedStyle(el).transitionDuration);
            check(name,viewport.id,'reduced motion is instant',duration==='0s',duration);
            if (viewport.id==='desktop-wide' || viewport.id==='desktop-short') {
              await page.screenshot({path:path.join(reports, name+'-'+viewport.id+'.png'),fullPage:false});
            }
            // Navigation remains owned by ReaderState. A hash jump may
            // legitimately highlight the preceding H2 until the reading
            // line crosses H3; test the real location/visibility contract.
            if (viewport.id === 'desktop-wide') {
              const deepHref = await page.locator('.grok-child-list a').first().getAttribute('href');
              await page.locator('.grok-child-list a').first().click();
              await page.waitForFunction(h => location.hash === h, deepHref, { timeout:8000 });
              check(name,viewport.id,'nested H3 navigation updates canonical hash',true,deepHref);
              const targetRect = await page.locator('#'+deepHref.slice(1)).evaluate(el => el.getBoundingClientRect().toJSON());
              check(name,viewport.id,'nested H3 visible after navigation',
                targetRect.top >= -5 && targetRect.top < viewport.height - 25,targetRect);
              await page.goBack();
              await page.waitForFunction(() => location.hash === '', null, {timeout:8000});
              check(name,viewport.id,'Back restores empty hash',true);
              await page.waitForTimeout(400);
              const backY = await page.evaluate(() => window.scrollY);
              check(name,viewport.id,'Back restores original reading position',backY < 150,backY);
              await page.goForward();
              await page.waitForFunction(h => location.hash === h, deepHref, {timeout:8000});
              check(name,viewport.id,'Forward restores H3 hash',true);
              const forwardRect = await page.locator('#'+deepHref.slice(1)).evaluate(el=>el.getBoundingClientRect().toJSON());
              check(name,viewport.id,'Forward restores H3 visibility',
                forwardRect.top >= -5 && forwardRect.top < viewport.height-25,forwardRect);
              const fresh = await browser.newPage({viewport:{width:1440,height:900}});
              await isolateAnalytics(fresh);
              fresh.on('pageerror',e => errors.push(e.message));
              try {
                await fresh.goto(origin+ROUTE+deepHref,{waitUntil:'domcontentloaded'});
                await fresh.waitForFunction(h=>{const r=document.getElementById(h.slice(1))?.getBoundingClientRect();return r&&r.top>=-5&&r.top<innerHeight-25;},deepHref,{timeout:8000});
                const directRect = await fresh.locator('#'+deepHref.slice(1)).evaluate(el=>el.getBoundingClientRect().toJSON());
                check(name,viewport.id,'direct H3 permalink is visible',
                  directRect.top>=-5 && directRect.top < viewport.height-25,directRect);
                await fresh.goto(origin+ROUTE,{waitUntil:'domcontentloaded'});
                const rapid = fresh.locator('.grok-row--branch > .grok-entry [data-grok-toggle]').first();
                for(let n=0;n<7;n++){await rapid.evaluate(button => button.click());await fresh.waitForTimeout(25);}
                const rapidState = await rapid.evaluate(button => ({
                  expanded:button.getAttribute('aria-expanded'),
                  inert:button.closest('.grok-row')?.querySelector('.grok-child-list')?.hasAttribute('inert'),
                  collapsed:button.closest('.grok-row')?.hasAttribute('data-grok-collapsed')
                }));
                check(name,viewport.id,'seven rapid toggles end collapsed and inert',
                  rapidState.expanded==='false' && rapidState.inert && rapidState.collapsed,rapidState);
                await fresh.waitForTimeout(750);
                const collapsedHeight = await rapid.locator('xpath=../following-sibling::*').first().evaluate(el=>el.getBoundingClientRect().height);
                check(name,viewport.id,'interrupted collapse settles to zero height',
                  collapsedHeight < 1.5,collapsedHeight);
              } finally {await fresh.close();}
            }
          }
          check(name,viewport.id,'no uncaught JavaScript errors',errors.length===0,errors);
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
fs.writeFileSync(path.join(reports,flagOff?'results-off.json':'results.json'),JSON.stringify({flagOff,checks,passed:checks.length},null,2));
console.log('GROK STAGE 2 '+(flagOff?'FLAG OFF':'FLAG ON')+' BROWSER CONTRACT: '+checks.length+'/'+checks.length+' PASS (Chromium/Firefox/WebKit)');
