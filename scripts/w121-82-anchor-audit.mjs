import {chromium} from 'playwright';
import fs from 'node:fs';
const BASE=process.env.AUDIT_BASE||'http://127.0.0.1:8618';
const gill=['dzhon-gill-istoricheskiy-kontekst','dzhon-gill-chast-1-chelovek','dzhon-gill-chast-2-uchenyi','dzhon-gill-chast-4-ekzeget','dzhon-gill-chast-3-nasledie','dzhon-gill-spravochnik'];
const apostasy=['otstuplenie-chto-govorit-bibliya','otstupniki-biblii-iuda-saul-ierovoam-dimas','petr-i-iuda-padenie-ili-otstuplenie','otreklis-ot-hrista-istoriya-cerkvi','kogda-chelovek-uhodit-ot-very'];
const all=[...gill,...apostasy];const issues=[],data=[],unique=new Map(),editor=[];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:''}));
 for(const slug of all){
  const route='/articles/'+slug+'/';
  const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(()=>{
   let d={series:[]};try{d=JSON.parse(document.getElementById('gbAnalyticsStudy')?.getAttribute('data-study')||'{}')}catch{}
   return{series:d.series||[],editor:window.SITE_CONFIG?.quiz?.questions||[],study:document.getElementById('gbAnalyticsStudy')?.hidden===false};
  });
  if(response?.status()!==200)issues.push(route+' HTTP '+response?.status());
  data.push({slug,seriesCount:state.series.length,editorCount:state.editor.length,study:state.study});
  for(const q of state.series){
   if(unique.has(q.id)){
    if(JSON.stringify(unique.get(q.id).q)!==JSON.stringify(q))issues.push('mutating series identity '+q.id);
   } else unique.set(q.id,{q,route});
  }
  for(let i=0;i<state.editor.length;i++)editor.push({q:state.editor[i],route,idx:i});
 }
 const links=[];
 for(const {q,route} of unique.values())links.push({source:'series',id:q.id,href:q.sourceHref,route});
 for(const {q,route,idx} of editor)links.push({source:'article',id:route+'_'+idx,href:q.sourceRef?.href,route});
 const dests=new Map();
 for(const link of links){
  try{
   const u=new URL(link.href,BASE+link.route);
   if(u.origin!==new URL(BASE).origin){issues.push(link.id+' nonlocal source '+u.href);continue;}
   const target={...link,path:u.pathname,fragment:decodeURIComponent(u.hash.slice(1))};
   if(!target.fragment)issues.push(link.id+' missing fragment '+link.href);
   if(!dests.has(u.pathname))dests.set(u.pathname,[]);
   dests.get(u.pathname).push(target);
  }catch(e){issues.push(link.id+' bad URL '+e)}
 }
 for(const [pathname,targets] of dests){
  const response=await page.goto(BASE+pathname,{waitUntil:'domcontentloaded'});
  if(response?.status()!==200){issues.push(pathname+' HTTP '+response?.status());continue;}
  const missing=await page.evaluate(xs=>xs.filter(x=>!document.getElementById(x.fragment)).map(x=>x.id+':'+x.fragment),targets);
  missing.forEach(x=>issues.push(pathname+' missing source '+x));
 }
 const fallback=[];
 for(const route of ['/articles/kod-da-vinchi/','/articles/20-antisovetov-pastoru/','/nagornaya/chast-1/']){
  const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded'});
  const state=await page.evaluate(()=>({study:!!document.getElementById('gbAnalyticsStudy'),legacy:!!document.getElementById('quizLaunch'),questionCount:window.SITE_CONFIG?.quiz?.questions?.length||0}));
  fallback.push({route,http:response?.status(),...state});
  const seriesArticle=route.includes('20-antisovetov-pastoru');
  if(seriesArticle){
    if(!state.study||state.questionCount!==10||state.legacy)issues.push(route+' shared-series article quiz ownership incorrect');
  }else{
    if(state.study)issues.push(route+' excluded route mounted Analytics study');
    if(state.questionCount&&!state.legacy)issues.push(route+' inline quiz missing despite editorial bank');
  }
 }
 if(unique.size!==62)issues.push('Expected 62 unique series questions, got '+unique.size);
 if(editor.length!==20)issues.push('Expected 20 editorial questions, got '+editor.length);
 if(links.length!==82)issues.push('Expected 82 references, got '+links.length);
 const report={checks:{series:unique.size,editor:editor.length,anchors:links.length,sourcePages:dests.size},data,fallback,issues};
 fs.mkdirSync('reports/series-quiz-source-handoff',{recursive:true});
 fs.writeFileSync('reports/series-quiz-source-handoff/w121-82-anchor-audit.json',JSON.stringify(report,null,2));
 console.log('W121 SOURCE AUDIT '+JSON.stringify(report).slice(0,13500));
}finally{await browser.close();}
if(issues.length)process.exitCode=1;