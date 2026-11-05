'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../dist');
function allHtml(base){let files=[];for(const e of fs.readdirSync(base,{withFileTypes:true})){if(e.isDirectory())files.push(...allHtml(path.join(base,e.name)));else if(e.name==='index.html')files.push(path.join(base,e.name));}return files;}
const pages=allHtml(root);
const family={articles:[],hardTexts:[],baptists:[],nagornaya:[],other:[]};
for(const full of pages){const rel=path.relative(root,full).replace(/\\/g,'/');
const html=fs.readFileSync(full,'utf8');
const highlight=/js\/highlights\.js(?:\?v=|["'])/.test(html);
const row={path:rel,highlight,hasMobile:/class="[^"]*(?:hmbar|mobile-bottom-bar|bottom-bar-inner)/.test(html),hasArticle:/<article[\s>]/.test(html)};
const group=rel.startsWith('articles/')?'articles':rel.startsWith('hard-texts/')?'hardTexts':rel.startsWith('baptisty-rossii/')?'baptists':rel.startsWith('nagornaya/')?'nagornaya':'other';
family[group].push(row);}
for(const [name,rows] of Object.entries(family)){const relevant=rows.filter(x=>x.hasArticle||x.hasMobile);console.log(name, 'total',rows.length,'readerLike',relevant.length,'withLibrary',relevant.filter(x=>x.highlight).length);
const missing=relevant.filter(x=>!x.highlight);for(const r of missing.slice(0,35))console.log('  MISSING',r.path,'hasArticle',r.hasArticle,'mobile',r.hasMobile);}
for(const name of ['articles','hardTexts']){
  const missing=family[name].filter((x)=>(x.hasArticle||x.hasMobile)&&!x.highlight);
  assert.equal(missing.length,0,'Reader Library missing from published '+name+' routes: '+missing.map(x=>x.path).join(', '));
}
console.log('allPages',pages.length,'reader article coverage PASS');
