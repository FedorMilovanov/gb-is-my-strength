import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const ROOT='dist';
const pages=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 if(e.isDirectory()){if(['_astro','pagefind','fonts','images'].includes(e.name))continue;walk(p);}
 else if(e.name.endsWith('.html'))pages.push(p);}})(ROOT);
pages.sort();

const jsCache=new Map();
function jsFor(f,url,document){
  const key=f; if(jsCache.has(key)) return jsCache.get(key);
  let text='';
  const baseDir=path.posix.dirname(url.endsWith('/')?url+'x':url);
  for(const s of document.querySelectorAll('script')){
    const src=s.getAttribute('src');
    if(src){ let p=src.split('?')[0]; if(/^https?:/.test(p)) continue;
      p=p.startsWith('/')?p:path.posix.join(baseDir,p);
      const local=path.join(ROOT,p);
      if(fs.existsSync(local)) text+=fs.readFileSync(local,'utf8')+'\n';
      else text+=`\n/*MISSING ${p}*/\n`;
    } else text+=(s.textContent||'')+'\n';
  }
  jsCache.set(key,text); return text;
}

const report={};
for(const f of pages){
  const html=fs.readFileSync(f,'utf8');
  const {document}=parseHTML(html);
  const url='/'+path.relative(ROOT,f).replace(/index\.html$/,'');
  const js=jsFor(f,url,document);
  let cssText=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n');
  {
    const baseDir2=path.posix.dirname(url.endsWith('/')?url+'x':url);
    for(const l of document.querySelectorAll('link[rel="stylesheet"]')){
      const href=(l.getAttribute('href')||'').split('?')[0]; if(!href||/^https?:/.test(href))continue;
      const p2=href.startsWith('/')?href:path.posix.join(baseDir2,href);
      const local=path.join(ROOT,p2); if(fs.existsSync(local)) cssText+='\n'+fs.readFileSync(local,'utf8');
    }
  }
  const dead=[];
  for(const b of document.querySelectorAll('button,[role="button"],[data-fc-action],[data-action]')){
    const hooks=new Set();
    if(b.id) hooks.add(b.id);
    for(const a of b.attributes){
      if(a.name.startsWith('data-')) { hooks.add(a.name); if(a.value) hooks.add(a.value); }
    }
    for(const c of (b.getAttribute('class')||'').split(/\s+/)) if(c) hooks.add(c);
    // ignore purely presentational
    const relevant=[...hooks].filter(h=>!h.startsWith('data-astro')&&h!=='reveal');
    if(!relevant.length) continue;
    const hit=relevant.some(h=>js.includes(h));
    if(!hit){
      const cssHit=relevant.some(h=>cssText.includes(h));
      dead.push({tag:b.tagName.toLowerCase(), hooks:relevant.slice(0,6), text:(b.textContent||'').trim().slice(0,25), aria:b.getAttribute('aria-label')||'', styled:cssHit, html:b.toString().slice(0,140)});
    }
  }
  if(dead.length) report[url]=dead;
}
fs.writeFileSync('reports/arena-reader-audit/c-controls.json',JSON.stringify(report,null,2));
const pagesHit=Object.keys(report); const total=pagesHit.reduce((n,u)=>n+report[u].length,0);
console.log(`DEAD CONTROLS (no JS hook reference): ${total} on ${pagesHit.length} pages\n`);
// aggregate by hook signature to dedupe across pages
const sig=new Map();
for(const [u,list] of Object.entries(report)) for(const d of list){
  const k=(d.hooks.filter(h=>!h.startsWith('data-astro')).slice(0,3).join('|'))+' :: '+(d.aria||d.text);
  if(!sig.has(k)) sig.set(k,{pages:[],sample:d});
  sig.get(k).pages.push(u);
}
for(const [k,v] of sig){
  console.log(`\n### ${k}\n    pages(${v.pages.length}): ${v.pages.slice(0,4).join(', ')}${v.pages.length>4?' …':''}`);
  console.log(`    html: ${v.sample.html}`);
  console.log(`    styled-in-css: ${v.sample.styled}`);
}
