// Touch gestures are CDP contacts. Never use locator.tap() on an off-screen rate: it would scroll the rail for us.
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
const host=process.env.W64_URL||'http://127.0.0.1:19068',out=process.env.W64_SHOTS;
if(out)await mkdir(out,{recursive:true});
const gill='/articles/dzhon-gill-chast-2-uchenyi/',chapter='/baptisty-rossii/noch-na-kure/';
const emit=row=>console.log(JSON.stringify(row));
async function visit(w,path,fn){const ctx=await b.newContext({viewport:{width:w,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'ru-RU'});try{const p=await ctx.newPage();p.setDefaultTimeout(5000);assert.equal((await p.goto(host+path.replace('#','?reader-pilot=1#')+(path.includes('#')?'':'?reader-pilot=1'))).status(),200);await p.evaluate(()=>document.fonts.ready);await p.waitForSelector('#gb-hl-fab',{state:'attached'});await fn(p,await ctx.newCDPSession(p))}finally{await ctx.close()}}
async function swipe(c,x,y,x2,y2){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let n=1;n<=10;n++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(x2-x)*n/10,y:y+(y2-y)*n/10}]});await new Promise(r=>setTimeout(r,15))}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
async function shot(p,name){if(out)await p.screenshot({path:`${out}/${name}.jpg`,quality:85})}
try{
 for(const w of [320,390,525])await visit(w,gill,async(p,c)=>{
  const chip=p.locator('.mobile-top-bar .reader-mobile-speed-chip'),rail=p.locator('#mobileSpeedrail');
  const snap=()=>rail.evaluate(r=>{const box=r.getBoundingClientRect();return {left:box.x,right:box.right,y:box.y+box.height/2,scrollLeft:r.scrollLeft,max:r.scrollWidth-r.clientWidth,visible:[...r.querySelectorAll('[data-speed]')].filter(el=>{const a=el.getBoundingClientRect();return el.contains(document.elementFromPoint(a.x+a.width/2,a.y+a.height/2))}).map(el=>el.dataset.speed)}});
  const nav=await p.evaluate(()=>performance.timeOrigin);
  for(const rate of ['2','0.75']){await chip.tap();await p.waitForTimeout(240);const before=await snap();let after=before,drags=0;
   while(drags<10&&!after.visible.includes(rate)){const goRight=rate==='2';await swipe(c,goRight?after.right-5:after.left+5,after.y,goRight?after.left+5:after.right-5,after.y);await p.waitForTimeout(145);after=await snap();drags++;if(after.scrollLeft===before.scrollLeft && drags>=2)break}
   const landed=after.visible.includes(rate);if(landed){const rect=await rail.locator(`[data-speed="${rate}"]`).boundingBox();await p.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);await p.waitForTimeout(250)}
   emit({kind:'rate',w,rate,drags,before,after,landed,observed:await chip.innerText(),phase:await p.evaluate(()=>GBReaderTTS.getState().phase),sameDoc:await p.evaluate(()=>performance.timeOrigin)===nav});if(!landed||await chip.innerText()!==`${rate}×`){process.exitCode=1;break}
  }
 });
 for(const w of [320,390])for(const [path,action,unfold=false] of [[chapter,'quote'],[chapter,'quote',true],[chapter+'#the-baptism','quote'],[gill+'#part-controversy','term']]) await visit(w,path,async p=>{
  await p.waitForTimeout(400);if(unfold){await p.locator('.summary-card .gb-summary-toggle').first().tap();await p.waitForTimeout(350)}const pre=await p.evaluate(()=>({y:scrollY,hash:location.hash,dock:document.querySelector('#gbs2MobSec')?.textContent,nearest:[...document.querySelectorAll('article h2[id]')].filter(h=>h.getBoundingClientRect().top<=innerHeight*.32).at(-1)?.id}));
  // Enter from the always-visible bottom TOC just as a reader below the fold can.
  await p.locator('#mobPartTocBtn').tap();await p.locator('#gbrMarginaliaTab').tap();const panel=p.locator('#gbrMarginalia');await panel.waitFor();const title=await panel.locator('h3').innerText();let key,source;
  if(action==='term'){const item=panel.locator('.gbr-marginalia-term').first();key=await item.locator('summary').innerText();await item.locator('summary').tap();source=item.getByRole('button',{name:/Показать в статье/})}
  else{const quote=panel.locator('.gbr-marginalia-evidence').first();key=(await quote.locator('p').innerText()).slice(0,45);source=quote.getByRole('button',{name:/Читать в статье/})}
  // Capture candidate destination visibility *before* touching the jump, excluding cloned panel text.
  const inspect=({q,kind})=>{const root=document.querySelector('article.article-body')||document.querySelector('main article');const dest=kind==='quote'?[...root.querySelectorAll('p,blockquote')].find(n=>n.textContent.replace(/\s+/g,' ').trim().startsWith(q)):[...root.querySelectorAll('.gterm')].find(n=>(n.dataset.termTitle||n.dataset.term)===q);if(!dest)return null;const r=dest.getBoundingClientRect(),rects=dest.getClientRects().length;return {id:dest.id,inert:!!dest.closest('[inert]'),summaryOpen:dest.closest('.summary-card')?.dataset.gbSummaryOpen,rects,y:r.y,h:r.height,closed:dest.closest('details:not([open])')?.querySelector('summary')?.textContent,active:document.activeElement===dest,visible:dest.checkVisibility(),text:dest.textContent.trim().slice(0,65)}};
  const before=await p.evaluate(inspect,{q:key,kind:action});if(w===390&&!unfold&&path===chapter){await source.scrollIntoViewIfNeeded();await shot(p,'source-before')}await source.tap();await p.waitForTimeout(1250);
  const dest=await p.evaluate(inspect,{q:key,kind:action});const end=await p.evaluate(()=>({focus:document.activeElement.tagName,id:document.activeElement.id,y:scrollY,text:document.activeElement.textContent?.trim().slice(0,60),sheet:document.querySelector('#partTocOverlay').getAttribute('aria-hidden'),detailsOpen:[...document.querySelectorAll('article details[open]')].length}));const usable=!!dest?.active&&!dest.inert&&dest.visible&&dest.y+dest.h>0&&dest.y<844&&end.sheet==='true';emit({kind:'jump',w,path,action,unfold,pre,title,key,before,dest,end,usable});if(!usable)process.exitCode=1;if(w===390)await shot(p,`jump-${action}-${unfold?'unfolded':path.includes('#')?'deep':'start'}`);
 });
}finally{await b.close()}
