#!/usr/bin/env node
// Exact-build visual/text contract. Serve fresh dist in isolation, without production writes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const ROUTE='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const dir=path.join(ROOT,'reports','grok-typography');
fs.mkdirSync(dir,{recursive:true});
if(!fs.existsSync(path.join(DIST,ROUTE.slice(1),'index.html')))throw new Error('fresh Product dist required');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 try {
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  let file=path.resolve(DIST,pathname.replace(/^\/+/,''));
  if(!path.extname(file))file=path.join(file,'index.html');
  const relative=path.relative(DIST,file);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
 } catch{res.writeHead(400);res.end('bad request');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const route='http://127.0.0.1:'+server.address().port+ROUTE;
const cases=[
 {id:'desktop-1440',w:1440,h:900},
 {id:'desktop-1200',w:1200,h:800},
 {id:'small-desktop-1024',w:1024,h:768},
 {id:'tablet-768',w:768,h:900},
 {id:'mobile-390',w:390,h:844},
 {id:'mobile-320',w:320,h:640},
 {id:'short-900',w:1440,h:300},
];
const report=[];
for(const [engine,kind] of Object.entries({chromium,firefox,webkit})){
 const browser=await kind.launch({headless:true});
 for(const size of cases){
  const page=await browser.newPage({viewport:{width:size.w,height:size.h},serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>/^(mc\.yandex\.(ru|com)|www\.googletagmanager\.com)$/.test(new URL(r.request().url()).hostname)?r.fulfill({status:200,body:''}):r.continue());
  const entry={engine,viewport:size.id};
  try{
   await page.goto(route,{waitUntil:'domcontentloaded',timeout:30000});
   await page.evaluate(()=>document.fonts.ready);
   const result=await page.evaluate(()=>{
    const main=document.querySelector('.article-body');
    const rows=[...main.querySelectorAll('p, li')];
    const notice=[...document.querySelectorAll('.notice p')];
    const pdf=notice.find(p=>p.textContent?.includes('Оригинал на английском (PDF):'));
    const strong=pdf?.querySelector('strong'), a=pdf?.querySelector('a[href]');
    const txt=pdf?.textContent?.trim()||'';
    const getTrimText=n=>n.nodeType===Node.TEXT_NODE?n.textContent:(n.nodeType===Node.ELEMENT_NODE?n.textContent:'');
    const tag=n=>n.nodeType===Node.TEXT_NODE?'#text':(n.nodeType===Node.ELEMENT_NODE?n.tagName.toLowerCase():'other');
    const suspect=[];
    for(const p of rows){
      if(p.closest('.tooltip, .gtip, .btip, .footnotes'))continue;
      const nodes=[...p.childNodes].filter(n=>{
        if(n.nodeType===Node.COMMENT_NODE)return false;
        if(n.nodeType===Node.TEXT_NODE)return (n.textContent||'').length>0;
        if(n.nodeType!==Node.ELEMENT_NODE)return false;
        if(n.matches('.fn-marker,.tooltip,.gterm .gtip,[hidden],script,style'))return false;
        if(n.closest('.fn-marker,.tooltip,.gtip,.btip'))return false;
        return true;
      });
      for(let i=1;i<nodes.length;i++){
        const x=nodes[i-1],y=nodes[i],before=getTrimText(x),after=getTrimText(y);
        if(!before||!after)continue;
        const last=before.slice(-1),first=after.charAt(0);
        if(/\s/.test(last)||/\s/.test(first))continue;
        if(!/[A-Za-zА-Яа-яЁё0-9:]/u.test(last)||!/[A-Za-zА-Яа-яЁё0-9]/u.test(first))continue;
        if(/[\u00a0\u202f]/.test(last))continue;
        if(/[).,!?\-–—]/u.test(last))continue;
        if(x.nodeType===Node.ELEMENT_NODE&&x.matches('.fn-marker'))continue;
        if(y.nodeType===Node.ELEMENT_NODE&&y.matches('.fn-marker'))continue;
        const ctx=p.textContent?.replace(/\s+/g,' ').slice(0,135);
        suspect.push({before:before.slice(-32),after:after.slice(0,32),tags:[tag(x),tag(y)],ctx});
      }
    }
    const checkNotices=notice.map(p=>({sample:p.textContent?.slice(0,160),strong:p.querySelector('strong')?.textContent,
       next:p.querySelector('strong')?.nextSibling?.textContent||null}));
    const anchors=[...main.querySelectorAll('a[href]')];
    const strangeHref=anchors.filter(a=>!a.getAttribute('href')||/^javascript:/i.test(a.getAttribute('href'))).map(a=>a.outerHTML.slice(0,150));
    return {pdfText:txt,pdfHtml:pdf?.innerHTML||'',pdfStrong:strong?.textContent,pdfAnchor:a?.textContent,pdfBeforeLink:strong?.nextSibling?.textContent,
      noticeCount:notice.length,noticeSamples:checkNotices,paragraphs:rows.length,links:anchors.length,strangeHref,
      suspects:suspect.slice(0,100),suspectCount:suspect.length,htmlOverflow:document.documentElement.scrollWidth-innerWidth,
      mainOverflow:main.getBoundingClientRect().right-innerWidth,
      headings:[...main.querySelectorAll('h1,h2,h3')].length};
   });
   Object.assign(entry,result);
   entry.errors=errors;
   entry.pass=result.pdfText.includes('(PDF):\u00a0открыть PDF')&&result.suspectCount===0&&result.htmlOverflow<=2&&result.strangeHref.length===0&&errors.length===0;
   if(['desktop-1440','mobile-390'].includes(size.id)){
    await page.locator('.notice').scrollIntoViewIfNeeded();
    await page.locator('.notice').screenshot({path:path.join(dir,engine+'-'+size.id+'-notice.png')});
    const darkButton=page.locator('#gbFcTheme');
    if(size.w>=1200 && await darkButton.isVisible()){
      await darkButton.click({timeout:3000});
      await page.locator('.notice').screenshot({path:path.join(dir,engine+'-'+size.id+'-notice-theme-toggle.png')});
    } else if(size.w<1200) {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.locator('.notice').screenshot({path:path.join(dir,engine+'-'+size.id+'-notice-dark.png')});
    }
   }
  }catch(e){entry.pass=false;entry.error=String(e);}
  report.push(entry);await page.close();
 }
 await browser.close();
}
await new Promise(resolve=>server.close(resolve));
fs.writeFileSync(path.join(dir,'browser-typography-results.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({total:report.length,passed:report.filter(x=>x.pass).length,
 failed:report.filter(x=>!x.pass).map(x=>({engine:x.engine,viewport:x.viewport,error:x.error,PDF:x.pdfText?.slice(0,90),suspects:x.suspects?.slice(0,20),suspectCount:x.suspectCount,htmlOverflow:x.htmlOverflow,errors:x.errors})),
 sample:report[0]&&{pdfText:report[0].pdfText,paragraphs:report[0].paragraphs,links:report[0].links,suspects:report[0].suspects?.slice(0,40),notes:report[0].noticeSamples}},null,2));
if(report.some(x=>!x.pass))process.exitCode=1;
