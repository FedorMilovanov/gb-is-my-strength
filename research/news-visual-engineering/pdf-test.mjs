import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { join } from 'node:path';

// Run against the evidence directory printed by browser-test.mjs.
// Requires existing Poppler pdftotext; no installation or fallback to a simulated PDF.
const root=process.argv[2];
assert.ok(root,'Usage: node pdf-test.mjs <browser evidence directory>');
const headings=['Предмет и границы документа','Порядок фиксации сведений','Условия использования материала','Различение дат и событий','Проверка независимых свидетельств','Уточнения и исправления','Сохранение первоисточника','Ограничения интерпретации'];
let passed=0;
for(const format of ['A4','Letter'])for(const theme of ['light','dark']){
  const name='long-'+format+'-'+theme+'.pdf';
  const run=spawnSync('pdftotext',['-layout','-enc','UTF-8',join(root,name),'-'],{encoding:'utf8'});
  assert.equal(run.status,0,run.error?.message??run.stderr);
  const pages=run.stdout.split('\f').map(p=>p.trim()).filter(Boolean);
  const text=pages.join(' ').replace(/\s+/gu,' ');
  assert.ok(pages.length>1,name+' must exercise pagination');
  for(const [i,heading] of headings.entries())assert.equal(text.split(heading).length-1,i<2?2:1,name+' heading '+heading);
  assert.equal(text.split('Предел доказательства').length-1,10,name+' limits');
  assert.equal(text.split('Значение').length-1,10,name+' meaning labels');
  assert.equal(text.split('Источник:').length-1,12,name+' citations');
  assert.equal(text.split('Дополнительный локатор').length-1,1,name+' additional evidence locator');
  assert.equal(text.split('Повторный источник, иной локатор').length-1,1,name+' distinct same-source locator');
  assert.equal(text.split('Не установлена').length-1,2,name+' unknown dates');
  // These fixture annotations are short enough to fit together on one sheet.
  // Do not impose this fixture rule on an arbitrarily long real annotation.
  for(const page of pages){
    const labels=[...page.matchAll(/Значение|Предел доказательства/gu)].map(match=>match[0]);
    for(let i=0;i<labels.length;i++)assert.equal(labels[i],i%2===0?'Значение':'Предел доказательства',name+' annotation order on page');
    assert.equal(labels.length%2,0,name+' split annotation pair across pages');
    assert.ok(!/^Источник:/u.test(page),name+' orphan citation at top');
    assert.ok(!/(?:Значение|Предел доказательства|Технический образец)\s*$/u.test(page),name+' orphan label at bottom');
  }
  console.log(name+' PASS pages='+pages.length);passed++;
}
assert.equal(passed,4);
