const {chromium,firefox,webkit}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const from=fs.readFileSync(path.join(__dirname,'engine-sweep.mjs'),'utf8');
const key='const SPEECH_STUB = '+String.fromCharCode(96);
const pos=from.indexOf(key),end=from.indexOf(String.fromCharCode(96)+';',pos+key.length);
if(pos<0||end<=pos)throw Error('Original engine-sweep speech fixture missing');
const speechStub=from.slice(pos+key.length,end);
const root=path.resolve(__dirname,'../dist');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');let f=path.resolve(root,decodeURIComponent(u.pathname).slice(1));if(!path.extname(f))f=path.join(f,'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch(e){res.writeHead(500).end(String(e))}});
const routes=[
 ['gill3','/articles/dzhon-gill-chast-3-nasledie/','.gbs-theme-corner .gb-ember'],
 ['baptists','/baptisty-rossii/podpolnaya-pechat/','.gbs-theme-corner .gb-ember'],
 ['herm','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/','.gb-floater .gb-ember, .gbs-theme-corner .gb-ember']
];
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,rows=[];
for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});
 try{for(const [slug,url,selector] of routes){
 const ctx=await browser.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript({content:speechStub});
 const row={engineName,slug};
 try{
 await p.goto(origin+url,{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(420);
 const baseY=await p.evaluate(()=>scrollY);
 await p.evaluate(sel=>document.querySelector(sel)?.click(),selector);
 await p.waitForTimeout(2500);
 row.active=await p.evaluate(sel=>{
 const e=document.querySelector(sel),a=[...document.querySelectorAll('audio')].find(x=>x.loop&&x.volume<=.05);
 return{state:e?.dataset.state,chunks:(window.__spokenChunks||[]).length,progress:parseFloat(e?.style.getPropertyValue('--p')||'0'),mediaSupported:'mediaSession' in navigator,ms:navigator.mediaSession?.playbackState,title:navigator.mediaSession?.metadata?.title||'',anchor:!!a,anchorPlaying:!!a&&!a.paused,y:scrollY}
 },selector);
 const x=row.active;
 if(x.state!=='playing'||x.chunks<=0||x.progress<=0||x.y<=baseY||(x.mediaSupported&&(x.ms!=='playing'||x.title.length<=3))||!x.anchorPlaying)throw Error('Playback '+JSON.stringify(x));
 await p.evaluate(sel=>document.querySelector(sel)?.click(),selector);await p.waitForTimeout(400);
 row.paused=await p.evaluate(sel=>{const e=document.querySelector(sel),a=[...document.querySelectorAll('audio')].find(x=>x.loop&&x.volume<=.05);return{state:e?.dataset.state,ms:navigator.mediaSession?.playbackState,anchorPaused:!a||a.paused}},selector);
 if(row.paused.state!=='paused'||(row.active.mediaSupported&&row.paused.ms!=='paused')||!row.paused.anchorPaused)throw Error('Pause '+JSON.stringify(row.paused));
 if(errors.length)throw Error('Page errors '+errors.join('; '));
 row.pass=true;
 }catch(e){row.pass=false;row.error=String(e).slice(0,1200)}
 finally{rows.push(row);await ctx.close()}
 }}finally{await browser.close()}
}
const failures=rows.filter(x=>!x.pass),r={cases:rows.length,passes:rows.length-failures.length,failures,rows};
const out=path.join(process.env.USERPROFILE,'Downloads','GB_READER_HISTORIC_PLAY_V11_SCREENSHOTS_20261112','tts-live-v11.json');
fs.writeFileSync(out,JSON.stringify(r,null,2));
console.log(JSON.stringify({cases:r.cases,passes:r.passes,failures},null,2));
if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2}).finally(()=>server.close());
