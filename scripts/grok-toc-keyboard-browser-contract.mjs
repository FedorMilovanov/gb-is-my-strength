#!/usr/bin/env node
// Keyboard accessibility of the real Grok rail on a built Product route.
// No mock headings, new scroll owner, global keyboard handler, or user data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const route = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const htmlFile = path.join(dist, route.slice(1), 'index.html');
assert.ok(fs.existsSync(htmlFile), 'Build real Product before running browser contract');
assert.match(fs.readFileSync(htmlFile, 'utf8'), /<aside\s+class="hrail hrail--grok"/,
  'The candidate build must have the Grok route flag ON');

const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
  '.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};
const server = http.createServer((req,res) => {
  try {
    const uri = decodeURIComponent((req.url || '/').split('?')[0]);
    const target = path.resolve(dist, '.' + (uri.endsWith('/') ? uri + 'index.html' : uri));
    const rel = path.relative(dist, target);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, {'content-type':mime[path.extname(target)]||'application/octet-stream'});
    fs.createReadStream(target).pipe(res);
  } catch {
    res.writeHead(400); res.end('bad request');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;

const reports = path.join(root, 'reports', 'grok-keyboard');
fs.mkdirSync(reports, {recursive:true});
const cases = [];
function check(engine, viewport, label, condition, observed) {
  cases.push({engine,viewport,label,passed:Boolean(condition),observed});
  assert.ok(condition, engine + '/' + viewport + ': ' + label + ' => ' + JSON.stringify(observed));
}
const viewports = [{id:'desktop-1200',width:1200,height:800},
  {id:'desktop-short',width:1440,height:300},
  {id:'desktop-wide',width:1440,height:900}];
const getState = (page) => page.evaluate(() => ({
  key: document.activeElement?.closest('li.grok-row')?.getAttribute('data-grok-key') || null,
  tag: document.activeElement?.tagName,
  href: location.hash,
  scroll: Math.round(window.scrollY),
  active: [...document.querySelectorAll('#hrailToc a[aria-current]')]
    .map(a=>a.getAttribute('href')),
  all: [...document.querySelectorAll('#hrailToc li.grok-row')]
    .filter(row => {
      let parent = row.parentElement?.closest('li.grok-row');
      while (parent) {
        if (parent.hasAttribute('data-grok-collapsed')) return false;
        parent = parent.parentElement?.closest('li.grok-row');
      }
      return true;
    }).map(row=>row.getAttribute('data-grok-key'))
}));
try {
  for (const [name,engine] of Object.entries({chromium,firefox,webkit})) {
    const browser = await engine.launch({headless:true});
    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});
        await page.route('**/*', (request) => {
          const host = new URL(request.request().url()).hostname;
          return /(^|\.)(?:yandex\.(?:ru|com)|yastatic\.net)$/i.test(host)
            ? request.fulfill({status:200,contentType:'application/javascript',body:''})
            : request.continue();
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin + route, {waitUntil:'domcontentloaded'});
          await page.waitForFunction(() => document.querySelector('.hrail--grok.grok-ready #hrailToc'));
          const rows = page.locator('#hrailToc li.grok-row');
          const all = await getState(page);
          check(name,viewport.id,'projected real headings exist',all.all.length>=10,all.all);
          const first = rows.first();
          const firstLink = first.locator(':scope > .grok-entry > a');
          await firstLink.focus();
          const initial = await getState(page);
          check(name,viewport.id,'first heading receives keyboard focus',initial.key===all.all[0],initial);
          await firstLink.press('ArrowDown');
          let state = await getState(page);
          check(name,viewport.id,'Down focuses next visible real heading',state.key===all.all[1],state);
          const focusRing = await page.evaluate(() => ({
            width:getComputedStyle(document.activeElement).outlineWidth,
            style:getComputedStyle(document.activeElement).outlineStyle,
          }));
          check(name,viewport.id,'keyboard focus has a route-scoped visible outline',
            focusRing.width==='2px' && focusRing.style==='solid',focusRing);
          await page.keyboard.press('ArrowUp');
          state = await getState(page);
          check(name,viewport.id,'Up returns to previous heading',state.key===all.all[0],state);
          await page.keyboard.press('End');
          state = await getState(page);
          check(name,viewport.id,'End focuses last visible heading',state.key===all.all.at(-1),state);
          await page.keyboard.press('ArrowDown');
          check(name,viewport.id,'Down stops at last heading',(await getState(page)).key===all.all.at(-1));
          await page.keyboard.press('Home');
          state = await getState(page);
          check(name,viewport.id,'Home focuses first heading',state.key===all.all[0],state);
          await page.keyboard.press('ArrowUp');
          check(name,viewport.id,'Up stops at first heading',(await getState(page)).key===all.all[0]);
          check(name,viewport.id,'arrows do not change URL',state.href===initial.href,state);
          check(name,viewport.id,'arrows scroll the rail, never the article',
            Math.abs(state.scroll-initial.scroll)<3,state);
          check(name,viewport.id,'arrows do not change ReaderState active link',
            JSON.stringify(state.active)===JSON.stringify(initial.active),state);

          const branch = page.locator('#hrailToc li.grok-row--branch').first();
          const button = branch.locator(':scope > .grok-entry [data-grok-toggle]');
          const branchLink = branch.locator(':scope > .grok-entry > a');
          const child = branch.locator(':scope > .grok-child-motion > .grok-child-clip > .grok-child-list > li.grok-row').first();
          const childKey = await child.getAttribute('data-grok-key');
          const branchKey = await branch.getAttribute('data-grok-key');
          await branchLink.focus();
          await branchLink.press('ArrowLeft');
          check(name,viewport.id,'Left collapses an expanded branch',await button.getAttribute('aria-expanded')==='false');
          check(name,viewport.id,'collapsed branch is inert',
            await branch.locator(':scope > .grok-child-motion .grok-child-list').first().getAttribute('inert')!==null);
          const collapsed = await getState(page);
          check(name,viewport.id,'collapse removes descendants from keyboard traversal',
            !collapsed.all.includes(childKey),collapsed.all);
          await branchLink.press('ArrowDown');
          state = await getState(page);
          const branchIndex = collapsed.all.indexOf(branchKey);
          check(name,viewport.id,'Down skips all collapsed descendants',
            state.key===collapsed.all[Math.min(branchIndex+1,collapsed.all.length-1)],state);
          await branchLink.focus();
          await branchLink.press('ArrowRight');
          check(name,viewport.id,'Right expands branch',await button.getAttribute('aria-expanded')==='true');
          check(name,viewport.id,'expansion removes inert subtree',await child.locator('a').first().getAttribute('inert')===null &&
            await branch.locator(':scope > .grok-child-motion .grok-child-list').first().getAttribute('inert')===null);
          await branchLink.press('ArrowRight');
          state = await getState(page);
          check(name,viewport.id,'Right enters first child heading',state.key===childKey,state);
          const childHasToggle = await child.locator(':scope > .grok-entry [data-grok-toggle]').count()>0;
          if (!childHasToggle) {
            await page.keyboard.press('ArrowLeft');
            check(name,viewport.id,'Left on leaf returns to branch',(await getState(page)).key===branchKey);
          }
          await branchLink.focus();
          await page.keyboard.press('Tab');
          state = await getState(page);
          check(name,viewport.id,'Tab retains native disclosure button',
            state.key===branchKey && state.tag==='BUTTON',state);
          await page.keyboard.press('ArrowDown');
          check(name,viewport.id,'Down from disclosure follows same visible tree',
            (await getState(page)).key===childKey);
          await child.locator(':scope > .grok-entry > a').focus();
          await button.evaluate(b => b.click());
          state = await getState(page);
          check(name,viewport.id,'collapsing a focused subtree restores focus to toggle',
            state.key===branchKey && state.tag==='BUTTON',state);
          check(name,viewport.id,'no focus trapped inside inert descendants',
            !(await page.evaluate(()=>document.activeElement?.closest('[inert]'))));
          await button.evaluate(b => b.click());
          check(name,viewport.id,'original disclosure click still reopens',await button.getAttribute('aria-expanded')==='true');

          // Closing and opening branches never changes in-document history.
          check(name,viewport.id,'keyboard disclosure never navigates article',
            (await page.evaluate(()=>location.hash))===initial.href);
          check(name,viewport.id,'no horizontal overflow',
            await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
          check(name,viewport.id,'no first-party JS errors',errors.length===0,errors);
        } finally {await page.close();}
      }
    } finally {await browser.close();}
  }
} finally {
  await new Promise(resolve=>server.close(resolve));
}
fs.writeFileSync(path.join(reports,'results.json'),JSON.stringify({
  source:'real Product dist',checks:cases.length,passes:cases.filter(c=>c.passed).length,cases
},null,2));
console.log('GROK TOC KEYBOARD PRODUCT: '+cases.filter(c=>c.passed).length+'/'+cases.length+
  ' PASS (Chromium/Firefox/WebKit, 1200/1440/short).');
