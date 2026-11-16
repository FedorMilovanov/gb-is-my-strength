#!/usr/bin/env node
'use strict';
// Canonical Reader TTS rate-policy contract: real bootstrap source, no mock UI.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../src/runtime/reader-tts-defaults.js'),'utf8');
const allowed=[0.75,1,1.25,1.5,1.75,2];
const cases=[
  ['-1','-1',1],['0','0',1],['0.8','0.8',0.75],
  ['1.1','1.1',1],['2.5','2.5',1],['100','100',1],
  ['NaN','NaN',1],['broken','broken',1],
  [null,'1.5',1.5],['bad','1.75',1.75],
  ['1.25','2',1.25],['2','1.25',2],
  ['0.8','1',0.75],[' ','0.75',0.75],
];
let checks=0;
for(const [primary,legacy,want] of cases){
  const data=new Map();
  if(primary!==null)data.set('gb:audio:rate',primary);
  if(legacy!==null)data.set('gbx-tts-rate',legacy);
  const events=[];
  const context={localStorage:{
    getItem:(k)=>data.has(k)?data.get(k):null,
    setItem:(k,v)=>data.set(k,String(v)),
  },CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:(ev)=>events.push(ev)};
  context.window=context;
  vm.runInNewContext(src,context);
  const policy=context.GBReaderRatePolicy;
  assert.equal(policy.read(),want,primary+' / '+legacy);
  assert.equal(data.get('gb:audio:rate'),String(want));
  assert.equal(data.get('gbx-tts-rate'),String(want));
  for(const rate of allowed) assert.equal(policy.normalize(String(rate)),rate);
  for(const bad of [-1,0,1.1,2.5,100,'NaN','invalid',null,''])assert.equal(policy.normalize(bad),null);
  assert.equal(policy.persist(1.5),1.5);
  assert.equal(events.length,1);
  assert.equal(events[0].detail.rate,1.5);
  assert.equal(policy.persist('2.5'),null);
  assert.equal(events.length,1);
  checks++;
}
console.log('READER RATE POLICY: '+checks+'/'+checks+' bootstrap/storage/event migration fixtures passed');
