import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
const ROOT='dist';
const pages=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 if(e.isDirectory()){if(['_astro','pagefind','fonts','images'].includes(e.name))continue;walk(p);}
 else if(e.name.endsWith('.html'))pages.push(p);}})(ROOT);
pages.sort();

const CHROME = '[data-mobile-chrome], .gbs-rail, .gbs-theme-corner, .mobile-top-bar, .mobile-bottom-bar, .hrail, .hmbar, .gb-floater, .gbs2-bbar, .gbs2-mobile-head, .gbs2-rail, .nmt-bar, .nmt-toc, .gb-cluster, .toc-overlay, .hmsheet, .gill-settings-sheet, .mobile-chrome, #hNavbar, .h-navbar, .h-mobile-nav, .gb-mobile-fallback-controls';

function label(el){
  return (el.getAttribute('aria-label')||el.getAttribute('title')||el.getAttribute('data-tip')||
    (el.textContent||'').replace(/\s+/g,' ').trim().slice(0,28)||'').trim();
}
const rows=[];
for(const f of pages){
  const html=fs.readFileSync(f,'utf8');
  const {document}=parseHTML(html);
  const url='/'+path.relative(ROOT,f).replace(/index\.html$/,'');
  const ctrls=new Set();
  const surfaces=new Set();
  for(const c of document.querySelectorAll(CHROME)){
    const cls=(c.getAttribute('class')||'')+ (c.id?'#'+c.id:'');
    surfaces.add(cls.split(' ')[0]||c.tagName.toLowerCase());
    for(const b of c.querySelectorAll('button,a[href],[role="button"],[role="radio"]')){
      const l=label(b);
      const act=b.getAttribute('data-fc-action')||b.getAttribute('data-action')||'';
      const key = l ? l : act;
      if(key) ctrls.add(key+(act&&l?` [${act}]`:''));
    }
    // also count attribute-only hooks on the surface itself
  }
  // TTS / settings / toc markers
  const marks=[];
  if(/data-gill-settings-open|hmSettings|id="mobSettingsBtn"|hrailSettingsBtn|gillSettingsOverlay/.test(html)) marks.push('SETTINGS');
  if(/gb-ember/.test(html)) marks.push('TTS');
  if(/data-fc-action="save"|gb-save/.test(html)) marks.push('SAVE');
  if(/seriesTocOverlay/.test(html)) marks.push('SERIES-TOC');
  if(/partTocOverlay/.test(html)) marks.push('PART-TOC');
  if(/gillLearningOverlay/.test(html)) marks.push('LEARNING');
  if(/data-speed=/.test(html)) marks.push('SPEED');
  if(/data-hm-measure|hmMeasureGroup/.test(html)) marks.push('MEASURE');
  if(/data-hm-line|hmLineGroup/.test(html)) marks.push('LINE');
  if(/data-hm-theme|hmThemeGroup/.test(html)) marks.push('THEME3');
  if(/gill-theme|data-gill-theme-btn/.test(html)) marks.push('THEME-GILL');
  if(/data-action="print"/.test(html)) marks.push('PRINT');
  if(/data-action="share"/.test(html)) marks.push('SHARE');
  if(/id="hMobileNav"/.test(html)) marks.push('SITEMENU');
  if(/hrailToc/.test(html)) marks.push('RAIL-TOC');
  if(/gbs2Toc/.test(html)) marks.push('GILL-RAIL-TOC');
  rows.push({url, surfaces:[...surfaces], marks, controls:[...ctrls]});
}
fs.writeFileSync('reports/arena-reader-audit/f-matrix.json',JSON.stringify(rows,null,2));
// group by surface+marks signature
const groups=new Map();
for(const r of rows){ const k=r.surfaces.slice().sort().join('+')+' || '+r.marks.slice().sort().join(',');
  if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r.url); }
const sorted=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);
console.log('=== СЕМЕЙСТВА ОБВЯЗКИ (surface-набор + возможности) ===\n');
for(const [k,list] of sorted){
  const [surf,marks]=k.split(' || ');
  console.log(`\n■ ${list.length} стр. — SURFACES: ${surf||'(нет chrome)'}`);
  console.log(`   CAPS: ${marks||'(нет)'}`);
  console.log(`   ROUTES: ${list.slice(0,8).join(', ')}${list.length>8?` …(+${list.length-8})`:''}`);
}
