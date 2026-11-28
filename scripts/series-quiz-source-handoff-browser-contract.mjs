#!/usr/bin/env node
/**
 * W121: article + series quiz share ONE DOM owner across inline and Analytics.
 * This replaces the retired Settings→Learning sheet contract with stronger,
 * source-backed browser scenarios; it does not waive existing functional gates.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {serve} from './lib/a04-contract.mjs';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require('playwright');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'reports','series-quiz-source-handoff');
fs.mkdirSync(OUT,{recursive:true});
const GILL='/articles/dzhon-gill-chast-2-uchenyi/';
const APOSTASY='/articles/otstuplenie-chto-govorit-bibliya/';
const TEEN='/articles/podrostok-za-kadrom-dvoynaya-zhizn/';
const failures=[],checks=[],screens={};
function ck(label,condition,detail=''){
  const ok=!!condition;checks.push({label,ok,detail});
  console.log((ok?'PASS ':'FAIL ')+label+(detail?' :: '+detail:''));
  if(!ok)failures.push(label+' '+detail);
}
async function withEngine(engineName,engine,base){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',
    isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:'',contentType:'text/plain'}));
  const page=await ctx.newPage();const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(base+GILL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#gbAnalyticsStudy:not([hidden])').waitFor({timeout:20000});
  const atStart=await page.evaluate(()=>({
    learning:!!document.querySelector('#gillLearningOverlay,#mobLearningBtn'),
    study:document.querySelectorAll('#gbAnalyticsStudy').length,
    quizLegacy:document.querySelectorAll('#quizLaunch').length,
    series:JSON.parse(document.querySelector('#gbAnalyticsStudy').getAttribute('data-study')).series.length,
    inline:!!document.querySelector('#quizPlaceholder #gbAnalyticsStudy')
  }));
  ck(engineName+' Gill II: one inline owner, no Learning or legacy quiz',
    !atStart.learning&&atStart.study===1&&atStart.quizLegacy===0&&atStart.inline,
    JSON.stringify(atStart));
  ck(engineName+' Gill II: own series bank 32',atStart.series===32);
  await page.locator('#gbAnalyticsStudy > summary').click();
  let total=await page.evaluate(()=>window.SITE_CONFIG?.quiz?.questions?.length||0);
  ck(engineName+' article quiz 4 editorial questions',total===4);
  const ask=async(index)=>{
    const correct=await page.evaluate(i=>window.SITE_CONFIG.quiz.questions[i].correct,index);
    const options=page.locator('#gbAnalyticsQuiz .gb-study-options button');
    await options.nth(Number(correct)).click();
    await page.locator('#gbAnalyticsQuiz .gb-study-feedback').waitFor();
    const first=(await page.locator('#gbAnalyticsQuiz .gb-study-next').textContent()).trim();
    return first;
  };
  await ask(0);
  const link=page.locator('#gbAnalyticsQuiz .gb-study-feedback a').first();
  const hashBefore=await link.getAttribute('href');
  await link.click();
  ck(engineName+' Perereread current article: fragment+focus',await page.evaluate(raw=>{
    let url=new URL(raw,location.href);return location.hash===url.hash&&
      (document.activeElement?.id===decodeURIComponent(url.hash.slice(1)))&&
      !document.querySelector('#partTocOverlay.is-open');
  },hashBefore),hashBefore);
  await page.goBack({waitUntil:'domcontentloaded'}).catch(()=>{});
  await page.locator('#gbAnalyticsStudy > summary').click().catch(()=>{});
  ck(engineName+' return after source retains answered question',
    await page.locator('#gbAnalyticsQuiz .gb-study-feedback').count()===1);
  await page.locator('#gbAnalyticsQuiz .gb-study-next').click();
  await ask(1);
  await page.locator('#gbAnalyticsQuiz .gb-study-next').click();
  // Open the bottom Part TOC then select its canonical Analytics tab.
  // The top research capsule may be scrolled away after a source jump.
  await page.locator('#mobPartTocBtn').click();
  await page.locator('#gbrMarginaliaTab').click();
  await page.locator('#gbrMarginalia:not([hidden])').waitFor({timeout:12000});
  await page.waitForFunction(()=>!!document.querySelector('#gbrMarginaliaContent #gbAnalyticsStudy'),null,{timeout:10000});
  ck(engineName+' Analytics: same DOM, continue question 3',await page.evaluate(()=>{
    const p=document.querySelector('#gbrMarginaliaContent #gbAnalyticsStudy');
    return !!p&&document.querySelectorAll('#gbAnalyticsStudy').length===1&&
      p.textContent.includes('Вопрос 3 из 4');
  }));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#partTocOverlay.is-open'),null,{timeout:12000});
  ck(engineName+' Escape restores native sheet',await page.evaluate(()=>
    !document.querySelector('#partTocOverlay.is-open')&&
    document.querySelectorAll('#gbAnalyticsStudy').length===1));
  await page.waitForFunction(()=>!!document.querySelector('#quizPlaceholder #gbAnalyticsStudy'),null,{timeout:10000});
  await ask(2);await page.locator('#gbAnalyticsQuiz .gb-study-next').click();
  await ask(3);await page.locator('#gbAnalyticsQuiz .gb-study-next').click();
  ck(engineName+' article final score and series opt-in',
    await page.locator('#gbAnalyticsQuiz .gb-study-score').textContent()==='Результат: 4 из 4' &&
    await page.getByRole('button',{name:/Проверить себя по всей серии/}).count()===1);
  await page.getByRole('button',{name:/Проверить себя по всей серии/}).click();
  ck(engineName+' series mode selected',await page.locator('[data-study-mode="series"]').getAttribute('aria-pressed')==='true');
  const answerSeries=async(correct)=>{
    const q=await page.locator('#gbAnalyticsQuiz h4').textContent();
    const item=await page.evaluate(question=>{
      const bank=JSON.parse(document.getElementById('gbAnalyticsStudy').getAttribute('data-study')).series;
      return bank.find(x=>x.question===question);
    },q);
    if(!item)throw Error('Question from source pool absent: '+q);
    await page.getByRole('button',{name:'Точно знаю'}).click();
    const idx=correct?item.correctIndex:(item.correctIndex+1)%item.answers.length;
    const label=item.answers[idx];
    await page.locator('#gbAnalyticsQuiz .gb-study-options button').filter({hasText:label}).first().click();
    return{item,feedback:await page.locator('#gbAnalyticsQuiz .gb-study-feedback strong').textContent()};
  };
  const wrong=await answerSeries(false);
  ck(engineName+' shuffled series wrong answer correctly marked',wrong.feedback==='Неверно');
  await page.locator('#gbAnalyticsQuiz .gb-study-next').click();
  const right=await answerSeries(true);
  ck(engineName+' shuffled series correct answer correctly marked',right.feedback==='Верно');
  ck(engineName+' series source hyperlink present',await page.locator('#gbAnalyticsQuiz .gb-study-feedback a').count()===1);
  const beforeSource=await page.locator('#gbAnalyticsQuiz h4').textContent();
  // If current source is another Gill article, verify regular navigation + Back.
  const xUrl=await page.locator('#gbAnalyticsQuiz .gb-study-feedback a').getAttribute('href');
  const target=new URL(xUrl,base+GILL);
  if(target.pathname!==GILL){
    await page.locator('#gbAnalyticsQuiz .gb-study-feedback a').click();
    await page.waitForURL(u=>u.pathname===target.pathname,{timeout:15000});
    ck(engineName+' cross-article source navigation',new URL(page.url()).pathname===target.pathname);
    await page.goBack({waitUntil:'domcontentloaded'});
    await page.locator('#gbAnalyticsStudy:not([hidden])').waitFor({timeout:15000});
    ck(engineName+' Back restores same series question',await page.locator('#gbAnalyticsQuiz h4').textContent()===beforeSource);
  } else {
    ck(engineName+' same-article series source',!!target.hash,target.href);
  }
  ck(engineName+' no duplicate IDs on Gill II',await page.evaluate(()=>{
    const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
    return new Set(ids).size===ids.length;
  }));
  await page.screenshot({path:path.join(OUT,engineName+'-gill-mobile.png')});
  // Bank-only route: no editorial SITE_CONFIG.quiz.
  await page.goto(base+APOSTASY,{waitUntil:'domcontentloaded'});
  await page.locator('#gbAnalyticsStudy:not([hidden])').waitFor({timeout:15000});
  ck(engineName+' Apostasy 30 series-only questions',await page.evaluate(()=>{
    const d=JSON.parse(document.getElementById('gbAnalyticsStudy').getAttribute('data-study'));
    return d.series.length===30&&!window.SITE_CONFIG?.quiz?.questions?.length;
  }));
  // No data: no empty study tab.
  await page.goto(base+TEEN,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(200);
  ck(engineName+' no-data route: no blank Quiz or Learning',
    await page.locator('#gbAnalyticsStudy,#gillLearningOverlay,#mobLearningBtn').count()===0);
  ck(engineName+' no uncaught Product JS errors',pageErrors.length===0,pageErrors.join(' | ').slice(0,250));
  await ctx.close();
  // Desktop W57 and non-pilot desktop share inline fallback and one research owner.
  const dc=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'});
  await dc.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:'',contentType:'text/plain'}));
  const dp=await dc.newPage();await dp.goto(base+GILL+'?reader-pilot=1&paper=space&panel=open',{waitUntil:'domcontentloaded'});
  await dp.locator('#gbAnalyticsStudy:not([hidden])').waitFor({timeout:15000});
  await dp.waitForFunction(()=>!!document.querySelector('#npUResearch .np-u-right-scroll #gbAnalyticsStudy'),null,{timeout:20000});
  ck(engineName+' desktop W57: study in existing Research, no second sheet',await dp.evaluate(()=>
    document.body.classList.contains('np-w57-ready')&&
    document.querySelectorAll('#gbAnalyticsStudy').length===1&&
    !document.querySelector('#gillLearningOverlay,#mobLearningBtn')));
  await dp.screenshot({path:path.join(OUT,engineName+'-w57-desktop.png')});
  await dp.goto(base+GILL,{waitUntil:'domcontentloaded'});
  await dp.locator('#gbAnalyticsStudy:not([hidden])').waitFor({timeout:15000});
  ck(engineName+' standard desktop: inline article quiz fallback',
    await dp.locator('#quizPlaceholder #gbAnalyticsStudy').count()===1);
  await dc.close();
 }finally{await browser.close();}
}
const {server,base}=process.env.AUDIT_BASE?{server:null,base:process.env.AUDIT_BASE}:await serve();
try{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
   try{await withEngine(name,engine,base)}catch(e){failures.push(name+' FATAL '+String(e));console.error(name+' FATAL '+String(e));}
 }
}finally{if(server)await new Promise(done=>server.close(done));}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({base,checks,failures},null,2));
console.log('W121 QUIZ HANDOFF '+JSON.stringify({checks:checks.length,failed:failures.length}));
if(failures.length)process.exitCode=1;
