import postcss from 'postcss'; import fs from 'fs';
const files = fs.readdirSync('dist/css').map(f=>'dist/css/'+f).concat(fs.readdirSync('dist/_astro').filter(f=>f.endsWith('.css')).map(f=>'dist/_astro/'+f));
const chain = r => { const p=[]; let x=r.parent; while(x && x.type!=='root'){ if(x.type==='atrule') p.unshift('@'+x.name+' '+(x.params||'')); x=x.parent;} return p.join(' && ')||'(top)'; };
// crude: does selector plausibly match <main class="article-main" id="main-content"> inside div.page-wrap inside div.gbs2-world[data-gill-v16]?
const re = /(^|[\s,>+~(])main(\.article-main)?(?![\w-])/;
for (const f of files){
  let root; try{ root=postcss.parse(fs.readFileSync(f,'utf8'),{from:f}); }catch(e){ continue; }
  root.walkRules(r=>{
    const sel=r.selector||'';
    const decls=r.nodes.filter(d=>d.type==='decl' && ['width','max-width','min-width','margin','margin-left','margin-right','padding','padding-left','padding-right','box-sizing'].includes(d.prop));
    if(!decls.length) return;
    // match selectors containing main or .article-main
    if(!/\bmain\b|article-main/.test(sel)) return;
    if(/gill-v16|gbs2-world|reader-root|hrail/.test(sel)===false && !/^(\s*)?main(\.article-main)?\s*[,{]?$/.test(sel) && !/(^|,)\s*\.article-main\s*(,|$)/.test(sel)) { /* still print, filtered below */ }
    console.log(`[${f.replace('dist/','')}] [${chain(r)}] ${sel.slice(0,160).replace(/\n/g,' ')}`);
    for(const d of decls) console.log(`      ${d.prop}: ${d.value}${d.important?' !imp':''}`);
  });
}
