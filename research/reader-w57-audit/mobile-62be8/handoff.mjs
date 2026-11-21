// Run against the local W57 preview, not a live origin. Fresh temporary profiles only.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const origin=process.env.READER_URL||'http://127.0.0.1:19069', route='/articles/kod-da-vinchi/';
const key='gb-highlights-v1', notesKey='gb-reader-notes-v1', word='Брауна';
const records=(p,k=key)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),k);
const checks=[];
try {
  for(const count of [1,2]){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const p=await ctx.newPage();
  p.setDefaultTimeout(7000);
  assert.equal((await p.goto(origin+route+'?reader-pilot=1&paper=space&panel=open')).status(),200);
  await p.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready); await p.evaluate(()=>document.fonts.ready);
  const paras=p.locator('article.article-body p');
  const hits=await paras.evaluateAll((els,w)=>els.flatMap((el,i)=>el.getBoundingClientRect().width>200 &&
    !el.closest('details,aside,figcaption,.np-u-series-disclosure,.flip-card,.gill-card,.np-u-central-overview,.np-u-central-contents,[inert],[hidden]') &&
    [...el.childNodes].some(n=>n.nodeType===3&&n.textContent.includes(w)) ? [i]:[]), word);
  assert.ok(hits.length>=2,'Need two distinct prose paragraphs containing '+word);
  async function mark(index){
    const para=paras.nth(index); await para.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
    await p.waitForTimeout(250);
    const points=await para.evaluate((el,w)=>{
      const n=[...el.childNodes].find(n=>n.nodeType===3&&n.textContent.includes(w)), off=n.textContent.indexOf(w);
      return [off,off+w.length-1].map((i,j)=>{const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);
        const b=r.getBoundingClientRect();return [j?b.right-0.4:b.left+0.4,b.top+b.height/2];});
    },word);
    await p.mouse.move(...points[0]);await p.mouse.down();await p.mouse.move(...points[1],{steps:16});await p.mouse.up();
    assert.equal(await p.evaluate(()=>getSelection().toString()),word);
    await p.locator('#npW57SelectionToolbar [data-w57-action="marker"]').click();
  }
  await mark(hits[0]);const [quote]=await records(p);const mob=await ctx.newPage();await mob.setViewportSize({width:390,height:844});
  await mob.goto(origin+route+'?reader-pilot=1');await mob.locator('#gb-hl-fab').tap();
  for(let i=1;i<=count;i++){
    await mob.locator('[data-library-tab=quote]').tap();await mob.locator('[data-library-action=note-for-quote]').tap();
    await mob.locator('#gb-hl-note-text').fill('Запись из библиотеки '+i);await mob.locator('#gb-hl-editor [type=submit]').tap();
  }
  const linked=(await records(mob,notesKey)).filter(n=>n.quoteId===quote.id);await p.reload();await p.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);
  const details=p.locator("#npW57NotesDetails");if(!(await details.locator("summary").isVisible()))await p.locator("#npUEdgeToggle").click();if(!(await details.evaluate(el=>el.open)))await details.locator("summary").click();
  const edit=p.locator('#npW57NotesList [data-action=edit]').first();const label=await edit.textContent();await edit.click();const value=await p.locator('#npW57NoteText').inputValue();
  await p.locator('#npW57NoteText').fill('После открытия в аналитике');await p.locator('#npW57SaveNote').click();const after=(await records(p,notesKey)).filter(n=>n.quoteId===quote.id);
  const result={count,linked:linked.map(n=>n.text),label,value,after:after.map(n=>n.text),preservedCount:after.length===linked.length};checks.push(result);if(!value||!result.preservedCount)process.exitCode=1;
  await ctx.close();}
}finally{await browser.close();console.log(JSON.stringify(checks,null,2))}
