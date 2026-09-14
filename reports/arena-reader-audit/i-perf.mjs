import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
const ROOT='dist';
const pages=JSON.parse(fs.readFileSync('reports/arena-reader-audit/f-matrix.json','utf8')).map(r=>r.url);
const reps=['/articles/dzhon-gill-chast-1-chelovek/','/articles/serdce-i-duh/','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/','/hard-texts/','/articles/','/baptisty-rossii/','/nagornaya/chast-1/','/','/izbrannoe/','/hard-texts/genesis-6/','/pastor-series/','/journal/'];
console.log('URL'.padEnd(62),'HTMLkb','CSSkb','#css','#js','JSkb','gblr','blend','bdfilt','willch','fixed','prefsHead','prefs');
for(const url of reps){
  const f=path.join(ROOT,url.replace(/^\//,''),'index.html');
  if(!fs.existsSync(f)){console.log(url,'MISSING');continue;}
  const html=fs.readFileSync(f,'utf8');
  const {document}=parseHTML(html);
  const links=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(t=>/stylesheet/.test(t)).map(t=>(t.match(/href="([^"]+)"/)||[])[1]).filter(Boolean);
  const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
  let cssBytes=0, jsBytes=0;
  const baseDir=path.posix.dirname(url+'x');
  const all=[];
  for(const h of [...links,...scripts]){
    const clean=h.split('?')[0]; const p=clean.startsWith('/')?clean:path.posix.join(baseDir,clean);
    const local=path.join(ROOT,p); if(fs.existsSync(local)){ const b=fs.statSync(local).size; if(h===clean?false:false){} all.push({p,b,css:links.includes(h)}); }
  }
  for(const a of all){ if(links.includes(a.p)||a.p.endsWith('.css')) cssBytes+=a.b; else jsBytes+=a.b; }
  // inline css
  let inlineCss=0; for(const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) inlineCss+=m[1].length;
  const cssText=[...links.map(h=>{const clean=h.split('?')[0];const p=clean.startsWith('/')?clean:path.posix.join(baseDir,clean);const local=path.join(ROOT,p);return fs.existsSync(local)?fs.readFileSync(local,'utf8'):'';}), ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1])].join('\n');
  const count=(re)=>(cssText.match(re)||[]).length;
  const prefsHead=scripts.some(s=>s.includes('reader-preferences-head'));
  const prefs=scripts.some(s=>/reader-preferences\.js/.test(s));
  console.log(url.padEnd(62),
    String(Math.round(html.length/1024)).padEnd(6),
    String(Math.round((cssBytes+inlineCss)/1024)).padEnd(5),
    String(links.length).padEnd(4),
    String(scripts.length).padEnd(3),
    String(Math.round(jsBytes/1024)).padEnd(4),
    String(count(/gblr-/g)).padEnd(4),
    String(count(/mix-blend-mode/g)).padEnd(5),
    String(count(/backdrop-filter/g)).padEnd(6),
    String(count(/will-change/g)).padEnd(6),
    String(count(/position:\s*fixed/g)).padEnd(5),
    (prefsHead?'Y':'❌').padEnd(9),
    prefs?'Y':'❌');
}
