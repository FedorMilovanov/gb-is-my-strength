const fs=require('fs'),path=require('path'),postcss=require('postcss'),glob=require('child_process');
const files=[...require('child_process').execSync('ls dist/css/*.css dist/_astro/*.css').toString().trim().split('\n')];
const hidden=new Map();
for(const f of files){
  const root=postcss.parse(fs.readFileSync(f,'utf8'),{from:f});
  root.walkAtRules('media',at=>{ if(!/print/.test(at.params))return;
    at.walkRules(r=>{
      let dn=false; r.walkDecls('display',d=>{ if(d.value.replace(/\s/g,'')==='none') dn=true; });
      if(dn) r.selector.split(',').forEach(s=>{ const k=s.trim(); if(!hidden.has(k)) hidden.set(k,new Set()); hidden.get(k).add(path.basename(f)); });
    });
  });
}
console.log('=== ВСЕ селекторы с display:none в @media print ('+hidden.size+') ===');
console.log([...hidden.keys()].sort().join('\n'));
console.log('\n=== ПРОВЕРКА ОБВЯЗКИ ЧИТАЛКИ ===');
const all=[...hidden.keys()].join(' , ');
const need=['.mobile-bottom-bar','.mobile-top-bar','.mobile-chrome','.toc-overlay','.gill-settings-sheet','.gill-learning-sheet','.gill-settings-overlay','.gill-learning-overlay','.gbs-theme-corner','.gbs-rail','.hrail','.hmbar','.gb-floater','.cp-backdrop','.gb-ember-expand','.gbs2-bbar','.gbs2-sheet','.mcp-top','.hmsheet','.hmsettings','#hMobileNav','.h-mobile-nav','.mobile-speedrail','.toc-sheet','.gb-mobile-fallback-controls','.skip-link','.gbs2-mobile-head','.mobile-btoc-section','.gbs-rail-foot','.gb-icon','.gb-ember','.gblr-','.gbs2-world','.nmt','#nmToc','.nag-bar','.toc-sidebar','.bottom-bar'];
for(const t of need){
  const hit=[...hidden.keys()].filter(k=>k.includes(t.replace(/^\./,'.')));
  console.log(`  ${t.padEnd(32)} ${hit.length?'HIDDEN ('+hit.slice(0,2).join(' | ')+')':'❌ НЕ СКРЫТ'}`);
}
