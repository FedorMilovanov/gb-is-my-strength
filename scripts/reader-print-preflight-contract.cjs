#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const RUNTIME=fs.readFileSync(path.resolve(__dirname,'../src/runtime/reader-actions.js'),'utf8');

function fixture(options={}){
 const calls={print:0,suspend:0,resume:0,toast:'',events:{}};
 const toast={
  classList:{add() {},remove() {}},
  querySelector(selector){
   if(selector==='span')return{set textContent(value){calls.toast=value}};
   if(selector==='svg')return {style:{display:''}};
   return null;
  }
 };
 const document={
  title:'Reader fixture',
  documentElement:{dataset:{},getAttribute(key){return key==='data-scroll-locked'&&options.locked?'1':null},removeAttribute(){}},
  querySelector(selector){return selector==='.gb-fc-toast'?toast:null},
  addEventListener(event,handler){calls.events['doc:'+event]=handler},
  body:{appendChild(){}}
 };
 const window={
  SITE_CONFIG:{},GBPrintPagination:null,clearTimeout(){},
  setTimeout(){return 1},
  addEventListener(event,handler){calls.events[event]=handler},
  dispatchEvent(){},
  print(){
   calls.print++;
   if(options.throwPrint)throw new Error('native print refused');
  },
 };
 if(options.noSiteUtils!==true){
  window.SiteUtils={
   suspendScrollForPrint(){
    calls.suspend++;
    return options.suspendResult||{ok:true,state:'unlocked'};
   },
   resumeScrollAfterPrint(){calls.resume++}
  };
 }
 const context={window,document,navigator:{},location:{href:'https://example.test/'},history:{},
   console:{error(){}},URL,CustomEvent:function(){}};
 vm.runInNewContext(RUNTIME,context,{filename:'src/runtime/reader-actions.js'});
 return{print:window.GBPrintEngine.print,calls,window};
}
{
 const x=fixture();
 const report=x.print('button');
 assert.equal(x.calls.print,1,'clean print reaches platform');
 assert.equal(x.calls.suspend,1,'owner preflight runs');
 assert.equal(report.prepared,true,'clean print prepares pagination');
}
{
 const x=fixture({suspendResult:{ok:false,reason:'unknown-scroll-owner'}});
 const report=x.print('button');
 assert.equal(x.calls.print,0,'unknown scroll owner must prevent platform print');
 assert.equal(report.status,'blocked','unknown owner does not report printed');
 assert.equal(report.reason,'unknown-scroll-owner');
 assert.match(x.calls.toast,/Закройте/);
}
{
 const x=fixture({noSiteUtils:true,locked:true});
 const report=x.print('button');
 assert.equal(x.calls.print,0,'missing owner API refuses locked print');
 assert.equal(report.reason,'scroll-owner-unavailable');
}
{
 const x=fixture({throwPrint:true});
 const report=x.print('button');
 assert.equal(x.calls.print,1);
 assert.equal(x.calls.resume,1,'native error restores suspended lock');
 assert.equal(report.status,'failed');
 assert.match(x.calls.toast,/Не удалось/);
}
{
 const x=fixture({suspendResult:{ok:false,reason:'unknown-scroll-owner'}});
 assert.equal(x.print('button').status,'blocked');
 x.window.SiteUtils.suspendScrollForPrint=()=>({ok:true,state:'unlocked'});
 assert.equal(x.print('button').prepared,true,'blocked attempt must not poison next print');
 assert.equal(x.calls.print,1);
}
console.log('Reader print preflight contract: 5/5 PASS');
