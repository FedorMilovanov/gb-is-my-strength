import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Physical word containment, not a substitute for visual paper review.
export function validateWordBounds(xml, expectedPages, name='PDF') {
  assert.ok(Number.isInteger(expectedPages)&&expectedPages>0,name+' expected pages');
  const sheets=[...xml.matchAll(/<page width="([^"]+)" height="([^"]+)">([\s\S]*?)<\/page>/g)];
  assert.equal(sheets.length,expectedPages,name+' physical page count');
  let count=0;
  for(const [index,sheet] of sheets.entries()){
    const width=Number(sheet[1]),height=Number(sheet[2]),label=name+' page '+(index+1);
    assert.ok(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0,label+' invalid page size');
    const words=[...sheet[3].matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)">/g)];
    assert.equal(words.length,(sheet[3].match(/<word\b/g)??[]).length,label+' malformed word bounds');
    assert.ok(words.length>0,label+' no physical words');
    for(const word of words){
      const [x1,y1,x2,y2]=word.slice(1).map(Number);
      assert.ok([x1,y1,x2,y2].every(Number.isFinite)&&x1>=0&&y1>=0&&x2>=x1&&y2>=y1&&x2<=width+.5&&y2<=height+.5,label+' word beyond physical sheet or invalid bounds');
      count++;
    }
  }
  return count;
}
export function physicalWordCount(file, expectedPages){
  const bbox=spawnSync('pdftotext',['-bbox','-enc','UTF-8',file,'-'],{encoding:'utf8'});
  assert.equal(bbox.status,0,bbox.error?.message??bbox.stderr);
  return validateWordBounds(bbox.stdout,expectedPages,file);
}
