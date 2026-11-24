import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const paperSizes = { A4: [595.28, 841.89], Letter: [612, 792] };
const decimal = /^-?\d+(?:\.\d+)?$/u;
// Chromium may round physical sheet dimensions; allow at most 2 PDF points.
// Physical word containment, not a substitute for visual paper review.
export function validateWordBounds(xml, expectedPages, format, name='PDF') {
  assert.ok(typeof format==='string'&&Object.hasOwn(paperSizes,format),name+' expected paper format');
  assert.ok(Number.isInteger(expectedPages)&&expectedPages>0,name+' expected pages');
  const sheets=[...xml.matchAll(/<page width="([^"]+)" height="([^"]+)">([\s\S]*?)<\/page>/g)];
  assert.equal(sheets.length,expectedPages,name+' physical page count');
  let count=0;
  for(const [index,sheet] of sheets.entries()){
    const width=Number(sheet[1]),height=Number(sheet[2]),label=name+' page '+(index+1);
    const [expectedWidth,expectedHeight]=paperSizes[format];
    assert.ok(sheet.slice(1,3).every(v=>decimal.test(v))&&Number.isFinite(width)&&Number.isFinite(height)&&Math.abs(width-expectedWidth)<=2&&Math.abs(height-expectedHeight)<=2,label+' incorrect '+format+' physical dimensions: '+width+' x '+height);
    const words=[...sheet[3].matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)">/g)];
    assert.equal(words.length,(sheet[3].match(/<word\b/g)??[]).length,label+' malformed word bounds');
    assert.ok(words.length>0,label+' no physical words');
    for(const word of words){
      const coordinates=word.slice(1);
      const [x1,y1,x2,y2]=coordinates.map(Number);
      assert.ok(coordinates.every(v=>decimal.test(v))&&[x1,y1,x2,y2].every(Number.isFinite)&&x1>=0&&y1>=0&&x2>x1&&y2>y1&&x2<=width+.5&&y2<=height+.5,label+' word beyond physical sheet or invalid bounds');
      count++;
    }
  }
  return count;
}
export function physicalWordCount(file, expectedPages, format){
  const bbox=spawnSync('pdftotext',['-bbox','-enc','UTF-8',file,'-'],{encoding:'utf8'});
  assert.equal(bbox.status,0,bbox.error?.message??bbox.stderr);
  return validateWordBounds(bbox.stdout,expectedPages,format,file);
}
