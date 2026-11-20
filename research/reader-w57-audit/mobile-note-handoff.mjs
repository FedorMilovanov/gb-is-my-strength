// A filled library, not a fixture or cloud sync: desktop and phone-sized tabs share a temporary Chromium profile.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.W57_EVIDENCE_DIR;
if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const portrait = {width:390,height:844}, landscape = {width:844,height:390};
const base = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/', opt = '?reader-pilot=1&paper=space';
const text = 'Сопоставить дату с историческим контекстом.';
const ctx = await browser.newContext({viewport:portrait, isMobile:true, hasTouch:true, locale:'ru-RU', reducedMotion:'reduce'});
ctx.setDefaultTimeout(5500);
const checks=[];
const check=(name,pass,detail)=>checks.push({name,pass,detail});
const snapshot=p=>p.evaluate(()=>Object.fromEntries(['gb-highlights-v1','gb-reader-notes-v1'].map(k=>[k,JSON.parse(localStorage.getItem(k)||'[]')])));
const anchor=p=>p.locator('p').filter({hasText:/^Гилл стал пастором/}).first();
const locationInText=p=>anchor(p).evaluate(el=>({scrollY,top:el.getBoundingClientRect().top,height:innerHeight}));
async function shot(p,name){if(out)await p.screenshot({path:join(out,name+'.jpg'),quality:85,animations:'disabled'});}
async function toText(p){await anchor(p).evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'})); await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function load(p,url){assert.equal((await p.goto(url)).status(),200);await p.locator('#gb-hl-fab').waitFor({state:'attached'});await p.evaluate(()=>document.fonts.ready);}
const entry=scope=>scope.getByRole('button',{name:/на полях/i}).or(scope.getByRole('tab',{name:/на полях/i})).or(scope.getByRole('link',{name:/на полях/i}));
try {
 const d=await ctx.newPage();await d.setViewportSize({width:1440,height:900});await load(d,base+opt+'&panel=open');
 await d.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);await toText(d);
 // Range used only to measure glyphs. Chromium creates the actual selection via a real double-click.
 const xy=await anchor(d).evaluate(el=>{const n=el.firstChild,at=n.textContent.indexOf('пастором');if(at<0)throw Error('Fixture text changed');const r=document.createRange();r.setStart(n,at);r.setEnd(n,at+8);const b=r.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]});
 await d.mouse.dblclick(...xy);assert.equal(await d.evaluate(()=>getSelection().toString().trim()),'пастором');
 await d.locator('#npW57SelectionToolbar [data-w57-action="marker"]').click();
 await d.locator('#npW57NotesList [data-action="edit"]').click();await d.locator('#npW57NoteText').fill(text);await d.locator('#npW57SaveNote').click();
 const expected=await snapshot(d),[q]=expected['gb-highlights-v1'],[n]=expected['gb-reader-notes-v1'];
 assert.equal(q.annotation.noteId,n.id);assert.equal(n.quoteId,q.id);assert.equal(n.text,text);assert.equal(q.text.trim(),'пастором');
 const fab='#gb-hl-fab';
 for(const pilot of [false,true]){
  const p=await ctx.newPage(),mode=pilot?'enhanced':'native';await load(p,base+(pilot?opt:''));
  await toText(p);const before=await locationInText(p);assert.ok(before.scrollY>100);
  await p.locator(fab).tap();await p.locator('[data-library-tab="note"]').tap();
  const note=p.locator(`#gb-hl-list [data-type="note"][data-id="${n.id}"]`);await note.waitFor();
  check(mode+': note opened from the real library',(await note.innerText()).includes(text),await note.innerText());
  await p.setViewportSize(landscape);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  check(mode+': landscape still shows the linked note',await note.isVisible(),await p.evaluate(()=>({width:innerWidth,height:innerHeight})));
  await p.setViewportSize(portrait);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  check(mode+': rotation leaves the same note accessible',await note.isVisible(),await p.locator('#gb-hl-backdrop').getAttribute('aria-hidden'));
  await p.locator('#gb-hl-close').tap();await p.locator('#gb-hl-panel').waitFor({state:'hidden'});
  check(mode+': closing library restores opener focus',await p.locator(fab).evaluate(el=>el===document.activeElement),await p.evaluate(()=>document.activeElement.id||document.activeElement.tagName));
  await p.waitForTimeout(300);
  const after=await locationInText(p); const delta=Math.round(after.top-before.top);
  check(mode+': return to reading position after portrait → landscape → portrait',Math.abs(delta)<45,{before,after,delta});
  const dock=await p.locator(fab).evaluate(el=>el.parentElement.className);
  check(mode+': library remains in native action cluster',dock.split(' ').includes('reader-mobile-action-cluster'),dock);
  const native=p.locator('.reader-mobile-menu-trigger:visible').first();
  {
   let sheetInput=false;
   if(await native.isVisible()){
    // The native top bar auto-hides on downward scroll. Reveal it without moving focus.
    await p.mouse.move(160,420);await p.mouse.wheel(0,-170);await p.waitForTimeout(400);
    const sheetBefore=await locationInText(p);
    const sheet=p.locator('#'+await native.getAttribute('aria-controls'));await native.tap();await p.waitForFunction(el=>el.getAttribute('aria-hidden')==='false',await sheet.elementHandle());
    const opener=entry(sheet);if(await opener.count()===1){await opener.tap();sheetInput=true;
     const panel=sheet.getByRole('tabpanel',{name:'На полях'});await panel.waitFor();
     // This source-only tab is not another Product Library. Record the difference without asserting data loss.
     check(mode+': research shows published source material',await panel.getByRole('button',{name:/Читать в статье/}).count()>0,{
      title:await panel.getByRole('heading',{level:3}).innerText(),personalNoteVisible:await panel.getByText(text,{exact:true}).isVisible()});
     await shot(p,mode+'-source-tab');
     await sheet.getByRole('tab',{name:'Оглавление',exact:true}).tap();
     check(mode+': TOC reachable again inside same sheet',await sheet.getByRole('tabpanel',{name:'Оглавление'}).isVisible(),await sheet.getAttribute('aria-hidden'));
     await p.keyboard.press('Escape');await p.waitForFunction(el=>el.getAttribute('aria-hidden')==='true',await sheet.elementHandle());
     check(mode+': Escape returns to native trigger',await native.evaluate(el=>el===document.activeElement),await locationInText(p));
     check(mode+': sheet preserves reading position',Math.abs((await locationInText(p)).top-sheetBefore.top)<45,await locationInText(p));
    }
   }
   check(mode+': research accessible within the native sheet',sheetInput,'No alternate toolbar accepted');
   if(pilot && !sheetInput && await p.locator('#npUOpenResearch').isVisible()){
    // Positive control on the old shell; this is NOT a pass for the native integration.
    await p.locator('#npUOpenResearch').tap();const details=p.locator('#npW57NotesDetails');
    if(!(await details.evaluate(el=>el.open)))await details.locator('summary').tap();
    const found=await details.getByText(text,{exact:true}).isVisible();check('legacy rail positive control: existing note readable',found,q.text);await shot(p,'legacy-rail-filled');
   }
  }
  await p.reload();await p.locator(fab).waitFor({state:'attached'});assert.deepEqual(await snapshot(p),expected,'handoff/reload changed stored records');
  check(mode+': exact data and both links survive reload',true,{quote:q.text,note:text});await p.close();
 }
} finally {console.log(JSON.stringify(checks,null,2));await browser.close();}
if(checks.some(c=>!c.pass))process.exitCode=1;
