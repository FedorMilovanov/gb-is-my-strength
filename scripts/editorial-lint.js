#!/usr/bin/env node
/**
 * Editorial lint: catches high-risk public wording that previous audits flagged
 * as over-heated, AI-ish, or misleading in publication Russian.
 * This is intentionally surgical: exact phrases only, no broad ban on normal words.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
function walk(dir, out=[]) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p,out); else out.push(p);
  }
  return out;
}
function rel(p){ return path.relative(ROOT,p).replace(/\\/g,'/'); }
function fail(kind,file,line,txt){ issues.push({kind,file,line,txt}); }
const files = walk(ROOT).filter(f => f.endsWith('.html') && !/[\\/](audit|node_modules)[\\/]/.test(f));
const banned = [
  { kind:'overclaim-historians', rx:/Проверено историками/ },
  { kind:'da-vinci-shouting-label', rx:/\b(?:БРАУН|НА САМОМ ДЕЛЕ)\b/ },
  { kind:'da-vinci-overheated-heading', rx:/Самые грубые ошибки|Бонус:\s*ляп/ },
  { kind:'generic-repeated-label', rx:/Объективный разбор/ },
  { kind:'bad-title-case', rx:/Анатомия Мотивов/ },
  { kind:'pastor-series-pathology-label', rx:/пасторск(?:ие|их) патолог(?:ии|ий)/i },
  { kind:'diagnostic-frame-label', rx:/диагностическая рамка/i },
  { kind:'heated-cliche', rx:/меняет правила игры|кромсавш|сокрушител/i },
  { kind:'home-brand-spacing', rx:/Господь Бог—Сила Моя/ },
  { kind:'typo-eto', rx:/\bЭ то\b/ },
];
for (const f of files) {
  const text = fs.readFileSync(f,'utf8');
  text.split(/\n/).forEach((line,idx)=>{
    for (const b of banned) {
      if (b.rx.test(line)) fail(b.kind, rel(f), idx+1, line.trim().slice(0,220));
    }
  });
}
console.log('\nGB EDITORIAL LINT');
if (issues.length) {
  const by = issues.reduce((a,i)=>(a[i.kind]=(a[i.kind]||0)+1,a),{});
  console.log(`❌ ${issues.length} issue(s)`, by);
  issues.slice(0,80).forEach(i=>console.log(`- ${i.kind} ${i.file}:${i.line}: ${i.txt}`));
  process.exit(1);
}
console.log('✅ Editorial lint passed');
