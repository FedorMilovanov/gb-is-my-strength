#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://gospod-bog.ru';
const ROUTES = [
  ['noch-na-kure', 'BaptistyRossiiNochNaKureBody', 'BaptistyRossiiNochNaKurePageHead'],
  ['yuzhnaya-shtunda', 'BaptistyRossiiYuzhnayaShtundaBody', 'BaptistyRossiiYuzhnayaShtundaPageHead'],
  ['dva-sezda-1884', 'BaptistyRossiiDvaSezda1884Body', 'BaptistyRossiiDvaSezda1884PageHead'],
  ['peterburgskaya-liniya', 'BaptistyRossiiPeterburgskayaLiniyaBody', 'BaptistyRossiiPeterburgskayaLiniyaPageHead'],
  ['goneniya-i-sovest', 'BaptistyRossiiGoneniyaISovestBody', 'BaptistyRossiiGoneniyaISovestPageHead'],
  ['sovetskaya-noch', 'BaptistyRossiiSovetskayaNochBody', 'BaptistyRossiiSovetskayaNochPageHead'],
  ['vsehib-1944', 'BaptistyRossiiVsehib1944Body', 'BaptistyRossiiVsehib1944PageHead'],
  ['iniciativnaya-gruppa', 'BaptistyRossiiIniciativnayaGruppaBody', 'BaptistyRossiiIniciativnayaGruppaPageHead'],
  ['podpolnaya-pechat', 'BaptistyRossiiPodpolnayaPechatBody', 'BaptistyRossiiPodpolnayaPechatPageHead'],
  ['spravochnik', 'BaptistyRossiiSpravochnikBody', 'BaptistyRossiiSpravochnikPageHead'],
];
const FORBIDDEN = ['loadLegacyFullDocument','headHtml','bodyHtml','bodyAttributes','?raw','set:html','_legacy'];
const MIN_RATIO = 0.95;
const MAX_RATIO = 1.10;
const problems=[];
function ok(msg){console.log(`✅ ${msg}`)}
function bad(msg){problems.push(msg);console.log(`❌ ${msg}`)}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8')}
function exists(rel){return fs.existsSync(path.join(ROOT,rel))}
function mustContain(label,text,needle){String(text).includes(needle)?ok(`${label}: contains ${needle}`):bad(`${label}: missing ${needle}`)}
function mustNotContain(label,text,needle){!String(text).includes(needle)?ok(`${label}: no ${needle}`):bad(`${label}: forbidden ${needle}`)}
function bodyInner(html){return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]||''}
function stripTags(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim()}
function wordCount(html){return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g)||[]).length}
console.log('BAPTISTY SERIES STRICT-NATIVE AUDIT');
for (const [slug, bodyComp, headComp] of ROUTES) {
  console.log(`\nBAPTISTY: ${slug}`);
  const legacyRel = `baptisty-rossii/${slug}/index.html`;
  const pageRel = `src/pages/baptisty-rossii/${slug}/index.astro`;
  const bodyRel = `src/components/baptisty-rossii/${bodyComp}.astro`;
  const headRel = `src/components/baptisty-rossii/${headComp}.astro`;
  if (!exists(legacyRel)) { bad(`${slug}: legacy page missing`); continue; }
  if (!exists(pageRel)) { bad(`${slug}: route page missing`); continue; }
  if (!exists(bodyRel)) { bad(`${slug}: body component missing`); continue; }
  if (!exists(headRel)) { bad(`${slug}: page head missing`); continue; }
  const legacy = read(legacyRel), page = read(pageRel), body = read(bodyRel), head = read(headRel);
  for (const token of FORBIDDEN) mustNotContain(`${slug} route/body/head scope`, [page,body,head].join('\n'), token);
  mustContain(`${slug} route imports page head`, page, headComp);
  mustContain(`${slug} route imports body component`, page, bodyComp);
  mustContain(`${slug} route explicit gbs body class`, page, 'class="gbs-world"');
  mustContain(`${slug} route or body pagefind marker`, [page, body].join('\n'), 'data-pagefind-body');
  for (const marker of ['rel="canonical"','window.SITE_CONFIG','application/ld+json', `${SITE}/baptisty-rossii/${slug}/`]) mustContain(`${slug} head contract`, head, marker);
  for (const marker of ['gbs2-rail','gbs2-mobile-head','main-content','gbs2-next','gbs2-timeline']) mustContain(`${slug} body marker`, body, marker);
  const lw=wordCount(bodyInner(legacy)), rw=wordCount(body), ratio=rw/Math.max(1,lw);
  console.log(`${slug} words: legacy=${lw}; body=${rw}; ratio=${ratio.toFixed(2)}`);
  if (ratio >= MIN_RATIO && ratio <= MAX_RATIO) ok(`${slug}: word-count parity within threshold (${ratio.toFixed(2)})`); else bad(`${slug}: word-count ratio out of threshold (${ratio.toFixed(2)})`);
}
console.log('');
if (problems.length){ console.log(`❌ baptisty series strict-native audit failed: ${problems.length} issue(s)`); process.exit(1); }
console.log(`✅ baptisty series strict-native audit passed (${ROUTES.length} route(s))`);
