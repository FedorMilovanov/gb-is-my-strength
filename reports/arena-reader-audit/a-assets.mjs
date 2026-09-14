import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const ROOT = 'dist';
const pages = [];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 if(e.isDirectory()){if(['_astro','pagefind','fonts','images'].includes(e.name))continue;walk(p);}
 else if(e.name.endsWith('.html'))pages.push(p);}})(ROOT);
pages.sort();

const problems = [];
for (const f of pages) {
  const html = fs.readFileSync(f,'utf8');
  const { document } = parseHTML(html);
  const url = '/' + path.relative(ROOT,f).replace(/index\.html$/,'');
  const baseDir = path.posix.dirname(url.endsWith('/') ? url.slice(0,-1) + '/x' : url);
  const els = document.querySelectorAll('[src],[href]');
  for (const el of els) {
    for (const attr of ['src','href']) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(v)) continue;
      const clean = v.split('?')[0].split('#')[0];
      if (!clean) continue;
      let resolved = clean.startsWith('/') ? clean : path.posix.join(baseDir, clean);
      if (resolved.endsWith('/')) resolved += 'index.html';
      const local = path.join(ROOT, resolved);
      const ok = fs.existsSync(local) || fs.existsSync(local + '/index.html') || fs.existsSync(local + '.html');
      if (!ok) problems.push({url, attr, v, resolved, tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class')||'').slice(0,60)});
    }
  }
}
const byPage = {};
for (const p of problems) (byPage[p.url] ??= []).push(p);
console.log('BROKEN LOCAL REFS:', problems.length, 'on', Object.keys(byPage).length, 'pages');
for (const [u, list] of Object.entries(byPage)) {
  console.log('\n' + u);
  const seen = new Set();
  for (const p of list) { const k = p.v; if (seen.has(k)) continue; seen.add(k);
    console.log(`   <${p.tag} ${p.attr}="${p.v}"> -> ${p.resolved}  [class="${p.cls}"]`); }
}
fs.writeFileSync('reports/arena-reader-audit/a-assets.json', JSON.stringify(problems,null,2));
