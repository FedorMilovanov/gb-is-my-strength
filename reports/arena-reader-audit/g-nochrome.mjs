import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
const ROOT='dist';
const rows=JSON.parse(fs.readFileSync('reports/arena-reader-audit/f-matrix.json','utf8'));
const noChrome=rows.filter(r=>r.surfaces.length===0||r.surfaces.join()==='astro-header');
console.log('URL'.padEnd(58),'nav  header  homeLink  fixedBars  bodyClass');
for(const r of noChrome){
  const f=path.join(ROOT,r.url.replace(/^\//,''),'index.html');
  const file=fs.existsSync(f)?f:path.join(ROOT,r.url.replace(/^\//,'')+'.html');
  if(!fs.existsSync(file)){console.log(r.url,'FILE?');continue;}
  const html=fs.readFileSync(file,'utf8');
  const {document}=parseHTML(html);
  const navs=document.querySelectorAll('nav').length;
  const heads=document.querySelectorAll('header').length;
  const home=[...document.querySelectorAll('a[href]')].filter(a=>['/','../../','../','./'].includes(a.getAttribute('href'))).length;
  const bodyCls=(document.querySelector('body')?.getAttribute('class')||'').slice(0,40);
  // fixed elements count
  const fixed=/position:\s*fixed/.test(html)?'yes':'-';
  console.log(r.url.padEnd(58), String(navs).padEnd(4), String(heads).padEnd(7), String(home).padEnd(9), fixed.padEnd(10), bodyCls);
}
