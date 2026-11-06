#!/usr/bin/env node
// Exclusive flag-on contract: run ONLY after building a fresh candidate with
// PUBLIC_GB_GROK_HERMENEUTICS_PILOT=1. Never serves the published website.
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
assert.match(fs.readFileSync(TARGET, 'utf8'), /hrail--grok/,
  'flag-on candidate was not built; do not test stale dist');
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
        const errors = [];
        page.on('pageerror',e => errors.push(e.message));
        try {
          await page.goto(origin + ROUTE, {waitUntil:'domcontentloaded'});
          await page.waitForTimeout(500);
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
          } else {
            check(name,viewport.id,'existing right cluster retained',snapshot.right);
            check(name,viewport.id,'disclosure initialized',snapshot.ready);
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
          }
          check(name,viewport.id,'no uncaught JavaScript errors',errors.length===0,errors);
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
fs.writeFileSync(path.join(reports,'results.json'),JSON.stringify({checks,passed:checks.length},null,2));
console.log('GROK STAGE 2 BROWSER CONTRACT: '+checks.length+'/'+checks.length+' PASS (Chromium/Firefox/WebKit)');
