import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const BASE=process.env.AUDIT_BASE||'http://127.0.0.1:8618';
const ARTICLE='/articles/dzhon-gill-chast-2-uchenyi/';
const OUT='reports/w127-quiz-accordion';
fs.mkdirSync(OUT,{recursive:true});
let checks=0;const failures=[];
const ck=(name,pass,info='')=>{checks++;console.log((pass?'PASS ':'FAIL ')+name+(info?' '+info:''));if(!pass)failures.push({name,info})};
const near=(a,b,eps=.6)=>Math.abs(a-b)<=eps;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const [width,theme] of [[320,'light'],[390,'light'],[390,'dark'],[525,'light'],[768,'light'],[1120,'light']]){
  const tag=name+' '+width+' '+theme;
  const context=await browser.newContext({viewport:{width,height:860},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:''}));
  const page=await context.newPage();const jsErrors=[];page.on('pageerror',e=>jsErrors.push(String(e)));
  try{
   const res=await page.goto(BASE+ARTICLE,{waitUntil:'domcontentloaded',timeout:26000});
   ck(tag+' page HTTP 200',res?.status()===200);
   await page.locator('[data-gill-marginalia-open]').first().click();
   await page.locator('#gbrMarginalia:not([hidden])').waitFor({timeout:16000});
   await page.locator('#gbrMarginaliaContent #gbAnalyticsStudy:not([hidden])').waitFor({timeout:13000});
   const metrics=await page.evaluate(()=>{
    const root=document.querySelector('#gbrMarginaliaContent');
    const groups=[...root.querySelectorAll('details.gbr-marginalia-group')];
    const plain=groups.find(e=>e.id!=='gbAnalyticsStudy'),study=document.querySelector('#gbAnalyticsStudy');
    const a=plain?.querySelector(':scope > summary'),b=study?.querySelector(':scope > summary');
    const box=e=>{const r=e?.getBoundingClientRect(),s=e&&getComputedStyle(e);return r?{x:r.x,right:r.right,width:r.width,height:r.height,borderRadius:s.borderRadius,borderWidth:s.borderTopWidth,paddingLeft:s.paddingLeft,marginBottom:s.marginBottom}:null};
    const summary=e=>{const s=getComputedStyle(e),t=e.querySelector('strong'),ts=getComputedStyle(t),arrow=getComputedStyle(e,'::after');return {height:box(e).height,fontFamily:ts.fontFamily,fontSize:ts.fontSize,fontWeight:ts.fontWeight,lineHeight:ts.lineHeight,arrow:arrow.content,arrowTransform:arrow.transform,padding:s.padding}};
    return{studyClass:study?.className,studyCount:document.getElementById('gbAnalyticsStudyCount')?.textContent,
      studyOpen:study?.open,studyCountDom:document.querySelectorAll('#gbAnalyticsStudy').length,
      baseBox:box(plain),studyBox:box(study),baseSummary:summary(a),studySummary:summary(b),
      extraSearch:!!root.querySelector('.gbr-marginalia-search'),hostOverflow:root.scrollWidth-root.clientWidth};
   });
   ck(tag+' one movable quiz, no search tile',metrics.studyCountDom===1&&!metrics.extraSearch);
   ck(tag+' same accordion class',metrics.studyClass.includes('gbr-marginalia-group'));
   ck(tag+' same geometry and radius',near(metrics.studyBox.width,metrics.baseBox.width)&&metrics.studyBox.borderRadius===metrics.baseBox.borderRadius&&
     metrics.studyBox.borderWidth===metrics.baseBox.borderWidth&&metrics.studyBox.paddingLeft===metrics.baseBox.paddingLeft&&
     metrics.studyBox.marginBottom===metrics.baseBox.marginBottom,JSON.stringify({base:metrics.baseBox,study:metrics.studyBox}));
   ck(tag+' same summary type and dimension',metrics.studySummary.fontFamily===metrics.baseSummary.fontFamily&&
     metrics.studySummary.fontSize===metrics.baseSummary.fontSize&&metrics.studySummary.fontWeight===metrics.baseSummary.fontWeight&&
     near(metrics.studySummary.height,metrics.baseSummary.height,.1)&&
     metrics.studySummary.padding===metrics.baseSummary.padding,
     JSON.stringify({base:metrics.baseSummary,study:metrics.studySummary}));
   ck(tag+' real collapsed chevron',metrics.studySummary.arrow!=='none'&&metrics.studySummary.arrow===metrics.baseSummary.arrow);
   ck(tag+' compact numerical question count',metrics.studyCount==='4',metrics.studyCount);
   ck(tag+' no panel horizontal overflow',metrics.hostOverflow<=1,'overflow='+metrics.hostOverflow);
   if((width===390||width===525)&&theme==='light'||(width===390&&theme==='dark'))await page.screenshot({path:path.join(OUT,name+'-'+width+'-'+theme+'-collapsed.png')});
   const summary=page.locator('#gbAnalyticsStudy > summary');
   await summary.click();
   ck(tag+' opens as native details',await page.locator('#gbAnalyticsStudy[open]').count()===1);
   const after=await page.evaluate(()=>{
    const root=document.getElementById('gbAnalyticsStudy'),head=root.querySelector('summary'),opts=[...root.querySelectorAll('.gb-study-options button')],mode=root.querySelector('.gb-analytics-study__modes');
    const h=getComputedStyle(head,'::after'),s=root.querySelector('#gbAnalyticsQuiz h4'),style=s&&getComputedStyle(s);
    return{quizText:root.innerText.slice(0,230),options:opts.length,optionWidths:opts.map(x=>x.getBoundingClientRect().width),
      optionRadius:opts[0]&&getComputedStyle(opts[0]).borderRadius,optionFont:opts[0]&&getComputedStyle(opts[0]).fontFamily,
      questionFont:style?.fontFamily,questionSize:style?.fontSize,
      status:root.querySelector('.gb-study-status')?.textContent,
      modesHidden:mode?.hidden,headArrow:h.content,headTransform:h.transform,
      panelOverflow:document.getElementById('gbrMarginaliaContent').scrollWidth-document.getElementById('gbrMarginaliaContent').clientWidth,
      quizOverflow:root.scrollWidth-root.clientWidth};
   });
   ck(tag+' question visible and mode-only switch omitted',after.status?.startsWith('Вопрос 1 из 4')&&after.modesHidden,JSON.stringify({status:after.status,modesHidden:after.modesHidden}));
   ck(tag+' premium options show and fit',after.options>=2&&after.optionRadius==='6px'&&after.optionWidths.every(w=>w>40)&&after.questionSize==='16.5px');
   ck(tag+' expanded chevron state changes',metrics.studySummary.arrowTransform!==after.headTransform,after.headTransform);
   ck(tag+' expanded quiz no horizontal clipping',after.panelOverflow<=1&&after.quizOverflow<=1);
   if((width===390||width===525)&&theme==='light'||(width===390&&theme==='dark'))await page.screenshot({path:path.join(OUT,name+'-'+width+'-'+theme+'-expanded.png')});
   const first=page.locator('#gbAnalyticsQuiz .gb-study-options button').first();
   await first.click();
   ck(tag+' answer keeps feedback and continuation',await page.locator('#gbAnalyticsQuiz .gb-study-feedback').count()===1&&
     await page.locator('#gbAnalyticsQuiz .gb-study-next').count()===1);
   await page.locator('#gbAnalyticsQuiz .gb-study-next').click();
   ck(tag+' next question progress preserved',await page.locator('#gbAnalyticsQuiz .gb-study-status').first().textContent()==='Вопрос 2 из 4');
   await summary.click();
   ck(tag+' collapses without resetting attempt',await page.locator('#gbAnalyticsStudy:not([open])').count()===1);
   await summary.click();
   ck(tag+' reopen returns to same question',await page.locator('#gbAnalyticsQuiz .gb-study-status').first().textContent()==='Вопрос 2 из 4');
   ck(tag+' zero first-party JS errors',jsErrors.length===0,jsErrors.slice(0,2).join('|'));
  }catch(e){ck(tag+' unexpected',false,String(e).slice(0,380));}
  finally{await context.close();}
 }
 await browser.close();
}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({checks,failures},null,2));
console.log('W127_ACCORDION_QA '+(checks-failures.length)+'/'+checks+' PASS');
if(failures.length)process.exitCode=1;