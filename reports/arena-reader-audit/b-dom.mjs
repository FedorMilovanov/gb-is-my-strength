import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const ROOT='dist';
const pages=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 if(e.isDirectory()){if(['_astro','pagefind','fonts','images'].includes(e.name))continue;walk(p);}
 else if(e.name.endsWith('.html'))pages.push(p);}})(ROOT);
pages.sort();

const out={dupIds:{},danglingAria:{},danglingAnchors:{},emptyLabels:{},nestedInteractive:{}};
for(const f of pages){
  const html=fs.readFileSync(f,'utf8');
  const {document}=parseHTML(html);
  const url='/'+path.relative(ROOT,f).replace(/index\.html$/,'');

  // duplicate ids
  const counts=new Map();
  for(const el of document.querySelectorAll('[id]')){const id=el.getAttribute('id');counts.set(id,(counts.get(id)||0)+1);}
  const dups=[...counts].filter(([,n])=>n>1);
  if(dups.length) out.dupIds[url]=dups.map(([id,n])=>({id,n, tags:[...document.querySelectorAll(`[id="${CSS_escape(id)}"]`)].map(e=>e.tagName.toLowerCase()+(e.getAttribute('class')?'.'+e.getAttribute('class').split(' ')[0]:'')).slice(0,4)}));

  const ids=new Set(counts.keys());
  const names=new Set([...document.querySelectorAll('[name]')].map(e=>e.getAttribute('name')));

  // dangling aria refs
  const dangling=[];
  for(const el of document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby],[aria-details],[aria-flowto],[aria-owns]')){
    for(const attr of ['aria-controls','aria-labelledby','aria-describedby','aria-details','aria-flowto','aria-owns']){
      const v=el.getAttribute(attr); if(!v) continue;
      for(const tok of v.split(/\s+/)){ if(tok && !ids.has(tok)) dangling.push({attr,tok,tag:el.tagName.toLowerCase(),id:el.getAttribute('id')||'',cls:(el.getAttribute('class')||'').slice(0,50),text:(el.textContent||'').trim().slice(0,30)}); }
    }
  }
  for(const el of document.querySelectorAll('label[for]')){const v=el.getAttribute('for'); if(v&&!ids.has(v)) dangling.push({attr:'label[for]',tok:v,tag:'label'});}
  if(dangling.length) out.danglingAria[url]=dangling;

  // dangling in-page anchors
  const bad=[];
  for(const a of document.querySelectorAll('a[href^="#"]')){
    const h=a.getAttribute('href'); if(h==='#'||h==='#!') continue;
    const t=decodeURIComponent(h.slice(1));
    if(!ids.has(t)&&!names.has(t)) bad.push({href:h, text:(a.textContent||'').trim().slice(0,40), cls:(a.getAttribute('class')||'').slice(0,60), parent:(a.parentElement?.getAttribute('class')||a.parentElement?.tagName||'').toString().slice(0,40)});
  }
  if(bad.length) out.danglingAnchors[url]=bad;

  // buttons/links with no accessible name
  const noName=[];
  for(const el of document.querySelectorAll('button,a[href]')){
    const txt=(el.textContent||'').replace(/\s+/g,' ').trim();
    const al=el.getAttribute('aria-label')||el.getAttribute('title')||'';
    const lab=el.getAttribute('aria-labelledby')&&ids.has(el.getAttribute('aria-labelledby'))?'x':'';
    if(!txt&&!al.trim()&&!lab) noName.push({tag:el.tagName.toLowerCase(),id:el.getAttribute('id')||'',cls:(el.getAttribute('class')||'').slice(0,60),html:el.toString().slice(0,90)});
  }
  if(noName.length) out.emptyLabels[url]=noName;

  // interactive inside interactive
  const nested=[];
  for(const a of document.querySelectorAll('a[href]')){ if(a.querySelector('a[href],button')) nested.push({outer:(a.getAttribute('class')||a.id||a.tagName).toString().slice(0,50), inner:[...a.querySelectorAll('a[href],button')].map(e=>e.tagName.toLowerCase()+'#'+(e.id||'')+'.'+(e.getAttribute('class')||'').split(' ')[0]).slice(0,3)}); }
  for(const b of document.querySelectorAll('button')){ if(b.querySelector('a[href],button')) nested.push({outer:'button#'+(b.id||'')+'.'+(b.getAttribute('class')||''), inner:[...b.querySelectorAll('a[href],button')].map(e=>e.tagName.toLowerCase()).slice(0,3)}); }
  if(nested.length) out.nestedInteractive[url]=nested;
}
function CSS_escape(s){return s.replace(/["\\]/g,'\\$&');}
fs.writeFileSync('reports/arena-reader-audit/b-dom.json',JSON.stringify(out,null,2));
for(const [k,v] of Object.entries(out)){
  const pages=Object.keys(v); const total=pages.reduce((n,u)=>n+v[u].length,0);
  console.log(`\n===== ${k}: ${total} проблем(ы) на ${pages.length} страницах =====`);
  for(const u of pages.slice(0,14)) console.log(' ',u, JSON.stringify(v[u]).slice(0,400));
  if(pages.length>14) console.log('  ...ещё',pages.length-14,'страниц');
}
