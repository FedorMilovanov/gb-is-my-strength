// Exact PR archive, local preview.py. No storage seeds, mock voices only for transport (not audio quality).
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=(process.env.W64_URL||'http://127.0.0.1:19068')+'/articles/dzhon-gill-chast-2-uchenyi/';
const opt='?reader-pilot=1&paper=space', out=process.env.W64_SHOTS;
if(out)await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const print=o=>console.log(JSON.stringify(o));
async function run(width,height,fn){const ctx=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,locale:'ru-RU',reducedMotion:'reduce'});try{
 await ctx.addInitScript(()=>{window.VoskTTSEngine={isSupported:()=>false,isReady:()=>false};window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};window.speaks=0;Object.defineProperty(window,'speechSynthesis',{value:Object.assign(new EventTarget(),{getVoices:()=>[{name:'Fixture',lang:'ru-RU'}],speak(u){window.speaks++;u.onstart?.()},cancel(){},pause(){},resume(){}})})});
 const p=await ctx.newPage();p.setDefaultTimeout(4500);const errors=[];p.on('pageerror',e=>errors.push(e.message));await fn(p);assert.deepEqual(errors,[]);
 }catch(e){print({probeError:e.message,width,height});process.exitCode=1}finally{await ctx.close()}}
const wait=(p,ms=300)=>p.waitForTimeout(ms);
const shot=async(p,f)=>{if(out)await p.screenshot({path:`${out}/${f}.jpg`,quality:85,animations:'disabled'})};
const active=p=>p.evaluate(()=>document.activeElement.id||document.activeElement.tagName);
const open=async(p,query=opt)=>{assert.equal((await p.goto(base+query)).status(),200);await p.waitForFunction(()=>window.GBReaderTTS);await p.evaluate(()=>document.fonts.ready)};
try{
if(!process.env.W64_GESTURES_ONLY){
for(const [from,to,query] of [[390,844,opt],[1120,1121,opt],[1440,390,opt],[1120,1121,'']])await run(from,844,async p=>{
 await open(p,from>1120?query+'&panel=open':query);if(from>1120)await p.waitForFunction(()=>window.__NP_W57_ANNOTATIONS__?.ready);
 await p.locator(from>1120?'#npULibraryButton':'#gb-hl-fab').tap();await p.locator('#gb-hl-new-note').tap();const field=p.locator('#gb-hl-note-text');await field.fill('Сохранённая контрольная запись');await p.locator('#gb-hl-editor [type=submit]').tap();await p.locator('#gb-hl-new-note').tap();const draft='Мой незавершённый абзац';await field.fill(draft);
 const before=await p.evaluate(()=>performance.timeOrigin);await p.setViewportSize({width:to,height:844});await wait(p,800);await p.waitForLoadState('load');await p.locator('#gb-hl-fab').waitFor({state:'attached'});
 const sameDoc=before===await p.evaluate(()=>performance.timeOrigin), editor=await field.isVisible(),value=await field.inputValue();
 print({draft:{from,to,pilot:!!query,sameDoc,editor,draftKept:editor&&value===draft,savedControl:await p.evaluate(()=>JSON.parse(localStorage.getItem('gb-reader-notes-v1')).some(n=>n.text==='Сохранённая контрольная запись'))}});
});
for(const w of [320,390,525])await run(w,844,async p=>{
 const state=()=>p.evaluate(()=>({phase:GBReaderTTS.getState().phase,rate:GBReaderTTS.getState().rate,open:document.querySelector('.mobile-top-bar').classList.contains('speed-open'),speaks}));
 const points=()=>p.evaluate(()=>{const r=document.querySelector('.reader-mobile-play').getBoundingClientRect(),s=document.querySelector('.reader-mobile-speed-chip').getBoundingClientRect();const dict={center:[22,22],rightArc:[38,22],oldConflict:[27,32],chip:[s.x+s.width/2-r.x,s.y+s.height/2-r.y],outside:[52,6],boundaryL:[43,20],boundaryR:[45,20]};return Object.fromEntries(Object.entries(dict).map(([k,[dx,dy]])=>{const x=r.x+dx,y=r.y+dy,hit=document.elementFromPoint(x,y)?.closest('button');return [k,{x,y,hit:hit?.id||hit?.className}]}))});
 for(const k of ['center','rightArc','oldConflict','chip','outside','boundaryL','boundaryR']){
 await open(p);const q=(await points())[k];await p.touchscreen.tap(q.x,q.y);await wait(p,170);print({touch:{w,k,...q,...await state()}});
 }
 await open(p);let q=await points();await p.touchscreen.tap(q.center.x,q.center.y);await p.waitForFunction(()=>GBReaderTTS.getState().phase==='playing');if(!(await state()).open)await p.touchscreen.tap(q.chip.x,q.chip.y);await p.locator('#mobileSpeedrail [data-speed="1.5"]').tap();await wait(p);print({rateSelection:{w,...await state()}});await p.touchscreen.tap(q.chip.x,q.chip.y);if(w===390)await shot(p,'speed-390');
});
for(const [width,height] of [[390,844],[320,340],[844,390]])await run(width,height,async p=>{
 await open(p);const trigger=p.locator('[data-gill-marginalia-open]:visible'),sheet=p.locator('#partTocOverlay');await trigger.tap();await p.locator('#gbrMarginalia').waitFor();print({research:{width,height,label:await trigger.getAttribute('aria-label'),tab:await p.locator('#gbrMarginaliaTab').innerText(),heading:await sheet.locator('.toc-sheet__head h3').innerText(),eyebrow:await sheet.locator('.gbr-marginalia-eyebrow').innerText()}});if(width===390)await shot(p,'margins-390');await p.keyboard.press('Escape');await wait(p);print({researchReturn:{width,height,onTrigger:await trigger.evaluate(el=>el===document.activeElement)}});
 const settings=p.locator('#mobSettingsBtn'),panel=p.locator('#gillSettingsOverlay');await settings.tap();await panel.locator('[data-theme="dark"]').tap();await panel.locator('[data-fc-action="font-up"]').tap();await wait(p);print({settings:{width,height,theme:await panel.locator('[data-theme="dark"]').getAttribute('aria-pressed'),scale:await p.evaluate(()=>GBReaderPreferences.get().fontScale),overflow:await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)}});if(width===390)await shot(p,'settings-dark');
 const done=panel.locator('.gill-settings-done');await done.scrollIntoViewIfNeeded();await wait(p);const foot=await panel.locator('.gill-settings-footer button').evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect();return {title:el.innerText,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}));if(height<400)await shot(p,`settings-foot-${width}`);print({settingsFooter:{width,height,foot}});await done.tap();await wait(p);print({doneReturn:{width,height,active:await active(p)}});
 await settings.tap();await p.locator('#mobLearningBtn').tap();await p.locator('#gillLearningOverlay.is-open').waitFor();await p.keyboard.press('Escape');await wait(p);print({learningReturn:{width,height,active:await active(p)}});
});
}
for(const w of [320,390])await run(w,844,async p=>{
 await open(p);const play=p.locator('.reader-mobile-play:visible'),q=await play.boundingBox();const cdp=await p.context().newCDPSession(p);const coord={x:q.x+22,y:q.y+22};
 await p.evaluate(()=>{window.traces=[];addEventListener('gb:reader-tts-state',e=>traces.push(e.detail.phase))});
 await p.touchscreen.tap(coord.x,coord.y);await p.waitForFunction(()=>GBReaderTTS.getState().phase==='playing');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[coord]});await wait(p,800);const held=await p.evaluate(()=>GBReaderTTS.getState().phase);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(p);
 print({longPress:{w,held,after:await p.evaluate(()=>GBReaderTTS.getState().phase),trace:await p.evaluate(()=>traces),speaks:await p.evaluate(()=>speaks)}});
 await open(p);await p.mouse.move(w/2,400);await p.mouse.wheel(0,900);await wait(p,450);await p.locator('#mobPartTocBtn').focus();await p.keyboard.press('Shift+Tab');const back1=await active(p);await p.keyboard.press('Shift+Tab');await wait(p);const focus=await p.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return {id:e.id,y:r.y,opacity:getComputedStyle(e.closest('header')||e).opacity,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}});print({reverseTab:{w,back1,focus}});
});
}finally{await b.close()}
