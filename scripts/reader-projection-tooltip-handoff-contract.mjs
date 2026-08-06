#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const REPORTS=path.join(ROOT,'reports');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const FOOT='[data-audit-footnote="40"]';
const FOOT_TIP='.tooltip.gb-floating-tip.is-open';
const TERM='[data-audit-glossary]';
const TERM_TIP='.gtip.gb-floating-tip.is-open';
const OWNED=['.gterm','.fn-marker','.bref[data-ref]'];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.bin':'application/octet-stream'};
fs.mkdirSync(REPORTS,{recursive:true});
assert.ok(fs.existsSync(DIST),'production-like dist is required');

const checks=[];
const record=(id,description,pass,evidence=null)=>checks.push({id,area:'tooltip-geometry',description,pass:Boolean(pass),evidence});
const frames=(page)=>page.evaluate(()=>new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

function serve(){return new Promise((resolve)=>{const server=http.createServer((request,response)=>{const pathname=decodeURIComponent((request.url||'/').split('?')[0]);let target=path.join(DIST,pathname.replace(/^\/+/,''));if(pathname.endsWith('/')||!path.extname(target))target=path.join(target,'index.html');if(!target.startsWith(DIST)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){response.writeHead(404);response.end('not found');return;}response.writeHead(200,{'content-type':MIME[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(target).pipe(response);});server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`}));});}

async function instrument(page){return page.evaluate(()=>{const direct=(el)=>Array.from(el?.childNodes||[]).filter((node)=>node.nodeType===Node.TEXT_NODE).map((node)=>node.textContent||'').join('').replace(/\s+/g,'').trim();const foot=Array.from(document.querySelectorAll('.fn-marker')).find((el)=>direct(el)==='40');if(foot)foot.dataset.auditFootnote='40';const term=Array.from(document.querySelectorAll('.article-body .gterm')).find((el)=>!el.closest('.summary-card')&&el.querySelector('.gtip [data-gtip-expand]')&&el.querySelector('.gtip .gtip-detail-wrap')&&el.querySelector('.gtip .gtip-papyrus'));if(term)term.dataset.auditGlossary='1';return{foot:Boolean(foot?.querySelector('.tooltip')),term:Boolean(term)};});}

async function quiet(page,quietMs=350,timeoutMs=5000){return page.evaluate(({quietMs,timeoutMs})=>new Promise((resolve)=>{let quietTimer=0,timeoutTimer=0;const finish=(quiet)=>{clearTimeout(quietTimer);clearTimeout(timeoutTimer);removeEventListener('gb:reader-projection-ready',arm);resolve({quiet,count:window.__projectionEvents.length,events:window.__projectionEvents.slice(-12)});};const arm=()=>{clearTimeout(quietTimer);quietTimer=setTimeout(()=>finish(true),quietMs);};addEventListener('gb:reader-projection-ready',arm);timeoutTimer=setTimeout(()=>finish(false),timeoutMs);arm();}),{quietMs,timeoutMs});}

async function footState(page){return page.evaluate(({markerSelector,tipSelector})=>{const direct=(el)=>Array.from(el?.childNodes||[]).filter((node)=>node.nodeType===Node.TEXT_NODE).map((node)=>node.textContent||'').join('').replace(/\s+/g,'').trim();const marker=document.querySelector(markerSelector);const tip=document.querySelector(tipSelector);const open=document.querySelector('.fn-marker[aria-expanded="true"]');const rect=tip?.getBoundingClientRect();const style=tip?getComputedStyle(tip):null;const hit=rect?document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2):null;return{markerOpen:marker?.getAttribute('aria-expanded')==='true',openNumber:direct(open),tipOpen:Boolean(tip),hovered:Boolean(tip?.matches(':hover')),hit:Boolean(tip&&hit&&(tip===hit||tip.contains(hit))),eventCount:window.__projectionEvents.length,tip:tip&&rect&&style?{position:style.position,display:style.display,visibility:style.visibility,pointerEvents:style.pointerEvents,borderTopWidth:style.borderTopWidth,borderRadius:style.borderRadius,width:rect.width,height:rect.height,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2,inViewport:rect.left>=-1&&rect.top>=-1&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1}:null};},{markerSelector,tipSelector});}

async function glossaryState(page){return page.evaluate(({anchorSelector,tipSelector})=>{const anchor=document.querySelector(anchorSelector);const tip=document.querySelector(tipSelector);const frame=tip?.querySelector(':scope > .gtip-luxury');const expand=tip?.querySelector('[data-gtip-expand]');const detail=tip?.querySelector('.gtip-detail-wrap');const papyrus=tip?.querySelector('.gtip-papyrus');const rect=(el)=>{const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;};const tr=rect(tip),fr=rect(frame),pr=rect(papyrus);const style=tip?getComputedStyle(tip):null,ps=papyrus?getComputedStyle(papyrus):null;const hasScrollbar=Boolean(tip&&tip.scrollHeight>tip.clientHeight+1);const overflowY=style?.overflowY||'';return{anchorOpen:anchor?.getAttribute('aria-expanded')==='true',tipOpen:Boolean(tip),expanded:Boolean(tip?.classList.contains('gtip--expanded')),expandAria:expand?.getAttribute('aria-expanded')||'',expandLabel:expand?.getAttribute('aria-label')||'',detailHidden:detail?.getAttribute('aria-hidden')||'',tip:tr,papyrus:pr,papyrusOpacity:Number(ps?.opacity||0),overflowY,hasScrollbar,overflowMatchesContent:hasScrollbar?['auto','scroll'].includes(overflowY):!['auto','scroll'].includes(overflowY),blankTail:tr&&fr?Math.max(0,tr.bottom-fr.bottom):null,placement:tip?.dataset.placement||'',inViewport:Boolean(tr&&tr.left>=-1&&tr.top>=-1&&tr.right<=innerWidth+1&&tr.bottom<=innerHeight+1)};},{anchorSelector,tipSelector});}

const {server,origin}=await serve();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:850}});
await context.addInitScript(()=>{window.__projectionEvents=[];addEventListener('gb:reader-projection-ready',(event)=>window.__projectionEvents.push({reason:String(event.detail?.reason||''),t:Math.round(performance.now())}));});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',(error)=>pageErrors.push(String(error?.stack||error)));

try{
  await page.goto(`${origin}${ROUTE}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.GBReaderProjection?.version===1&&window.GBArticleTooltips?.version>=15,null,{timeout:15000});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.article-body .gterm')).some((el)=>!el.closest('.summary-card')&&el.querySelector('.gtip [data-gtip-expand]')&&el.querySelector('.gtip .gtip-detail-wrap')&&el.querySelector('.gtip .gtip-papyrus')),null,{timeout:10000});
  const ready=await instrument(page);const marker=page.locator(FOOT).first();
  record('RPH-01','Hermenevtika static footnote marker exists with inline tooltip',ready.foot&&await marker.count()===1,ready);
  record('RPH-02','ReaderProjection v1 is installed',await page.evaluate(()=>window.GBReaderProjection?.version===1));
  record('RPH-03','Article tooltip owner v15 is installed',await page.evaluate(()=>window.GBArticleTooltips?.version>=15));
  await marker.scrollIntoViewIfNeeded();const quiescence=await quiet(page);const baseline=quiescence.count;
  record('RPH-04','reader projection reaches event quiescence after viewport activation',quiescence.quiet,quiescence);
  const markerBox=await marker.boundingBox();assert.ok(markerBox,'footnote marker must have geometry');

  await marker.hover({force:true});await page.waitForFunction((selector)=>Boolean(document.querySelector(selector)),FOOT_TIP,{timeout:3000});await frames(page);
  const opened=await footState(page);
  record('RPH-05','hover opens the static footnote tooltip',opened.tipOpen,opened);
  record('RPH-06','hover keeps marker aria-expanded truthful',opened.markerOpen&&opened.openNumber==='40',opened);
  record('RPH-07','desktop source tooltip is fixed, borderless, rounded, visible and hit-testable',opened.tip?.position==='fixed'&&opened.tip.display!=='none'&&opened.tip.visibility!=='hidden'&&opened.tip.pointerEvents!=='none'&&opened.tip.borderTopWidth==='0px'&&parseFloat(opened.tip.borderRadius)>=16&&opened.hit,opened);
  record('RPH-08','desktop tooltip remains inside the viewport',Boolean(opened.tip?.inViewport&&opened.tip.width>20&&opened.tip.height>20),opened);
  record('RPH-09','tooltip extraction does not trigger a projection refresh',opened.eventCount===baseline,{baseline,opened});

  const from={x:markerBox.x+markerBox.width/2,y:markerBox.y+markerBox.height/2};const to={x:opened.tip.centerX,y:opened.tip.centerY};
  await page.mouse.move(to.x,to.y,{steps:12});await frames(page);const immediate=await footState(page);
  record('RPH-10','pointer handoff immediately keeps the original tooltip open',immediate.tipOpen&&immediate.markerOpen&&immediate.openNumber==='40',immediate);
  record('RPH-11','tooltip center owns pointer hit-test after handoff',immediate.hit&&immediate.hovered,immediate);
  record('RPH-12','pointer handoff does not trigger a projection refresh',immediate.eventCount===baseline,{baseline,immediate});
  await page.waitForTimeout(700);const held=await footState(page);
  record('RPH-13','tooltip stays open beyond the hover transit window',held.tipOpen&&held.hovered&&held.markerOpen&&held.openNumber==='40',held);
  record('RPH-14','held tooltip does not trigger a projection refresh',held.eventCount===baseline,{baseline,held});
  await page.mouse.move(from.x,from.y,{steps:12});await frames(page);const returned=await footState(page);
  record('RPH-15','returning to the original marker keeps the same tooltip open',returned.tipOpen&&returned.markerOpen&&returned.openNumber==='40',returned);
  await page.mouse.move(4,4,{steps:8});await page.waitForFunction((selector)=>!document.querySelector(selector),FOOT_TIP,{timeout:3000});const closed=await footState(page);
  record('RPH-16','leaving both marker and tooltip closes the tooltip',!closed.tipOpen&&!closed.markerOpen,closed);

  const commentBaseline=closed.eventCount;await page.evaluate(()=>window.GBReaderProjection.getRoot().appendChild(document.createComment('gb-inline-tooltip-contract')));await frames(page);const afterComment=await footState(page);
  record('RPH-17','comment placeholders are ignored by the projection observer',afterComment.eventCount===commentBaseline,{commentBaseline,afterComment});
  const semanticBaseline=afterComment.eventCount;await page.evaluate(()=>{const p=document.createElement('p');p.id='reader-projection-semantic-addition';p.textContent='СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ';window.GBReaderProjection.getRoot().appendChild(p);});
  await page.waitForFunction((count)=>window.__projectionEvents.length>count&&window.GBReaderProjection.getTtsSegments().some((segment)=>segment.text==='СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ'),semanticBaseline,{timeout:3000});const semantic=await footState(page);
  record('RPH-18','real semantic additions still trigger projection refresh',semantic.eventCount>semanticBaseline,{semanticBaseline,semantic});

  const ownership=await page.evaluate((owned)=>({canonicalVersion:Number(window.GBArticleTooltips?.version||0),legacy:Array.isArray(window.SiteUtils?._tooltipControllers)?window.SiteUtils._tooltipControllers.map((controller)=>String(controller?.anchorSel||'')).filter((selector)=>owned.includes(selector)):[]}),OWNED);
  record('RPH-20','canonical tooltip owner retires every overlapping legacy selector',ownership.canonicalVersion>=15&&ownership.legacy.length===0,ownership);
  const glossary=page.locator(TERM).first();
  record('RPH-21','Hermenevtika exposes an expandable glossary term with papyrus detail',ready.term&&await glossary.count()===1,ready);
  await glossary.scrollIntoViewIfNeeded();await glossary.click({force:true});await page.waitForFunction((selector)=>Boolean(document.querySelector(selector)),TERM_TIP,{timeout:3000});await frames(page);
  const compact=await glossaryState(page);
  record('RPH-22','compact glossary opens at natural height without a fake scrollbar',compact.tipOpen&&compact.anchorOpen&&compact.overflowMatchesContent&&!compact.hasScrollbar,compact);
  record('RPH-23','compact glossary has no detached white tail',compact.blankTail!==null&&compact.blankTail<=2,compact);
  const inlineFocus=await page.evaluate(()=>{const el=document.querySelector('[data-audit-glossary]');const style=el?getComputedStyle(el):null;return style?{outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,boxShadow:style.boxShadow,borderBottomStyle:style.borderBottomStyle}:null;});
  record('RPH-24','pointer-opened glossary anchor has no boxed focus frame while retaining inline emphasis',inlineFocus&&(inlineFocus.outlineStyle==='none'||inlineFocus.outlineWidth==='0px')&&inlineFocus.boxShadow==='none'&&inlineFocus.borderBottomStyle!=='none',inlineFocus);

  const expand=page.locator(`${TERM_TIP} [data-gtip-expand]`).first();await expand.click({force:true});await page.waitForFunction((selector)=>document.querySelector(selector)?.classList.contains('gtip--expanded'),TERM_TIP,{timeout:3000});await page.waitForTimeout(550);const expanded=await glossaryState(page);
  record('RPH-25','Подробнее activates the papyrus state and truthful ARIA',expanded.expanded&&expanded.expandAria==='true'&&expanded.expandLabel==='Кратко'&&expanded.detailHidden==='false'&&expanded.papyrusOpacity>=.9&&expanded.papyrus?.height>30,expanded);
  record('RPH-26','ordinary expanded glossary stays inside the viewport and scrolls only on real overflow',expanded.inViewport&&expanded.overflowMatchesContent&&expanded.blankTail!==null&&expanded.blankTail<=2,expanded);
  await expand.click({force:true});await page.waitForFunction((selector)=>!document.querySelector(selector)?.classList.contains('gtip--expanded'),TERM_TIP,{timeout:3000});await page.waitForTimeout(550);const collapsed=await glossaryState(page);
  record('RPH-27','Кратко restores compact natural geometry',!collapsed.expanded&&collapsed.expandAria==='false'&&collapsed.detailHidden==='true'&&collapsed.overflowMatchesContent&&!collapsed.hasScrollbar&&Math.abs((collapsed.tip?.height||0)-(compact.tip?.height||0))<=3,{compact,collapsed});

  const original=await page.evaluate((selector)=>{const papyrus=document.querySelector(selector)?.querySelector('.gtip-papyrus');if(!papyrus)return'';const text=papyrus.textContent||'';papyrus.textContent=Array.from({length:80},(_,index)=>`Абзац ${index+1}: подробное объяснение герменевтического метода и его контекста.`).join(' ');return text;},TERM_TIP);
  await expand.click({force:true});await page.waitForFunction((selector)=>document.querySelector(selector)?.classList.contains('gtip--expanded'),TERM_TIP,{timeout:3000});await page.waitForTimeout(800);const longExpanded=await glossaryState(page);
  record('RPH-28','animated long papyrus stays inside the viewport with real overflow ownership',longExpanded.expanded&&longExpanded.inViewport&&longExpanded.hasScrollbar&&['auto','scroll'].includes(longExpanded.overflowY),longExpanded);
  record('RPH-29','ResizeObserver preserves placement while tracking long growth',longExpanded.tip?.height>90&&longExpanded.tip?.height<=820&&['top','bottom'].includes(longExpanded.placement)&&longExpanded.blankTail!==null&&longExpanded.blankTail<=2,longExpanded);
  await expand.click({force:true});await page.waitForFunction((selector)=>!document.querySelector(selector)?.classList.contains('gtip--expanded'),TERM_TIP,{timeout:3000});await page.waitForTimeout(500);await page.evaluate(({selector,text})=>{const papyrus=document.querySelector(selector)?.querySelector('.gtip-papyrus');if(papyrus)papyrus.textContent=text;},{selector:TERM_TIP,text:original});
  await page.keyboard.press('Escape');await page.waitForFunction((selector)=>!document.querySelector(selector),TERM_TIP,{timeout:3000});const glossaryClosed=await glossaryState(page);
  record('RPH-30','Escape closes the glossary and restores truthful anchor state',!glossaryClosed.tipOpen&&!glossaryClosed.anchorOpen,glossaryClosed);

  const scripture=page.locator('.article-body .bref[data-ref]').first();await scripture.scrollIntoViewIfNeeded();await scripture.click({force:true});await page.waitForFunction(()=>Boolean(document.querySelector('.btip.gb-floating-tip.is-open')),null,{timeout:3000});await frames(page);
  const scriptureState=await page.evaluate(()=>{const anchor=document.querySelector('.article-body .bref[data-ref]');const tip=document.querySelector('.btip.gb-floating-tip.is-open');const a=anchor?getComputedStyle(anchor):null,t=tip?getComputedStyle(tip):null,r=tip?.getBoundingClientRect();return{anchorOpen:anchor?.getAttribute('aria-expanded')==='true',outlineStyle:a?.outlineStyle||'',outlineWidth:a?.outlineWidth||'',boxShadow:a?.boxShadow||'',textDecorationLine:a?.textDecorationLine||'',borderTopWidth:t?.borderTopWidth||'',borderRadius:t?.borderRadius||'',overflowY:t?.overflowY||'',hasScrollbar:Boolean(tip&&tip.scrollHeight>tip.clientHeight+1),inViewport:Boolean(r&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1)};});
  record('RPH-31','Scripture popup is a borderless rounded paper card inside the viewport',scriptureState.anchorOpen&&scriptureState.borderTopWidth==='0px'&&parseFloat(scriptureState.borderRadius)>=16&&scriptureState.inViewport&&(!scriptureState.hasScrollbar||['auto','scroll'].includes(scriptureState.overflowY)),scriptureState);
  record('RPH-32','pointer-opened Scripture reference has no boxed focus frame and keeps inline emphasis',(scriptureState.outlineStyle==='none'||scriptureState.outlineWidth==='0px')&&scriptureState.boxShadow==='none'&&scriptureState.textDecorationLine.includes('underline'),scriptureState);
  await page.keyboard.press('Escape');
  record('RPH-19','tooltip geometry contract has no uncaught page errors',pageErrors.length===0,pageErrors);
  await page.screenshot({path:path.join(REPORTS,'reader-projection-tooltip-handoff.png'),fullPage:false});
}finally{await context.close();await browser.close();await new Promise((resolve)=>server.close(resolve));}

assert.equal(new Set(checks.map((check)=>check.id)).size,checks.length,'tooltip geometry check IDs must be unique');
assert.equal(checks.length,32,`tooltip geometry contract requires exactly 32 checks, got ${checks.length}`);
const failed=checks.filter((check)=>!check.pass);const summary={sha:process.env.GITHUB_SHA||null,checks:checks.length,passed:checks.length-failed.length,failed:failed.length};
fs.writeFileSync(path.join(REPORTS,'reader-projection-tooltip-handoff-contract.json'),JSON.stringify({summary,checks},null,2));
fs.writeFileSync(path.join(REPORTS,'reader-projection-tooltip-handoff-contract.md'),['# ReaderProjection tooltip geometry contract','',`- SHA: \`${summary.sha||'local'}\``,`- Checks: **${summary.checks}**`,`- Passed: **${summary.passed}**`,`- Failed: **${summary.failed}**`,'','| ID | Result | Description |','|---|---|---|',...checks.map((check)=>`| ${check.id} | ${check.pass?'PASS':'FAIL'} | ${check.description.replace(/\|/g,'\\|')} |`)].join('\n'));
checks.forEach((check)=>console.log(`[READER-PROJECTION-HANDOFF] ${check.pass?'PASS':'FAIL'} ${check.id} :: ${check.description}`));
console.log('[READER-PROJECTION-HANDOFF-SUMMARY]',JSON.stringify(summary));
assert.equal(failed.length,0,`ReaderProjection tooltip geometry contract failed: ${failed.map((check)=>check.id).join(', ')}`);
console.log('ReaderProjection tooltip geometry contract: PASS');
