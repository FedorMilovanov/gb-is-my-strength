import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const root = process.argv[2];
const hist = fs.readFileSync('src/data/journal/g3HistoryDraftSources.ts','utf8');
const pub = fs.readFileSync('src/data/journal/g3SourceBibliography.ts','utf8');
const urls = (s)=> new Set([...s.matchAll(/https?:\/\/[^'"`\s)]+/g)].map(m=>m[0]));
const hu=urls(hist), pu=urls(pub);
const histOnly=[...hu].filter(u=>!pu.has(u));
const markers=['от конференции к служению','/journal/dossiers/g3/history','G3-HIST-PUB','История богословских разговоров','Источники истории','Кризисы руководства — отдельная история','Pray’s Mill','Pray\'s Mill','PUBLICATION_HOLD', ...histOnly];
const hits={}; let files=0;
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else scan(p);} }
function scan(p){ if(!/\.(html|xml|json|txt|js|pf_fragment|pf_meta|pf_index|webmanifest)$/.test(p)) return; let b=fs.readFileSync(p); if(/pf_(fragment|meta|index)$/.test(p)){ try{b=zlib.gunzipSync(b);}catch{} } const s=b.toString('utf8'); files++; for(const m of markers){ if(s.includes(m)) (hits[m]??=[]).push(path.relative(root,p)); } }
walk(root);
console.log(JSON.stringify({scannedFiles:files, histSourceUrls:hu.size, histOnlyUrls:histOnly.length, hits:Object.fromEntries(Object.entries(hits).map(([k,v])=>[k,v.slice(0,6).concat(v.length>6?[`…+${v.length-6}`]:[])]))},null,1));
