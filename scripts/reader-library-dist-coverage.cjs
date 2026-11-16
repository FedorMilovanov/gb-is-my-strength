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
const crypto = require('crypto');
const presenterPath = path.join(root, 'js/reader-library-presenter.js');
const researchPath = path.join(root, 'js/reader-library-v3.js');
const dockPath = path.join(root, 'js/reader-library-dock.js');
const highlightsPath = path.join(root, 'js/highlights.js');
const swPath = path.join(root, 'sw.js');
assert(fs.existsSync(presenterPath), 'lazy presenter must be published in dist');
assert(fs.existsSync(highlightsPath), 'highlight storage bootstrap must be published');
assert(fs.existsSync(swPath), 'service worker must be published');
const version = crypto.createHash('md5').update(fs.readFileSync(presenterPath)).digest('hex').slice(0,8);
assert(fs.readFileSync(highlightsPath, 'utf8').includes('reader-library-presenter.js?v=' + version),
  'lazy importer must reference exact published presenter bytes');
assert(fs.readFileSync(swPath, 'utf8').includes('reader-library-presenter.js?v=' + version),
  'offline service worker must precache exact presenter revision');
assert(fs.existsSync(researchPath), 'lazy research companion must be in published dist');
const researchVersion = crypto.createHash('md5').update(fs.readFileSync(researchPath)).digest('hex').slice(0,8);
assert(fs.readFileSync(highlightsPath, 'utf8').includes('reader-library-v3.js?v=' + researchVersion),
  'library owner must import exact research companion bytes');
assert(fs.readFileSync(swPath, 'utf8').includes('reader-library-v3.js?v=' + researchVersion),
  'offline service worker must precache research companion revision');
assert(fs.existsSync(dockPath), 'lightweight docking module must be in dist');
const dockVersion = crypto.createHash('md5').update(fs.readFileSync(dockPath)).digest('hex').slice(0,8);
assert(fs.readFileSync(highlightsPath,'utf8').includes('reader-library-dock.js?v=' + dockVersion),
  'bootstrap must import correct dock revision');
assert(fs.readFileSync(swPath,'utf8').includes('reader-library-dock.js?v=' + dockVersion),
  'SW must precache dock revision');
console.log('lazy presenter + research + dock exact versions and offline precache PASS');
console.log('allPages',pages.length,'reader article coverage PASS');
