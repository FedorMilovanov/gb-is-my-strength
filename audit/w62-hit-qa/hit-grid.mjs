import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.W58_PLAYWRIGHT||'playwright');
const builds=[['d123498','d1234989ffb7f8c27da3b9bbce1eca0355597c2a',process.env.W61_ROOT||'/tmp/w61-bug-d123498',19090],['86941e4','86941e4f75f67e6d7f90087d4ae8c924111a1d85',process.env.W62_ROOT||'/tmp/w62-bug-86941e4',19091]];
const b=await chromium.launch({executablePath:process.env.W58_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const out='reports/w62-hit-qa';await mkdir(out,{recursive:true});const report={browser:b.version(),scenes:[]};
const boxes=p=>p.evaluate(()=>{
 const one=s=>document.querySelector('.mobile-top-bar '+s);
 const nodes={play:one('.reader-mobile-play'),badge:one('#mobSpdBadge'),settings:one('#mobSettingsBtn'),bookmark:one('.mobile-top-save'),research:one('[data-gill-marginalia-open]'),home:one('#mobHomeBtn'),back:one('#mobBackBtn')};
 const names=new Map(Object.entries(nodes).map(([k,v])=>[v,k]));
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const hit=(x,y)=>{const t=document.elementFromPoint(x,y);return names.get(t?.closest('button,a'))||t?.closest('button,a')?.id||t?.tagName||null;};
 const map={};
 for(const [name,e] of Object.entries(nodes)){
  const r=rect(e);const counts={};const foreign={};
  for(let y=.5;y<r.h;y++)for(let x=.5;x<r.w;x++){
   const k=hit(r.x+x,r.y+y);counts[k]=(counts[k]||0)+1;
   if(k!==name&&!(k in foreign))foreign[k]={x:r.x+x,y:r.y+y};
  }
  map[name]={...r,counts,foreign,center:hit(r.x+r.w/2,r.y+r.h/2)};
 }
 const chip=rect(one('.reader-mobile-speed-chip'));const bar=getComputedStyle(document.querySelector('.mobile-top-bar'));
 return{map,chip,gap:bar.columnGap,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};
});
try{
for(const [version,sha,root,port] of builds){
 const origin=`http://127.0.0.1:${port}`;
 const server=spawn('python3',['-u','-m','http.server',String(port),'--bind','127.0.0.1','--directory',root+'/dist'],{stdio:['ignore','pipe','ignore']});
 try{
  await Promise.race([new Promise((res,rej)=>{server.stdout.once('data',res);server.once('exit',c=>rej(Error('server exit '+c)));}),new Promise((_,rej)=>setTimeout(()=>rej(Error('server timed out')),3500))]);
  for(const width of [320,360,361,390,430,431,525,768,960,961,1024,1120]){
   const c=await b.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
   try{
    await c.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await c.addInitScript(()=>{
     const speech=new EventTarget();window.__utterances=[];
     Object.assign(speech,{getVoices:()=>[],speak(u){window.__utterances.push(u.rate);setTimeout(()=>u.onstart?.());},cancel(){},pause(){},resume(){},speaking:true,pending:false});
     Object.defineProperty(window,'speechSynthesis',{value:speech,configurable:true});
     Object.defineProperty(window,'VoskTTSEngine',{value:{isSupported:()=>false,isReady:()=>false},writable:true,configurable:true});
    });
    const p=await c.newPage();const s={sha,version,width,errors:[]};report.scenes.push(s);p.on('pageerror',e=>s.errors.push(String(e)));
    assert.equal((await p.goto(origin+'/articles/dzhon-gill-chast-2-uchenyi/',{waitUntil:'domcontentloaded'})).status(),200);
    await p.waitForFunction(()=>document.querySelector('.mobile-top-bar')?.dataset.readerSpeedBound==='1'&&window.GBReaderTTS);
    await p.evaluate(()=>document.fonts.ready);
    s.closed=await boxes(p);
    const measure=()=>p.evaluate(()=>({overlay:window.OverlayRuntime.topLayer()?.ownerId||null,speed:document.getElementById('mobSpdBadge').getAttribute('aria-expanded'),play:document.querySelector('.mobile-top-bar .reader-mobile-play').dataset.state,utterances:window.__utterances.slice(),last:document.activeElement?.id}));
    if(s.closed.map.badge.foreign.settings){
      const r=s.closed.map.badge, g=s.closed.map.settings;const x=(Math.max(g.x,r.x)+Math.min(g.right,r.right))/2,y=r.y+r.h/2;
      await p.touchscreen.tap(x,y);await p.waitForTimeout(300);s.badgeSettingsOverlap={x,y,outcome:await measure()};
      await p.keyboard.press('Escape');await p.waitForTimeout(400);
    }
    if(width===320||width===390||width===431||width===960){
     // Same nominal point within Play across versions, on the newly occluded part.
     const r=s.closed.map.play;
     const x=r.x+27,y=r.y+32;
     await p.touchscreen.tap(x,y);await p.waitForTimeout(420);s.playNominalTap={x,y,outcome:await measure()};
     if(width===390||width===431)await p.screenshot({path:`${out}/${version}-${width}-tap.png`,clip:{x:0,y:0,width,height:260},animations:'disabled'});
     if(s.playNominalTap.outcome.play!=='playing'){
      await p.keyboard.press('Escape');
      await p.touchscreen.tap(r.x+r.w/2,r.y+r.h/2);
      await p.waitForFunction(()=>document.querySelector('.mobile-top-bar .reader-mobile-play').dataset.state==='playing');
     }
     await p.keyboard.press('Escape');await p.waitForTimeout(250);
     s.beforePause=await measure();assert.equal(s.beforePause.play,'playing');assert.equal(s.beforePause.speed,'false');
     await p.touchscreen.tap(x,y);await p.waitForTimeout(290);s.pauseNominalTap={x,y,outcome:await measure()};

    }
   }finally{await c.close();}
  }
 }finally{server.kill();await writeFile(`${out}/evidence.json`,JSON.stringify(report,null,2));}
}
}finally{await b.close();}
