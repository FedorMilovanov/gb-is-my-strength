const postcss=require('postcss'),fs=require('fs');
const f=process.argv[2]; const targets=process.argv.slice(3).map(Number);
const root=postcss.parse(fs.readFileSync(f,'utf8'),{from:f});
const hits=[];
root.walkRules(r=>{
  const line=r.source&&r.source.start?r.source.start.line:0;
  for(const t of targets){ if(Math.abs(line-t)<=6){ const p=[]; let x=r.parent; while(x&&x.type!=='root'){ if(x.type==='atrule') p.unshift('@'+x.name+' '+(x.params||'')); x=x.parent;} hits.push(`L${line}  [${p.join(' && ')||'(top-level)'}]  ${r.selector.replace(/\s+/g,' ').slice(0,120)}`);} }
});
root.walkDecls(d=>{
  const line=d.source&&d.source.start?d.source.start.line:0;
  for(const t of targets){ if(Math.abs(line-t)<=4){ const p=[]; let x=d.parent; while(x&&x.type!=='root'){ if(x.type==='atrule') p.unshift('@'+x.name+' '+(x.params||'')); x=x.parent;} hits.push(`L${line} DECL [${p.join(' && ')||'(top-level)'}] ${d.prop}:${d.value.slice(0,80).replace(/\s+/g,' ')}`);} }
});
console.log([...new Set(hits)].sort().join('\n'));
