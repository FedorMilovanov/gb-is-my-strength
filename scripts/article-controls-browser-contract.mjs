#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const ROOT = process.cwd();
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const BASE = String(process.env.AUDIT_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const OUT = path.join(ROOT, 'reports', 'interactive-audit', 'article-control-census');
const VIEWS = [
  ['390', 390, 844, true], ['412', 412, 915, true],
  ['1024', 1024, 900, false], ['1366', 1366, 900, false],
];
const CLICK_VIEWS = new Set(['390', '1366']);

const clean = (s, n = 200) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const family = (r) => r.includes('hermenevticheskaya-otsenka') ? 'hermenevtika'
  : r.startsWith('/articles/dzhon-gill-') ? 'gill'
  : r.startsWith('/baptisty-rossii/') ? 'baptisty'
  : r.startsWith('/hard-texts/') ? 'hard-texts'
  : r.startsWith('/nagornaya/chast-') ? 'nagornaya'
  : r.startsWith('/articles/') ? 'articles' : 'other';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.isFile() && e.name === 'index.html') out.push(f);
  }
  return out;
}

function discoverRoutes() {
  const excluded = new Set(['/articles/','/baptisty-rossii/','/hard-texts/','/hard-texts/genesis-6/','/nagornaya/','/nagornaya/istochniki/','/nagornaya/nakhodki/','/nagornaya/seriya/']);
  const prefixes = ['/articles/','/baptisty-rossii/','/hard-texts/','/nagornaya/'];
  const routes = [];
  for (const f of walk(DIST)) {
    const rel = path.relative(DIST, f).split(path.sep).join('/');
    const route = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
    if (excluded.has(route) || !prefixes.some((p) => route.startsWith(p))) continue;
    const html = fs.readFileSync(f, 'utf8');
    if (html.includes('data-pagefind-body') && /<article\b|article-body/.test(html)) routes.push(route);
  }
  return [...new Set(routes)].sort();
}

async function makeContext(browser, width, height, mobile) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const origin = new URL(BASE).origin;
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    let same = false;
    try { same = new URL(u).origin === origin; } catch (_) {}
    if (same || u.startsWith('data:') || u.startsWith('blob:')) await route.continue();
    else await route.fulfill({ status: 204, contentType: 'text/plain', body: '' });
  });
  await ctx.addInitScript(() => {
    window.print = () => { window.__auditPrint = true; };
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__auditShare = true; } }); } catch (_) {}
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (v) => { window.__auditClip = String(v || ''); } } }); } catch (_) {}
  });
  return ctx;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const rendered = (e) => { const s=getComputedStyle(e), r=e.getBoundingClientRect(); return s.display!=='none' && s.visibility!=='hidden' && +s.opacity!==0 && r.width>.5 && r.height>.5; };
    const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('data-tip') || e.textContent || '').replace(/\s+/g,' ').trim();
    const controls = [...document.querySelectorAll('button,[role="button"]')].filter(rendered).map((e) => {
      const r=e.getBoundingClientRect(), inView=r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
      const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)), y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));
      const hit=document.elementFromPoint(x,y), inline=e.classList.contains('bref')||e.classList.contains('fn-marker')||!!e.closest('p,blockquote');
      const ordinal=e.classList.contains('fn-marker')?[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent||'').join('').replace(/\s+/g,'').trim():'';
      return { id:e.id||'', name:name(e).slice(0,160), text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,100), cls:String(e.className||'').slice(0,140), fc:e.getAttribute('data-fc-action')||'', action:e.getAttribute('data-action')||'', ariaControls:e.getAttribute('aria-controls')||'', ordinal, w:+r.width.toFixed(1), h:+r.height.toFixed(1), inView, clipped:inView&&(r.left<-1||r.top<-1||r.right>innerWidth+1||r.bottom>innerHeight+1), owns:!inView||!!(hit&&(hit===e||e.contains(hit))), inline };
    });
    const ids=[...document.querySelectorAll('[id]')].map(e=>e.id).filter(Boolean);
    return { overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth, controls, dupIds:[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))] };
  });
}

const keyOf = (c) => c.id ? `id:${c.id}` : c.fc ? `fc:${c.fc}:${c.name}` : c.action ? `a:${c.action}:${c.name}` : `${c.cls}:${c.name}`;
const clickable = (c) => !!(c.name||c.id||c.fc||c.action) && !/bref|fn-marker|quiz-option/.test(c.cls) && c.fc!=='play' && !/Озвучк|Пауза|Play/i.test(c.name);

async function reset(page, route) {
  for (let i=0;i<3;i++) { try { await page.keyboard.press('Escape'); } catch (_) {} await page.waitForTimeout(20); }
  if (new URL(page.url()).pathname !== route) { await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:30000}); await page.waitForTimeout(120); }
}

async function clickOne(page, route, c) {
  await reset(page, route);
  let loc = c.id ? page.locator(`[id="${c.id}"]`).first() : c.name ? page.getByRole('button',{name:c.name,exact:true}).first() : c.fc ? page.locator(`[data-fc-action="${c.fc}"]`).first() : page.locator(`[data-action="${c.action}"]`).first();
  if (!await loc.count()) return { ok:false, error:'locator-missing' };
  try { await loc.scrollIntoViewIfNeeded({timeout:2500}); await loc.click({timeout:3500}); } catch (e) { return {ok:false,error:clean(e.message,300)}; }
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const vis=(e)=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0&&r.width>2&&r.height>2};
    const dialogs=[...document.querySelectorAll('[role="dialog"],dialog')].filter(vis).map(e=>({id:e.id||'',text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,400),rect:(()=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})()}));
    const cp=document.querySelector('.cp-backdrop.is-open');
    const openText=[...document.querySelectorAll('.is-open,[aria-hidden="false"],[open]')].filter(vis).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim()).join(' ').slice(0,1200);
    const cpLinks=cp?[...cp.querySelectorAll('a[href]')].filter(vis).map(a=>a.getAttribute('href')||''):[];
    return {ok:true,url:location.href,dialogs,openText,cp:!!cp,cpInternal:cpLinks.filter(h=>h.startsWith('/')||h.startsWith('.')||h.startsWith('#')).length,print:window.__auditPrint===true,share:window.__auditShare===true,clip:window.__auditClip||'',dark:document.documentElement.classList.contains('dark')};
  });
}

function semanticIssues(c,o) {
  if (!o.ok) return [['click-failed',o.error]];
  const label=`${c.name} ${c.text}`, surface=`${o.dialogs.map(d=>d.text).join(' ')} ${o.openText}`;
  const out=[];
  if (/Настройки чтения|Настройки$/i.test(label) && !/Настройки|Тема|Размер текста|Межстроч/i.test(surface)) out.push(['settings-opened-wrong-surface',{label,dialogs:o.dialogs,cp:o.cp}]);
  if (/Открыть оглавление|Оглавление статьи|Сейчас читаете/i.test(label) && !/Оглавление|раздел/i.test(surface)) out.push(['toc-opened-wrong-surface',{label,dialogs:o.dialogs,cp:o.cp}]);
  if ((c.fc==='search'||/Поиск и разделы сайта/i.test(label)) && !o.cp) out.push(['global-search-did-not-open-command-palette',{label,dialogs:o.dialogs}]);
  if (/Поиск и разделы сайта/i.test(label) && o.cp && o.cpInternal<2) out.push(['menu-label-but-no-section-links',{label,links:o.cpInternal}]);
  if (c.action==='print' && !o.print) out.push(['print-no-outcome',label]);
  if ((c.action==='share'||/Поделиться/i.test(label)) && !(o.dialogs.length||o.share||o.clip)) out.push(['share-no-outcome',label]);
  return out;
}

async function scene(browser, browserName, route, view, doClicks) {
  const [viewName,width,height,mobile]=view, ctx=await makeContext(browser,width,height,mobile), page=await ctx.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(`PAGE_ERROR: ${clean(e.message,500)}`));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|yandex|metrika/i.test(m.text())) errors.push(clean(m.text(),500))});
  const issues=[], clicks=[];
  try {
    const resp=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:30000}); await page.waitForTimeout(250);
    if(!resp||!resp.ok()) issues.push(['route-status',resp?resp.status():null]);
    const snap=await snapshot(page);
    if(snap.overflow>1) issues.push(['page-horizontal-overflow',snap.overflow]);
    if(snap.dupIds.length) issues.push(['duplicate-dom-ids',snap.dupIds.slice(0,20)]);
    for(const c of snap.controls){
      if(!c.name&&!c.inline) issues.push(['control-no-accessible-name',c]);
      if(!c.inline&&(c.w<24||c.h<24)) issues.push(['small-control-target',c]);
      if(!c.inline&&c.clipped) issues.push(['control-clipped',c]);
      if(!c.inline&&c.inView&&!c.owns) issues.push(['control-center-obscured',c]);
      if(/fn-marker/.test(c.cls)&&/^\d+$/.test(c.ordinal)&&/^Показать сноску$/i.test(c.name)) issues.push(['footnote-name-not-unique',c]);
      if(/fn-marker/.test(c.cls)&&/^\d+$/.test(c.ordinal)&&!c.ariaControls) issues.push(['footnote-missing-aria-controls',c]);
    }
    if(doClicks){
      const seen=new Set();
      for(const c of snap.controls){
        const k=keyOf(c); if(!clickable(c)||seen.has(k)) continue; seen.add(k);
        const o=await clickOne(page,route,c); clicks.push({control:c,outcome:o});
        for(const [kind,detail] of semanticIssues(c,o)) issues.push([kind,{control:c,detail}]);
        if(o.ok) for(const d of o.dialogs){const [l,t,r,b]=d.rect;if(l<-2||t<-2||r>width+2||b>height+2) issues.push(['dialog-outside-viewport',{control:c,dialog:d}]);}
      }
    }
    if(errors.length) issues.push(['runtime-errors',errors.slice(0,8)]);
    if(issues.length){ fs.mkdirSync(OUT,{recursive:true}); try{await page.screenshot({path:path.join(OUT,`${route.replace(/\W+/g,'_')}-${browserName}-${viewName}.png`),fullPage:true})}catch(_){} }
    return {route,family:family(route),browser:browserName,view:viewName,controls:snap.controls.length,clicks,issues};
  } finally { await page.close().catch(()=>{}); await ctx.close().catch(()=>{}); }
}

async function main(){
  fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
  const routes=discoverRoutes(); if(routes.length<55) throw new Error(`Reading route census ${routes.length}<55: ${routes.join(', ')}`);
  const scenes=[]; const cb=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  try{for(const r of routes)for(const v of VIEWS)scenes.push(await scene(cb,'chromium',r,v,CLICK_VIEWS.has(v[0])))}finally{await cb.close()}
  const reps=[]; for(const f of ['hermenevtika','gill','baptisty','hard-texts','nagornaya','articles']){const r=routes.find(x=>family(x)===f);if(r)reps.push(r)}
  const wb=await webkit.launch({headless:true}); try{for(const r of reps)for(const v of VIEWS.filter(x=>CLICK_VIEWS.has(x[0])))scenes.push(await scene(wb,'webkit',r,v,true))}finally{await wb.close()}
  const issues=scenes.flatMap(s=>s.issues.map(([kind,detail])=>({route:s.route,family:s.family,browser:s.browser,view:s.view,kind,detail})));
  const summary={schemaVersion:1,sourceSha:process.env.SOURCE_SHA||'',generatedAt:new Date().toISOString(),routeCount:routes.length,sceneCount:scenes.length,controlObservations:scenes.reduce((n,s)=>n+s.controls,0),uniqueControlClicks:scenes.reduce((n,s)=>n+s.clicks.length,0),webkitRepresentatives:reps,issueCount:issues.length,issues};
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2)+'\n'); fs.writeFileSync(path.join(OUT,'scenes.json'),JSON.stringify(scenes,null,2)+'\n');
  console.log(`ARTICLE CONTROL CENSUS routes=${summary.routeCount} scenes=${summary.sceneCount} controls=${summary.controlObservations} clicks=${summary.uniqueControlClicks}`);
  if(issues.length){console.log(`❌ ${issues.length} issue(s)`);for(const i of issues.slice(0,150))console.log(`- ${i.kind} ${i.browser}/${i.view} ${i.route}: ${JSON.stringify(i.detail)}`);process.exitCode=1}else console.log('✅ Article control census passed');
}
main().catch(e=>{console.error('FATAL',e);process.exitCode=1});
