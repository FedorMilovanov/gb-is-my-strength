import postcss from 'postcss';
import fs from 'fs';
import { globSync } from 'fs';
const files = fs.readdirSync('dist/css').map(f=>'dist/css/'+f).concat(fs.readdirSync('dist/_astro').filter(f=>f.endsWith('.css')).map(f=>'dist/_astro/'+f));
const chain = r => { const p=[]; let x=r.parent; while(x && x.type!=='root'){ if(x.type==='atrule') p.unshift('@'+x.name+' '+(x.params||'')); x=x.parent;} return p.join(' && ')||'(top)'; };
for (const f of files){
  let root; try{ root=postcss.parse(fs.readFileSync(f,'utf8'),{from:f}); }catch(e){ continue; }
  root.walkRules(r=>{
    const sel=r.selector||'';
    if(!/gill-v16|gbs2-world/.test(sel)) return;
    if(!/\bmain\b|article-main|page-wrap/.test(sel)) return;
    const decls=r.nodes.filter(d=>d.type==='decl' && ['width','max-width','min-width','margin','margin-left','margin-right','padding','box-sizing','overflow','overflow-x'].includes(d.prop));
    if(!decls.length) return;
    console.log(`\n[${f}] [${chain(r)}]\n  ${sel.slice(0,140)}`);
    for(const d of decls) console.log(`    ${d.prop}: ${d.value}${d.important?' !important':''}`);
  });
}
