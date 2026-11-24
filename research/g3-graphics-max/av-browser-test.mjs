import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync,cpSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
const root=process.cwd(),out=process.env.AV_OUT;
assert(process.env.G3_GRAPHICS_DISPOSABLE==='1'&&!existsSync('.git')&&!existsSync('src/pages')&&!existsSync('astro.config.mjs')&&!existsSync('tsconfig.json')&&out&&!path.resolve(out).startsWith(root+path.sep));mkdirSync(out,{recursive:true});
mkdirSync('src/pages',{recursive:true});mkdirSync('public',{recursive:true});cpSync('fonts','public/fonts',{recursive:true});
const sampleBrowser=await chromium.launch();
try{const sample=await sampleBrowser.newPage({viewport:{width:640,height:360}});await sample.setContent('<html><body style="margin:0;background:#f3f3f3"><svg viewBox="0 0 640 360" width="640" height="360"><g fill="none" stroke="#777" stroke-width="3"><rect x="24" y="24" width="592" height="312"/><path d="M24 24L616 336M616 24L24 336"/></g></svg></body></html>');await sample.screenshot({path:'public/test-card.png'});}finally{await sampleBrowser.close();}
writeFileSync('tsconfig.json',JSON.stringify({extends:'astro/tsconfigs/strict',compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}},include:['.astro/types.d.ts','src/**/*'],exclude:['dist','node_modules']}));
writeFileSync('astro.config.mjs',"import {defineConfig} from 'astro/config';import {fileURLToPath} from 'node:url';export default defineConfig({output:'static',vite:{resolve:{alias:{'@':fileURLToPath(new URL('./src/',import.meta.url))}}}});");
writeFileSync('src/pages/index.astro',[
'---',
"import AV from '@/components/journal/g3-graphics/G3AVExhibit.astro';",
"import SourceReturn from '@/components/journal/JournalSourceReturn.astro';",
"import {fixture,paraphraseFixture} from '../../research/g3-graphics-max/av-test-fixture.mjs';",
"import '@/components/journal/journalEditorial.css';",
'const v=fixture();',
'const cases=[v,{...v,frame:{...v.frame,rights:null},excerptId:v.excerptId,sourceLinks:[{...v.sourceLinks[0],citationId:"cite-test-av-link"}]},{...paraphraseFixture(v),sourceLinks:[{...v.sourceLinks[0],citationId:"cite-test-av-paraphrase"}]},{...v,audio:null},{...v,translationRights:null},{...v,startMs:-1}];',
'---',
'<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>PRIVATE SYNTHETIC QA</title><link rel="stylesheet" href="/fonts/fonts.css"/><style is:global>body{margin:0}.witness{width:min(100% - 24px,740px);margin:auto} @media print{.witness{width:100%}}</style></head><body><main class="journal-edition" data-journal-source-navigation><div class="witness"><p>PRIVATE SYNTHETIC QA — НЕ ИСТОРИЧЕСКИЙ МАТЕРИАЛ</p><p id="fallback" tabindex="-1">Тестовый раздел</p>{cases.map((e,i)=><section data-case={i}><AV evidence={e}/></section>)}<section class="bibliography-item" id="src-TEST-SOURCE" tabindex="-1"><p>Тестовый источник</p><SourceReturn href="#fallback"/></section></div></main></body></html>'
].join('\n'));
const typecheck=spawnSync(process.execPath,['scripts/astro-cli.mjs','check'],{stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});assert.equal(typecheck.status,0,'AV Astro typecheck');
const run=spawnSync(process.execPath,['scripts/astro-cli.mjs','build'],{stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});assert.equal(run.status,0);
const dist=path.join(root,'dist');const server=createServer((req,res)=>{let f=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(existsSync(f)&&statSync(f).isDirectory())f=path.join(f,'index.html');if(!f.startsWith(dist+path.sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[path.extname(f)]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
let total=0;const failures=[];
try{for(const [engine,type] of Object.entries({chromium,firefox,webkit})){const b=await type.launch();let pass=0;try{for(const width of [320,390,580,850])for(const dark of [false,true])for(const js of [false,true]){const ctx=await b.newContext({viewport:{width,height:900},javaScriptEnabled:js});try{const page=await ctx.newPage();page.setDefaultTimeout(7000);await page.goto(url);await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);for(let i=0;i<40;i++){if(await page.evaluate(()=>document.fonts.status==='loaded'))break;await new Promise(r=>setTimeout(r,100))}
const g=await page.evaluate(()=>{const f=[];const fs=[...document.querySelectorAll('.g3av')];if(fs.length!==3)f.push('render count');if(document.querySelectorAll('.g3av img').length!==1)f.push('frame fallback');if(document.querySelectorAll('.g3av blockquote').length!==4)f.push('quote semantics');if(document.querySelector('[data-case="2"] blockquote'))f.push('paraphrase quoted');if(document.querySelector('[data-case="3"] figure,[data-case="4"] figure,[data-case="5"] figure'))f.push('rejected visible');if(document.documentElement.scrollWidth>innerWidth+1)f.push('page overflow');for(const n of fs){if(n.scrollWidth>n.clientWidth+1)f.push('figure overflow');for(const a of n.querySelectorAll('a'))if(a.getBoundingClientRect().height<43.5)f.push('target <44 '+a.textContent)}if(document.querySelectorAll('iframe,video,audio').length)f.push('player runtime');return f});assert.deepEqual(g,[]);pass++;
const a=page.locator('#cite-test-av-link');await a.focus();await a.press('Enter');assert.equal(new URL(page.url()).hash,'#src-TEST-SOURCE');const back=page.locator('[data-journal-source-return]');assert.equal(await back.getAttribute('href'),js?'#cite-test-av-link':'#fallback');await back.press('Enter');assert.equal(new URL(page.url()).hash,js?'#cite-test-av-link':'#fallback');pass++;
await page.emulateMedia({media:'print'});assert.equal(await page.locator('.g3av-time').count(),3);assert.equal(await page.locator('.g3av-recording').count(),3);assert.equal(await page.locator('.g3av-original').count(),2);pass++;
if(engine==='chromium'&&js&&width===850){await page.pdf({path:path.join(out,'av-'+(dark?'dark':'light')+'.pdf'),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});}
if(js&&(width===390||width===850)){await page.emulateMedia({media:'screen'});await page.locator('.g3av').first().screenshot({path:path.join(out,engine+'-'+width+'-'+(dark?'dark':'light')+'.png')});}
}catch(e){failures.push({engine,width,dark,js,error:String(e)});console.log('FAIL',JSON.stringify(failures.at(-1)))}finally{await ctx.close()}}}finally{await b.close()}total+=pass;console.log('AV_ENGINE',engine,pass,'/48')}}
finally{await new Promise(r=>server.close(r))}
console.log('AV_TOTAL',total,'/144','FAILURES',JSON.stringify(failures));writeFileSync(path.join(out,'av-report.json'),JSON.stringify({total,failures},null,2));if(failures.length)process.exitCode=1;
