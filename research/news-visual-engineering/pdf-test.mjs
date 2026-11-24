import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { physicalWordCount } from './pdf-word-bounds.mjs';

// Run against the evidence directory printed by browser-test.mjs.
// Requires existing Poppler pdftotext; no installation or fallback to a simulated PDF.
const root=process.argv[2];
assert.ok(root,'Usage: node pdf-test.mjs <browser evidence directory>');
const headings=['Предмет и границы документа','Порядок фиксации сведений','Условия использования материала','Различение дат и событий','Проверка независимых свидетельств','Уточнения и исправления','Сохранение первоисточника','Ограничения интерпретации'];
const results=[];
const shortHeadings=['Первое положение','Второе положение','Третье положение'];
const shortText=['Редакционный пересказ для проверки композиции, чтения на узком экране и навигации по документу.','Вторая часть документа позволяет оценить вертикальный ритм и порядок чтения.','Другая запись библиографии позволяет проверить независимость переходов.'];
const words=v=>v.replace(/[\s\u00ad\-]/gu,'');
for(const fixture of ['short','long'])for(const format of ['A4','Letter'])for(const theme of ['light','dark']){
  const name=(fixture==='long'?'long-':'')+format+'-'+theme+'.pdf';
  const run=spawnSync('pdftotext',['-layout','-enc','UTF-8',join(root,name),'-'],{encoding:'utf8'});
  assert.equal(run.status,0,run.error?.message??run.stderr);
  const pages=run.stdout.split('\f').map(p=>p.trim()).filter(Boolean);
  const text=pages.join(' ').replace(/\s+/gu,' ');
  const count=physicalWordCount(join(root,name),pages.length);
  if(fixture==='short'){
    for(const value of [...shortHeadings,...shortText,'Анатомия документа','Техническая фикстура','Технический образец источника','Второй образец источника'])assert.equal(words(text).split(words(value)).length-1,1,name+' missing or duplicate '+value);
    for(const label of ['Значение','Предел доказательства','Источник:'])assert.equal(text.split(label).length-1,3,name+' '+label);
    assert.equal(text.split('Не установлена').length-1,1,name+' unknown date');
  }else{
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
  }
  results.push({fixture,format,theme,pages:pages.length,words:count});
  writeFileSync(join(root,'generic-paper.json'),JSON.stringify(results,null,2)+'\n');
  console.log(name+' PASS pages='+pages.length+' words='+count);
}
assert.equal(results.length,8);
