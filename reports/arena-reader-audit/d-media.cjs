const fs=require('fs'), path=require('path'), postcss=require('postcss');
const ROOT='dist';
const pages=process.argv.slice(2);
const TOKENS=['.hrail','.gbs-rail','.gbs2-rail','.mobile-top-bar','.mobile-bottom-bar','.mcp-top','.gb-cluster','.gbs2-bbar','.gbs2-sheet','#hNavbar','.hmbar','.toc-sheet','#seriesTocOverlay','#partTocOverlay','.hmsheet','.hmsettings','.mobile-speedrail','.gb-mobile-fallback-controls','.gbs2-mobile-head','.gb-ember','.nmt','#hMobileNav','.gbs2-rail-scalable','.hrail-bottom','.mobile-btoc'];
const PROPS=/^(display|visibility|opacity|position|z-index|pointer-events|transform|width|min-width|max-width|height|min-height|bottom|top)$/;

function condChain(rule){
  const parts=[]; let p=rule.parent;
  while(p && p.type!=='root'){ if(p.type==='atrule') parts.unshift('@'+p.name+' '+ (p.params||'')); p=p.parent; }
  return parts.join(' && ')||'(unconditional)';
}
function collect(css,label,acc){
  let root; try{ root=postcss.parse(css,{from:label}); }catch(e){ console.log('  ! parse error',label,String(e.message).slice(0,80)); return; }
  root.walkRules(r=>{
    const sel=r.selector;
    if(!TOKENS.some(t=>sel.includes(t))) return;
    const decls=[];
    r.walkDecls(d=>{ if(PROPS.test(d.prop)) decls.push(`${d.prop}:${d.value.replace(/\s+/g,' ')}${d.important?' !imp':''}`); });
    if(!decls.length) return;
    acc.push({label, cond:condChain(r), sel:sel.replace(/\s+/g,' ').slice(0,140), decls:decls.join('; ').slice(0,240)});
  });
}
for(const page of pages){
  const f=path.join(ROOT,page.replace(/^\//,''),'index.html');
  if(!fs.existsSync(f)){console.log('MISSING',f);continue;}
  const html=fs.readFileSync(f,'utf8');
  const acc=[];
  for(const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) collect(m[1],'inline',acc);
  for(const l of html.matchAll(/<link[^>]+href="([^"]+)"[^>]*>|<link[^>]+rel="stylesheet"[^>]*>/g)){}
  const links=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(t=>/stylesheet/.test(t)).map(t=>(t.match(/href="([^"]+)"/)||[])[1]).filter(Boolean);
  for(const href of links){
    const clean=href.split('?')[0]; const p=clean.startsWith('/')?clean:path.posix.join(path.posix.dirname(page+'x'),clean);
    const local=path.join(ROOT,p);
    if(fs.existsSync(local)) collect(fs.readFileSync(local,'utf8'),path.basename(clean),acc);
  }
  console.log(`\n############ ${page} — ${acc.length} правил ############`);
  const grouped=new Map();
  for(const r of acc){ const k=r.sel.split(',')[0].trim(); if(!grouped.has(k))grouped.set(k,[]); grouped.get(k).push(r); }
  for(const [sel,list] of grouped){
    console.log(`\n  ▸ ${sel}`);
    for(const r of list) console.log(`      [${r.cond}]  ${r.decls}   <${r.label}>`);
  }
}
