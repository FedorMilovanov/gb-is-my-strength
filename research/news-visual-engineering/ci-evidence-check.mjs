import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {interactionTarget} from './keyboard-scale-witness.mjs';

const [engine, root, mode='generic'] = process.argv.slice(2);
assert.ok(['chromium','firefox','webkit'].includes(engine) && root,'engine and evidence directory required');
assert.ok(['generic','compact','history-2018','compare-2022'].includes(mode),'unknown evidence mode');
const json=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const png=async name=>{const f=await readFile(join(root,name));assert.equal(f.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG signature '+name);};
const pdf=async name=>{const f=await readFile(join(root,name));assert.equal(f.subarray(0,5).toString(),'%PDF-','PDF signature '+name);};
function exact(rows,expected,key,verify){
 assert.equal(rows.length,expected.length);
 const remaining=new Set(expected.map(key));assert.equal(remaining.size,expected.length);
 for(const row of rows){assert.ok(remaining.delete(key(row)),'duplicate or unexpected case '+key(row));verify(row);}
 assert.equal(remaining.size,0);
}
const isChromium=engine==='chromium';
async function interactionEvidence(row,fixture,js,desktop,citations,external,returns,enabled=true){
 const expected=enabled&&interactionTarget(row.width,row.dark,js,desktop);
 if(!expected){assert.equal(row.interaction,null,'unexpected targeted interaction');return;}
 const i=row.interaction;
 const stem=['qa-'+fixture,engine,row.width,row.dark?'dark':'light',js?'js':'nojs'].join('-');
 assert.ok(i,'missing targeted interaction '+stem);assert.equal(i.stem,stem);
 assert.equal(i.tabs,citations+external+returns);assert.equal(i.citations,citations);assert.equal(i.external,external);assert.equal(i.returns,returns);
 assert.equal(i.reverse,true);assert.equal(i.scale,2);assert.deepEqual(i.viewport,{width:row.width,height:row.width<=430?640:768});assert.ok(Number.isInteger(i.scaledElements)&&i.scaledElements>0);
 assert.equal(i.focus.length,i.tabs);
 for(const state of i.focus){assert.ok(state.active===true&&state.keyboard===true&&state.visible===true&&state.targetInside===true&&state.boundsInside===true&&state.indicatorVisible===true&&state.outlineWidth>=2&&state.outlineStyle==='solid'&&state.outline>=2&&state.outlineColorVisible===true&&state.unobscured===true&&state.scale===2);assert.deepEqual(state.viewport,i.viewport);}
 for(const suffix of ['citation-focus','return-focus','scale2-full','scale2-viewport'])await png(stem+'-'+suffix+'.png');
}
if(mode!=='generic'){
 const widths=mode==='compact'?[320,390,768,1024,1440,1920]:[320,768,1440];
 const scenarios=widths.flatMap(width=>[false,true].map(dark=>({name:engine,width,dark})));
 const key=r=>JSON.stringify([r.name,r.width,r.dark]);
 if(mode==='compact'){
  const rows=await json('results.json'), acceptance=await json('compact-acceptance.json');
  const comparisons=scenarios.flatMap(r=>['before','after','compact'].map(variant=>({...r,variant})));
  exact(rows,comparisons,r=>key(r)+r.variant,r=>{assert.equal(r.links,r.variant==='before'?1:2);assert.ok(r.opening>0&&r.textStart>0);});
  exact(acceptance.compactAcceptance,scenarios,key,r=>{assert.equal(r.js,false);assert.equal(r.citations,2);assert.equal(r.textScale,2);});
  for(const r of rows)await interactionEvidence(r,'compact',true,1440,2,2,1,r.variant==='compact');
  for(const r of acceptance.compactAcceptance)await interactionEvidence(r,'compact',false,1440,2,2,1);
  for(const r of comparisons){const stem=[engine,r.width,r.dark?'dark':'light',r.variant].join('-');for(const suffix of ['-full','-viewport'])await png(stem+suffix+'.png');}
  for(const r of scenarios)await png([engine,r.width,r.dark?'dark':'light','compact-nojs-full'].join('-')+'.png');
  const papers=isChromium?['A4','Letter'].flatMap(format=>[false,true].map(dark=>({format,dark}))):[];
  exact(acceptance.paperAcceptance,papers,r=>JSON.stringify([r.format,r.dark]),r=>assert.ok(Number.isInteger(r.pages)&&r.pages>0&&Number.isInteger(r.words)&&r.words>0));
  for(const r of papers)await pdf(['compact',r.format,r.dark?'dark':'light'].join('-')+'.pdf');
  console.log(engine+' compact exact evidence: 48 cases / 84 returns / 84 base PNG + 8 interaction PNG / '+papers.length+' PDFs');
 }else{
  const citations=mode==='history-2018'?3:2, rows=await json('history-results.json');
  exact(rows,scenarios.flatMap(r=>[false,true].map(js=>({...r,js}))),r=>key(r)+r.js,r=>assert.equal(r.citations,citations));
  for(const r of rows)await interactionEvidence(r,mode,r.js,1440,citations,citations,citations);
  for(const r of scenarios){const stem=[engine,r.width,r.dark?'dark':'light','history'].join('-');await png(stem+'.png');await png(stem+'-viewport.png');}
  if(isChromium){
   const papers=['A4','Letter'].flatMap(format=>[false,true].flatMap(dark=>[false,true].map(js=>({format,dark,js}))));
   exact(await json('history-paper.json'),papers,r=>JSON.stringify([r.format,r.dark,r.js]),r=>assert.ok(r.pages>0&&r.words>0));
   for(const r of papers)await pdf(['history',r.format,r.dark?'dark':'light',r.js?'js':'nojs'].join('-')+'.pdf');
  }
  console.log(engine+' '+mode+' exact evidence: 12 cases / '+12*citations+' returns / 12 base PNG + 8 interaction PNG / '+(isChromium?8:0)+' PDFs');
 }
}else{
const data=await json('results.json');
assert.deepEqual(data.selected,[engine]);
let total=0;
for(const [fixture,widths,citations] of [['short',[320,390,768,1100],3],['long',[320,1100],12]]){
  const expected=new Set(widths.flatMap(width=>[false,true].flatMap(dark=>[false,true].map(js=>JSON.stringify([width,dark,js])))));
  assert.equal(data[fixture].length,expected.size);
  for(const row of data[fixture]){
    assert.equal(row.engine,engine);
    assert.equal(row.citations,citations);
    assert.ok(expected.delete(JSON.stringify([row.width,row.dark,row.js])),'duplicate or unexpected scenario');
    await interactionEvidence(row,fixture,row.js,1100,citations,0,2);
    total+=row.citations;
  }
  assert.equal(expected.size,0);
}
assert.equal(total,144);
for(const prefix of ['', 'long-'])for(const width of [320,1100])for(const theme of ['light','dark']){
  await png(prefix+engine+'-'+width+'-'+theme+'.png');
}
if(engine==='chromium'){
 const papers=['short','long'].flatMap(fixture=>['A4','Letter'].flatMap(format=>['light','dark'].map(theme=>({fixture,format,theme}))));
 exact(await json('generic-paper.json'),papers,r=>JSON.stringify([r.fixture,r.format,r.theme]),r=>assert.ok(Number.isInteger(r.pages)&&r.pages>0&&Number.isInteger(r.words)&&r.words>0));
 for(const r of papers)await pdf((r.fixture==='long'?'long-':'')+r.format+'-'+r.theme+'.pdf');
}
console.log(engine+' exact evidence: 24 cases / 144 round trips / 8 base screenshots + 16 interaction PNG'+(engine==='chromium'?' / 8 physical PDFs':''));
}
