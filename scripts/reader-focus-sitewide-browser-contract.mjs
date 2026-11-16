// Site-wide reader geometry / reading preference witness on built Product pages.
import {chromium, firefox, webkit} from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const OUT=path.join(ROOT,'reports','reader-focus-sitewide');
fs.mkdirSync(OUT,{recursive:true});
const routes=[
  ['grok','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
  ['gill','/articles/dzhon-gill-chast-1-chelovek/'],
  ['sermon','/nagornaya/chast-1/']
];
for(const [,route] of routes)
  if(!fs.existsSync(path.join(DIST,route.slice(1),'index.html')))
    throw new Error('Expected built route missing: '+route);
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2',
 '.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  const target=path.resolve(DIST,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  const rel=path.relative(DIST,target);
  if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
    res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const rows=[];
for(const [engine,browserType] of Object.entries({chromium,firefox,webkit})){
 const browser=await browserType.launch({headless:true});
 for(const [slug,route] of routes){
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900},
       serviceWorkers:'block',reducedMotion:'no-preference'});
   page.setDefaultTimeout(12000);
   const row={engine,slug,width,fail:[],proof:{}};
   const check=(name,ok,detail)=>{if(!ok)row.fail.push({name,detail});};
   try{
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});
    check('HTTP 200',response.status()===200,response.status());
    await page.waitForTimeout(160);
    const initial=await page.evaluate(()=>{
      const html=document.documentElement;
      const a=document.querySelector('.article-body');
      const p=a?.querySelector(':scope > p');
      const rect=p?.getBoundingClientRect();
      return {rootMeasure:getComputedStyle(html).getPropertyValue('--gb-reader-measure').trim(),
       focusMeasure:getComputedStyle(html).getPropertyValue('--gb-reader-focus-measure').trim(),
       overflow:html.scrollWidth-innerWidth,
       hasArticle:!!a,hasReadable:!!(p&&rect&&rect.width>250),
       title:document.title};
    });
    row.proof.initial=initial;
    check('no horizontal overflow',initial.overflow<=2,initial);
    check('sitewide focus width',initial.focusMeasure==='49rem',initial);
    if(slug==='grok'&&width===1440){
      await page.locator('.hrail--grok.grok-ready').waitFor();
      const original=await page.locator('.article-body > p').first().boundingBox();
      row.proof.expanded=original;
      await page.screenshot({path:path.join(OUT,engine+'-grok-expanded.png')});
      await page.locator('#hrailLayoutToggle').click();
      await page.waitForTimeout(680);
      for(const [measure,expected] of [['narrow',576],['normal',784],['wide',848]]){
        await page.evaluate(m=>document.documentElement.setAttribute('data-reader-measure',m),measure);
        await page.waitForTimeout(580);
        const m=await page.evaluate(()=>{
          const p=document.querySelector('.article-body > p'),r=p.getBoundingClientRect();
          const rail=document.querySelector('.hrail--grok');
          return {x:r.x,width:r.width,right:Math.min(window.innerWidth,document.documentElement.scrollWidth)-r.right,railWidth:rail.getBoundingClientRect().width,
           movedControls:!!document.querySelector('.grok-compact-tools #gbFloatingControls'),
           overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
           preference:document.documentElement.getAttribute('data-reader-measure')};
        });
        row.proof[measure]=m;
        check(measure+' width preference',Math.abs(m.width-expected)<8,m);
        check(measure+' balanced right canvas',Math.abs((m.x-m.railWidth)-m.right)<12,m);
        check(measure+' controls migrated',m.movedControls,m);
        check(measure+' no overflow',m.overflow<=2,m);
        if(measure==='normal')await page.screenshot({path:path.join(OUT,engine+'-grok-compact-normal.png')});
      }
      const label=await page.evaluate(()=>{
        const el=document.querySelector('#hmThemeGroup');
        const caption=document.querySelector('#hmThemeLabel');
        const css=caption&&getComputedStyle(caption);
        return {role:el?.getAttribute('role'),labelledby:el?.getAttribute('aria-labelledby'),
         caption:caption?.textContent?.trim(),color:css?.color};
      });
      row.proof.settingsLabel=label;
      check('accessible settings group',label.role==='group'&&label.labelledby==='hmThemeLabel',label);
      await page.evaluate(()=>document.documentElement.removeAttribute('data-reader-measure'));
    } else if(slug==='grok'&&width===390){
      await page.screenshot({path:path.join(OUT,engine+'-grok-mobile.png')});
    } else if(width===1440){
      await page.screenshot({path:path.join(OUT,engine+'-'+slug+'.png')});
    }
   }catch(error){row.fail.push({name:'execution',detail:String(error)})}
   rows.push(row);
   await page.close();
  }
 }
 await browser.close();
}
fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(r=>({engine:r.engine,slug:r.slug,width:r.width,fail:r.fail})),null,2));
await new Promise(resolve=>server.close(resolve));
if(rows.some(r=>r.fail.length))process.exitCode=1;
