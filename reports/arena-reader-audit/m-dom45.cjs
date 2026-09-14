const fs=require('fs'),path=require('path');
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.html'))files.push(p);}})('dist');
const rows=[];
for(const f of files){
  const h=fs.readFileSync(f,'utf8');
  if(!/data-gill-v16/.test(h) && !/data-reader-root/.test(h)) continue;
  const url='/'+path.relative('dist',f).replace(/index\.html$/,'').replace(/\.html$/,'');
  rows.push({url,
    gill:/data-gill-v16/.test(h), hrail:/data-reader-root/.test(h),
    articleBody:/<article[^>]*class="[^"]*article-body/.test(h),
    mainClass:(h.match(/<main[^>]*class="([^"]*)"/)||[,''])[1],
    rail:/class="[^"]*\bgbs-rail\b/.test(h),
    railToc:/gbs2-tocscroll|gbs2-rmid/.test(h),
    bottomBar:/mobile-bottom-bar/.test(h), topBar:/mobile-top-bar/.test(h),
    tocOverlay:/toc-overlay/.test(h), settingsOverlay:/gill-settings-overlay/.test(h),
    readerSettings:/data-reader-settings|reader-settings-trigger/.test(h),
    floater:/gb-floater/.test(h),
  });
}
console.log('total reader pages:',rows.length);
const noBody=rows.filter(r=>!r.articleBody);
console.log('without article.article-body:',noBody.length);
const groups={};
for(const r of noBody){ const k=[r.gill?'gill':'-',r.hrail?'hrail':'-',r.rail?'rail':'norail',r.bottomBar?'botbar':'-',r.settingsOverlay?'settingsOvl':'-',r.tocOverlay?'tocOvl':'-',r.readerSettings?'readerSettings':'-'].join('|'); (groups[k]=groups[k]||[]).push(r.url);}
for(const k of Object.keys(groups).sort()) console.log('\n'+k+'  ('+groups[k].length+')\n   '+groups[k].slice(0,6).join('\n   ')+(groups[k].length>6?'\n   ...':''));
console.log('\n=== pages WITH article-body ===');
for(const r of rows.filter(r=>r.articleBody)) console.log(' ',r.url,'| gill:'+r.gill,'hrail:'+r.hrail,'rail:'+r.rail,'botbar:'+r.bottomBar,'settingsOvl:'+r.settingsOverlay,'mainClass:"'+r.mainClass+'"');
fs.writeFileSync('reports/arena-reader-audit/m-dom45.json',JSON.stringify(rows,null,1));
