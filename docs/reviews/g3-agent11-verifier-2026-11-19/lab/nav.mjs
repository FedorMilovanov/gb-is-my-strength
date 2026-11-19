import fs from 'node:fs';
for (const f of process.argv.slice(2)) { const s=fs.readFileSync(f,'utf8'); const body=s.slice(s.indexOf('<body')); const end=body.search(/<main\b/); const head=body.slice(0,end>0?end:6000);
 const l=[...head.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m=>`${m[1]}=${m[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,28)}`);
 console.log(f, l.length, '\n  ', l.join(' | ')); }
