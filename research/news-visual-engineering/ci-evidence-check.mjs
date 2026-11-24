import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const [engine, root] = process.argv.slice(2);
assert.ok(['chromium','firefox','webkit'].includes(engine) && root,'engine and evidence directory required');
const data=JSON.parse(await readFile(join(root,'results.json'),'utf8'));
assert.deepEqual(data.selected,[engine]);
let total=0;
for(const [fixture,widths,citations] of [['short',[320,390,768,1100],3],['long',[320,1100],12]]){
  const expected=new Set(widths.flatMap(width=>[false,true].flatMap(dark=>[false,true].map(js=>JSON.stringify([width,dark,js])))));
  assert.equal(data[fixture].length,expected.size);
  for(const row of data[fixture]){
    assert.equal(row.engine,engine);
    assert.equal(row.citations,citations);
    assert.ok(expected.delete(JSON.stringify([row.width,row.dark,row.js])),'duplicate or unexpected scenario');
    total+=row.citations;
  }
  assert.equal(expected.size,0);
}
assert.equal(total,144);
for(const prefix of ['', 'long-'])for(const width of [320,1100])for(const theme of ['light','dark']){
  assert.ok((await stat(join(root,prefix+engine+'-'+width+'-'+theme+'.png'))).size>0,'missing screenshot');
}
if(engine==='chromium')for(const prefix of ['', 'long-'])for(const format of ['A4','Letter'])for(const theme of ['light','dark']){
  const file=await readFile(join(root,prefix+format+'-'+theme+'.pdf'));
  assert.equal(file.subarray(0,5).toString(),'%PDF-','missing PDF signature');
}
console.log(engine+' exact evidence: 24 cases / 144 round trips / 8 screenshots'+(engine==='chromium'?' / 8 physical PDFs':''));
