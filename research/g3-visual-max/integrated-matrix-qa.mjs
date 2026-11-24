// Independent actual-route acceptance. Run in disposable exact parent archive only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
assert(process.env.G3_VISUAL_DISPOSABLE==='1'&&!fs.existsSync(path.join(root,'.git')));
const at=(...p)=>path.join(root,...p);
const route='/journal/dossiers/g3/history/';
const built=at('dist',route.slice(1),'index.html');
assert(fs.existsSync(built),'actual parent route build required');
const html=fs.readFileSync(built,'utf8');
assert.equal((html.match(/id="cite-g3-matrix-[^"]+"/g)||[]).length,60);
const base=JSON.parse(fs.readFileSync(at('src/components/journal/g3-visual/matrix-data.json'),'utf8'));
const expanded=JSON.parse(fs.readFileSync(at('src/components/journal/g3-visual/adopted-visual-data.json'),'utf8'));
const expected=[...base.rows.flatMap(r=>r.years.map(y=>({id:'cite-g3-matrix-'+r.id+'-'+y,year:y,name:r.name}))),...expanded.matrix.entries.map(r=>({id:'cite-g3-matrix-'+r.id+'-'+r.year,year:r.year,name:r.name}))];
assert.equal(new Set(expected.map(r=>r.id)).size,60);
const names=new Set(expected.map(r=>r.name));assert.equal(names.size,26);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.ico':'image/x-icon','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';
 const files=[path.resolve(at('dist'),'.'+p),path.resolve(root,'.'+p)];
 const f=files.find(f=>f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile());
 if(!f){res.writeHead(404);res.end('Not present in route archive');return}
 res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const issues=[],reports=[],out=at('integrated-evidence');fs.mkdirSync(out,{recursive:true});
const note=(where,kind,detail)=>{issues.push({where,kind,detail});if(issues.length<=8)console.log('EARLY_ISSUE',JSON.stringify({where,kind,detail}));};
try{
 for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch();let geometry=0,returns=0,filter=0,print=0;
  try{
   for(const width of [320,390,740,1024,1440])for(const dark of [false,true])for(const js of [false,true]){
    const where={engine,width,dark,js},ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:js,colorScheme:dark?'dark':'light'});
    await ctx.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const page=await ctx.newPage();page.setDefaultTimeout(7000);
    const errors=[],missing=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(origin+'/'))missing.push(new URL(r.url()).pathname)});
    try{
     const response=await page.goto(origin+route,{waitUntil:'load'});assert.equal(response?.status(),200,'actual history route HTTP status');
     await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
     await page.evaluate(()=>document.fonts.ready);
     const matrix=page.locator('.g3-matrix'),row=matrix.locator('.gm-row'),control=matrix.locator('.gm-filter');
     assert.equal(await matrix.count(),1);assert.equal(await matrix.getAttribute('data-publication-claims'),'G3-HIST-PUB-12');
     assert.equal(await row.count(),26);assert.equal(await row.filter({visible:true}).count(),26);
     assert.equal(await matrix.locator('a[data-journal-citation]').count(),60);
     assert.equal(await page.locator('.je-contents a[href="#g3-catalogue-matrix"]').count(),1);
     assert.equal(await control.isVisible(),js);
     const state=await matrix.evaluate(e=>{const all=[...document.querySelectorAll('[id]')].map(x=>x.id);const r=e.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth-innerWidth,matrixOverflow:e.scrollWidth-e.clientWidth,unique:all.length===new Set(all).size,width:r.width}});
     if(state.overflow>1||state.matrixOverflow>1||!state.unique)note(where,'geometry',state);
     const actual=await matrix.locator('a[data-journal-citation]').evaluateAll(es=>es.map(e=>({id:e.id,hash:e.hash,label:e.getAttribute('aria-label'),destination:!!document.getElementById(e.hash.slice(1))})));
     for(const x of expected){const got=actual.find(a=>a.id===x.id);assert(got&&got.hash==='#history-source-gnl-'+x.year&&got.destination&&got.label===x.name+', каталог '+x.year+' года',x.id)}
     geometry++;
     // All 60 pairs in each engine and mode; representative new-year edges on mobile/dark.
     const targets=width===740&&!dark?expected:(width===320&&dark?expected.filter(e=>e.id==='cite-g3-matrix-lawson-2018'||e.id==='cite-g3-matrix-lawson-2021'):[]);
     for(const x of targets){
      const a=page.locator('#'+x.id);await a.focus();await page.keyboard.press('Enter');
      const target='#history-source-gnl-'+x.year;await page.waitForFunction(t=>location.hash===t,target);
      const back=page.locator(target+' [data-journal-source-return]'),dest=await back.getAttribute('href');
      if(js)assert.equal(dest,'#'+x.id);else{assert(dest);assert(await page.locator(dest).count()===1);if([2018,2021].includes(x.year))assert.equal(dest,'#g3-catalogue-matrix')}
      await back.focus();await page.keyboard.press('Enter');await page.waitForFunction(t=>location.hash===t,dest);returns++;
     }
     if(js&&width===320){
      const q=control.locator('input'),y=control.locator('select'),reset=control.locator('button');
      await q.fill('Вошер');assert.equal(await row.filter({visible:true}).count(),1);
      await y.selectOption('2018');assert.equal(await row.filter({visible:true}).count(),0);
      await reset.click();assert.equal(await row.filter({visible:true}).count(),26);assert.equal(await q.inputValue(),'');assert.equal(await y.inputValue(),'');filter++;
      const x=expected.find(x=>x.id==='cite-g3-matrix-lawson-2018'),a=page.locator('#'+x.id);
      await a.click();await q.fill('zz-no-match');assert.equal(await a.isVisible(),false);
      const back=page.locator('#history-source-gnl-2018 [data-journal-source-return]');await back.click();await a.waitFor({state:'visible'});assert.equal(await q.inputValue(),'');
      await q.fill('zz-no-match');await back.focus();await page.keyboard.press('Enter');await a.waitFor({state:'visible'});assert.equal(await q.inputValue(),'');filter+=2;
      await page.goto(origin+route+'#'+x.id);await a.waitFor({state:'visible'});assert.equal(await page.evaluate(()=>location.hash),'#'+x.id);filter++;
     }
     if(width===740&&engine==='chromium'){
      if(js)await control.locator('input').fill('Вошер');
      await page.emulateMedia({media:'print'});assert.equal(await row.filter({visible:true}).count(),26);
      for(const paper of ['A4','Letter']){await page.pdf({path:path.join(out,'history-'+paper+'-'+(dark?'dark':'light')+'-'+(js?'js':'nojs')+'.pdf'),format:paper,printBackground:true,margin:{top:'14mm',bottom:'14mm',left:'14mm',right:'14mm'}});print++}
     }
     if((width===320||width===1440)&&js){await page.emulateMedia({media:'screen'});await matrix.screenshot({path:path.join(out,engine+'-'+width+'-'+(dark?'dark':'light')+'.png')})}
     if(errors.length)note(where,'pageerror',errors);
     const critical=missing.filter(p=>/\.(css|js|mjs|woff2?|webp|avif|svg|png)$/.test(p));
     if(critical.length)note(where,'missing-static',Array.from(new Set(critical)));
    }catch(e){note(where,'assertion',e.stack||String(e))}
    finally{await ctx.close()}
   }
   const result={engine,version:browser.version(),geometry,returns,filter,print,issues:issues.filter(x=>x.where.engine===engine).length};reports.push(result);console.log('ENGINE',JSON.stringify(result));
  }finally{await browser.close()}
 }
}finally{await new Promise(r=>server.close(r))}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({reports,issues},null,2));
console.log('INTEGRATED_RESULT',JSON.stringify({reports,issueCount:issues.length}));
for(const issue of issues.slice(0,8))console.log('ISSUE',JSON.stringify(issue));
if(issues.length)process.exitCode=1;
