const postcss=require('postcss'),fs=require('fs');
const files=fs.readdirSync('dist/css').map(f=>'dist/css/'+f).concat(fs.readdirSync('dist/_astro').filter(f=>f.endsWith('.css')).map(f=>'dist/_astro/'+f));
const chain=r=>{const p=[];let x=r.parent;while(x&&x.type!=='root'){if(x.type==='atrule')p.unshift('@'+x.name+' '+(x.params||''));x=x.parent;}return p.join(' && ')||'(top)';};
const bar=/mobile-bottom-bar|mobile-top-bar|gbs2-bar|hmbar|hmtop|btoc-|toc-sheet|toc-overlay|gill-settings|gbs-rail-btn|bar-btn|mbtn/;
const out=[];
for(const f of files){let root;try{root=postcss.parse(fs.readFileSync(f,'utf8'),{from:f});}catch(e){continue;}
 root.walkRules(r=>{const sel=(r.selector||'').replace(/\s+/g,' ');
  if(!bar.test(sel))return;
  const d=r.nodes.filter(x=>x.type==='decl'&&['height','width','min-height','min-width','padding','font-size','gap'].includes(x.prop));
  if(!d.length)return;
  const sizes=d.filter(x=>/^(height|min-height|width|min-width)$/.test(x.prop)).map(x=>`${x.prop}:${x.value}${x.important?'!':''}`);
  if(!sizes.length)return;
  out.push(`[${f.replace('dist/','')}] [${chain(r)}] ${sel.slice(0,110)}\n      ${sizes.join('  ')}`);});}
console.log(out.join('\n'));
