const fs=require('fs'),path=require('path'),{chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist/baptisty-rossii'),out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_INTEGRATED_V15_QA_20261112');
const routes=['/baptisty-rossii/',...fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,e.name,'index.html'))).map(e=>'/baptisty-rossii/'+e.name+'/')];
const base='http://127.0.0.1:8831';
(async()=>{const rows=[];
for(const[name,engine]of Object.entries({chromium,firefox,webkit})){const b=await engine.launch(),page=await b.newPage({viewport:{width:1593,height:900},reducedMotion:'reduce'});
for(const route of routes){const row={engine:name,route};try{
const resp=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:15000});if(resp.status()!==200)throw Error('HTTP '+resp.status());
await page.waitForFunction(()=>document.querySelector('[data-reader-integrated-rail]')?.dataset.readerRailFoldReady==='1');
const t=page.locator('[data-reader-rail-toggle]');if(await t.count()!==1)throw Error('Toggle count');
await t.click();await page.waitForTimeout(35);
const folded=await page.evaluate(()=>{const e=document.querySelector('[data-reader-integrated-rail]'),t=e.querySelector('[data-reader-rail-toggle]'),a=e.getBoundingClientRect(),r=e.querySelector('[data-reader-fold-content]');return{width:a.width,x:a.x,height:a.height,expanded:t.getAttribute('aria-expanded'),inert:r.hasAttribute('inert'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
if(Math.abs(folded.width-68)>1||folded.x!==0||!folded.inert||folded.expanded!=='false'||folded.overflow>2)throw Error('Fold geometry '+JSON.stringify(folded));
await t.click();await page.waitForTimeout(35);
const unfolded=await page.evaluate(()=>{const e=document.querySelector('[data-reader-integrated-rail]');return{width:e.getBoundingClientRect().width,inert:e.querySelector('[data-reader-fold-content]').hasAttribute('inert'),aria:e.querySelector('[data-reader-rail-toggle]').getAttribute('aria-expanded')}});
if(unfolded.width<290||unfolded.width>330||unfolded.inert||unfolded.aria!=='true')throw Error('Unfold geometry '+JSON.stringify(unfolded));
row.pass=true;
}catch(e){row.pass=false;row.error=String(e).slice(0,360)}
rows.push(row);}
await page.close();await b.close();}
const bad=rows.filter(x=>!x.pass);fs.writeFileSync(path.join(out,'V15_ALL_BAPTIST_FOLD_ROUTES.json'),JSON.stringify({routes:routes.length,cases:rows.length,passed:rows.length-bad.length,failures:bad,rows},null,2));console.log(JSON.stringify({routes:routes.length,cases:rows.length,passed:rows.length-bad.length,failures:bad.slice(0,8)},null,2));if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});
