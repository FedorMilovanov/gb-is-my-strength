const fs=require('fs'), path=require('path'), postcss=require('postcss');
const ROOT='dist';
const page=process.argv[2]; const re=new RegExp(process.argv[3]);
const props=/^(display|visibility|opacity|position|z-index|pointer-events|transform|width|min-width|max-width|height|min-height|min-inline-size|max-height|bottom|top|left|right|inset|overflow|grid-template-columns|flex)$/;
const f=path.join(ROOT,page.replace(/^\//,''),'index.html');
const html=fs.readFileSync(f,'utf8');
const acc=[];
function condChain(rule){const parts=[];let p=rule.parent;while(p&&p.type!=='root'){if(p.type==='atrule')parts.unshift('@'+p.name+' '+(p.params||''));p=p.parent;}return parts.join(' && ')||'(none)';}
function collect(css,label){
  let root;try{root=postcss.parse(css,{from:label});}catch(e){return;}
  root.walkRules(r=>{
    if(!re.test(r.selector))return;
    const d=[];r.walkDecls(x=>{if(props.test(x.prop))d.push(`${x.prop}:${x.value.replace(/\s+/g,' ')}${x.important?' !imp':''}`);});
    acc.push({label,cond:condChain(r),sel:r.selector.replace(/\s+/g,' ').slice(0,150),decls:d.join('; ').slice(0,260)});
  });
}
for(const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) collect(m[1],'inline');
const links=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(t=>/stylesheet/.test(t)).map(t=>(t.match(/href="([^"]+)"/)||[])[1]).filter(Boolean);
for(const href of links){const clean=href.split('?')[0];const p=clean.startsWith('/')?clean:path.posix.join(path.posix.dirname(page+'x'),clean);const local=path.join(ROOT,p);if(fs.existsSync(local))collect(fs.readFileSync(local,'utf8'),path.basename(clean));}
console.log(`### ${page} :: /${process.argv[3]}/ → ${acc.length} правил`);
for(const r of acc) console.log(`  [${r.cond}] ${r.sel}\n        ${r.decls}   <${r.label}>`);
