import { chromium } from 'playwright';
const b=await chromium.launch();
for(const [name,url] of [['single-herm','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],['gill-context','/articles/dzhon-gill-istoricheskiy-kontekst/']]){
  const pg=await b.newPage({viewport:{width:1280,height:1000}});
  await pg.goto('http://127.0.0.1:8099'+url,{waitUntil:'networkidle',timeout:20000});
  await pg.waitForTimeout(600);
  const wrap=await pg.$('.gb-ember-wrap');
  if(!wrap){console.log(name+': no ember-wrap');await pg.close();continue;}
  await pg.hover('.gb-ember-wrap');
  await pg.waitForTimeout(450);
  const r=await pg.evaluate(()=>{
    const p=document.querySelector('.gb-ember-wrap:hover .gb-ember-expand')||document.querySelector('.gb-ember-expand');
    const e=document.querySelector('.gb-ember-wrap .gb-ember');
    const pr=p?p.getBoundingClientRect():null, er=e?e.getBoundingClientRect():null;
    // direction: pill above ember (gill) vs left of ember (single)
    let dir='?';
    if(pr&&er){ if(pr.bottom<=er.top+6) dir='UP'; else if(pr.right<=er.left+30) dir='LEFT'; else dir='overlap/other'; }
    return {opacity:p?getComputedStyle(p).opacity:null, emberShift:e?getComputedStyle(e).transform:null, dir};
  });
  console.log(name+':',JSON.stringify(r));
  await pg.close();
}
await b.close();
