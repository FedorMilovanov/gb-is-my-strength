#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2' };
const EXPECTED_LOCALHOST_CSP_ASSET_URLS = new Set([
  'https://gospod-bog.ru/favicon.ico',
  'https://gospod-bog.ru/apple-touch-icon.png',
  'https://gospod-bog.ru/favicon-48.png',
  'https://gospod-bog.ru/favicon-120.png',
  'https://gospod-bog.ru/icons/icon-192.png',
  'https://gospod-bog.ru/images/og-nagornaya-propoved.webp',
]);
const CASES = [
  { route:'/nagornaya/chast-1/', target:'#nagornaya-matthew-luke-observation-matrix', kind:'observation' },
  { route:'/nagornaya/chast-2/', target:'#nagornaya-ipsissima-vox-models', kind:'claim' },
  { route:'/nagornaya/chast-2/', target:'#nagornaya-sermon-identity-models', kind:'models' },
  { route:'/nagornaya/chast-4/', target:'#nagornaya-part4-green-model', kind:'claim' },
  { route:'/nagornaya/chast-4/', target:'#nagornaya-part4-thomas-model', kind:'claim' },
];
const VIEWPORTS = [{id:'mobile-320',width:320,height:760},{id:'mobile-390',width:390,height:844},{id:'desktop-1440',width:1440,height:900}];
const DARK_ROUTES=['/nagornaya/','/nagornaya/chast-1/','/nagornaya/chast-2/','/nagornaya/chast-3/','/nagornaya/chast-4/','/nagornaya/chast-5/','/nagornaya/seriya/','/nagornaya/istochniki/','/nagornaya/nakhodki/'];
const DARK_TEXT_TOKENS=['text-blue-600','text-rose-600','text-purple-600','text-purple-700','text-teal-700','text-orange-700','text-red-600','text-rose-700'];
const DARK_BACKGROUND_TOKENS=['bg-stone-200'];
const DARK_TOKENS=[...DARK_TEXT_TOKENS,...DARK_BACKGROUND_TOKENS];
const results=[];
function record(item, viewport, contract, ok, detail=''){results.push({route:item.route,target:item.target,viewport:viewport.id,contract,ok:Boolean(ok),detail:String(detail||'')});}
function routeFile(pathname){const clean=decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');return join(DIST,clean,clean.endsWith('.html')?'':'index.html');}
function isExpectedLocalhostCspAssetError(text){
  if(!text.includes('violates the following Content Security Policy directive'))return false;
  for(const url of EXPECTED_LOCALHOST_CSP_ASSET_URLS){if(text.includes(`'${url}'`))return true;}
  return false;
}
async function serve(){const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url||'/','http://127.0.0.1').pathname;let file=pathname.includes('.')&&!pathname.endsWith('/')?join(DIST,pathname.replace(/^\/+/,'')):routeFile(pathname);try{if((await stat(file)).isDirectory())file=join(file,'index.html');}catch{file=join(ROOT,pathname.replace(/^\/+/,''));}const body=await readFile(file);res.writeHead(200,{'content-type':MIME[extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('not found');}});await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));return{server,base:`http://127.0.0.1:${server.address().port}`};}
async function persist(){await mkdir(REPORTS,{recursive:true});await writeFile(join(REPORTS,'nagornaya-epistemic-ui-browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),expectedLocalhostCspAssetUrls:[...EXPECTED_LOCALHOST_CSP_ASSET_URLS],results},null,2));}

let browser;
let server;
try {
  browser=await chromium.launch({headless:true});
  const served=await serve();server=served.server;const base=served.base;
  for(const viewport of VIEWPORTS){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
    const page=await context.newPage();
    await page.emulateMedia({reducedMotion:'reduce'});
    try {
      for(const item of CASES){
        const runtime=[];
        try {
          page.removeAllListeners('pageerror');page.removeAllListeners('console');page.removeAllListeners('requestfailed');
          page.on('pageerror',(error)=>runtime.push(`pageerror: ${error.message}`));
          page.on('console',(message)=>{if(message.type()==='error'&&!isExpectedLocalhostCspAssetError(message.text()))runtime.push(`console: ${message.text()}`);});
          page.on('requestfailed',(request)=>{const url=new URL(request.url());if(url.origin===base)runtime.push(`requestfailed: ${url.pathname}`);});
          const response=await page.goto(base+item.route,{waitUntil:'load'});
          record(item,viewport,'http-200',response?.status()===200,`status=${response?.status()}`);
          const target=page.locator(item.target);
          await target.waitFor({state:'attached',timeout:5000}).catch(()=>{});
          const count=await target.count();record(item,viewport,'target-present',count===1,`count=${count}`);if(count!==1)continue;
          await target.scrollIntoViewIfNeeded();
          const metrics=await page.evaluate((selector)=>{
            const root=document.scrollingElement||document.documentElement;const el=document.querySelector(selector);const box=el?.getBoundingClientRect();
            const ids=[...document.querySelectorAll('[id]')].map((node)=>node.id);const dup=ids.filter((id,index)=>ids.indexOf(id)!==index);
            const labelled=el?.getAttribute('aria-labelledby');const label=labelled?document.getElementById(labelled):null;
            const parse=(value)=>{const match=value.match(/rgba?\(([^)]+)\)/);return match?match[1].split(',').slice(0,3).map(Number):null;};
            const lum=(rgb)=>{const channels=rgb.map((value)=>{value/=255;return value<=.03928?value/12.92:((value+.055)/1.055)**2.4;});return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];};
            const background=(node)=>{for(let current=node;current;current=current.parentElement){const color=getComputedStyle(current).backgroundColor;if(color&&!color.endsWith(', 0)')&&color!=='transparent')return color;}return 'rgb(255,255,255)';};
            const probes=[...el.querySelectorAll('h3,h4,p,li')].filter((node)=>{const rect=node.getBoundingClientRect();return rect.width&&rect.height;}).slice(0,12).map((node)=>{const foreground=parse(getComputedStyle(node).color);const back=parse(background(node));if(!foreground||!back)return 0;const a=lum(foreground),b=lum(back);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
            return {scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,left:box?.left,right:box?.right,width:box?.width,duplicateIds:[...new Set(dup)],labelled,labelExists:Boolean(label),minContrast:probes.length?Math.min(...probes):0,animations:el?.getAnimations({subtree:true}).length??-1};
          },item.target);
          record(item,viewport,'root-no-horizontal-overflow',metrics.scrollWidth<=metrics.clientWidth+1,`${metrics.scrollWidth}/${metrics.clientWidth}`);
          record(item,viewport,'target-within-inline-viewport',metrics.left>=-1&&metrics.right<=viewport.width+1,`left=${metrics.left} right=${metrics.right} width=${metrics.width}`);
          record(item,viewport,'unique-document-ids',metrics.duplicateIds.length===0,metrics.duplicateIds.join(','));
          record(item,viewport,'aria-labelledby-resolves',Boolean(metrics.labelled&&metrics.labelExists),`aria-labelledby=${metrics.labelled}`);
          record(item,viewport,'text-contrast',metrics.minContrast>=4.5,`minimum=${metrics.minContrast.toFixed(2)}`);
          record(item,viewport,'reduced-motion-no-active-animation',metrics.animations===0,`animations=${metrics.animations}`);
          if(item.kind==='observation'){
            const region=target.locator('[role="region"][tabindex="0"]');await region.focus();record(item,viewport,'keyboard-scroll-region-focus',await region.evaluate((node)=>node===document.activeElement));
            const headers=await target.locator('table thead th').count();record(item,viewport,'semantic-table',headers===4,`headers=${headers}`);
          }
          if(item.kind==='claim'){
            const details=target.locator('details').first();const summary=details.locator('summary');await summary.focus();await summary.press('Enter');record(item,viewport,'keyboard-revision-disclosure',await details.evaluate((node)=>node.open));
            record(item,viewport,'claim-attribution-boundary',await target.getByText('Граница атрибуции',{exact:true}).count()===1);
          }
          record(item,viewport,'runtime-clean',runtime.length===0,runtime.join(' | '));
          record(item,viewport,'test-execution',true);
        } catch (error) {
          record(item,viewport,'test-execution',false,error?.stack||error?.message||String(error));
        }
      }

      await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
      await page.addInitScript(()=>{try{localStorage.setItem('theme','dark');}catch{}});
      const darkAggregate=Object.fromEntries(DARK_TOKENS.map((token)=>[token,{visible:0,textSamples:0,textFailures:0,graphicSamples:0,graphicFailures:0,lightIslands:0,minTextContrast:null,minGraphicContrast:null}]));
      for(const route of DARK_ROUTES){
        const item={route,target:'(dark-theme)'};const runtime=[];
        try{
          page.removeAllListeners('pageerror');page.removeAllListeners('console');page.removeAllListeners('requestfailed');
          page.on('pageerror',(error)=>runtime.push(`pageerror: ${error.message}`));
          page.on('console',(message)=>{if(message.type()==='error'&&!isExpectedLocalhostCspAssetError(message.text()))runtime.push(`console: ${message.text()}`);});
          page.on('requestfailed',(request)=>{const url=new URL(request.url());if(url.origin===base)runtime.push(`requestfailed: ${url.pathname}`);});
          const response=await page.goto(base+route,{waitUntil:'load'});
          record(item,viewport,'dark-http-200',response?.status()===200,`status=${response?.status()}`);
          await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';try{localStorage.setItem('theme','dark');}catch{}window.dispatchEvent(new CustomEvent('themechange',{detail:{theme:'dark'}}));});
          await page.waitForTimeout(100);
          const metrics=await page.evaluate(({tokens,textTokens,backgroundTokens})=>{
            const parse=(value)=>{const match=String(value||'').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);return match?{r:Number(match[1]),g:Number(match[2]),b:Number(match[3]),a:match[4]==null?1:Number(match[4])}:null;};
            const composite=(front,back)=>{if(!front)return back;if(front.a>=.999)return front;const a=front.a+back.a*(1-front.a);return{r:(front.r*front.a+back.r*back.a*(1-front.a))/a,g:(front.g*front.a+back.g*back.a*(1-front.a))/a,b:(front.b*front.a+back.b*back.a*(1-front.a))/a,a};};
            const channel=(value)=>{value/=255;return value<=.03928?value/12.92:((value+.055)/1.055)**2.4;};
            const luminance=(color)=>.2126*channel(color.r)+.7152*channel(color.g)+.0722*channel(color.b);
            const contrast=(left,right)=>(Math.max(luminance(left),luminance(right))+.05)/(Math.min(luminance(left),luminance(right))+.05);
            const visible=(node)=>{const style=getComputedStyle(node);const rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>.01&&rect.width>0&&rect.height>0;};
            const background=(node)=>{const layers=[];for(let current=node;current;current=current.parentElement){const color=parse(getComputedStyle(current).backgroundColor);if(color&&color.a>.001)layers.push(color);}let result={r:255,g:255,b:255,a:1};for(let index=layers.length-1;index>=0;index--)result=composite(layers[index],result);return result;};
            const textual=(node)=>{if(node.closest('svg'))return false;const text=(node.textContent||'').replace(/\s+/g,' ').trim();if(!text)return false;return Boolean(text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\s]/gu,''));};
            const threshold=(style)=>{const size=Number.parseFloat(style.fontSize)||16;const weight=Number.parseInt(style.fontWeight,10)||400;return size>=24||(size>=18.66&&weight>=700)?3:4.5;};
            const output={scrollWidth:(document.scrollingElement||document.documentElement).scrollWidth,clientWidth:(document.scrollingElement||document.documentElement).clientWidth,tokens:{}};
            for(const token of tokens){
              const bucket={visible:0,textSamples:0,textFailures:0,graphicSamples:0,graphicFailures:0,lightIslands:0,minTextContrast:null,minGraphicContrast:null};
              for(const element of document.getElementsByClassName(token)){
                if(!visible(element))continue;bucket.visible++;
                const style=getComputedStyle(element);const parentBackground=background(element.parentElement||document.body);const own=parse(style.backgroundColor);const effectiveBackground=own&&own.a>.001?composite(own,parentBackground):parentBackground;
                if(textTokens.includes(token)){
                  if(textual(element)){const foreground=parse(style.color);if(foreground){const ratio=contrast(foreground,effectiveBackground);bucket.textSamples++;bucket.minTextContrast=bucket.minTextContrast==null?ratio:Math.min(bucket.minTextContrast,ratio);if(ratio+1e-6<threshold(style))bucket.textFailures++;}}
                  const graphics=[...(element.matches('svg,path,circle,rect,line,polyline,polygon')?[element]:[]),...element.querySelectorAll('svg,path,circle,rect,line,polyline,polygon')].filter(visible);
                  for(const graphic of graphics){const graphicStyle=getComputedStyle(graphic);const color=parse(graphicStyle.stroke==='none'||!graphicStyle.stroke?graphicStyle.fill:graphicStyle.stroke)||parse(style.color);if(!color)continue;const ratio=contrast(color,effectiveBackground);bucket.graphicSamples++;bucket.minGraphicContrast=bucket.minGraphicContrast==null?ratio:Math.min(bucket.minGraphicContrast,ratio);if(ratio+1e-6<3)bucket.graphicFailures++;}
                }
                if(backgroundTokens.includes(token)){
                  const probes=[element,...element.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,span,a,button')];
                  for(const probe of probes){if(!visible(probe)||!textual(probe))continue;const probeStyle=getComputedStyle(probe);const foreground=parse(probeStyle.color);if(!foreground)continue;const ratio=contrast(foreground,background(probe));bucket.textSamples++;bucket.minTextContrast=bucket.minTextContrast==null?ratio:Math.min(bucket.minTextContrast,ratio);if(ratio+1e-6<threshold(probeStyle))bucket.textFailures++;}
                  if(luminance(effectiveBackground)>.65&&luminance(parentBackground)<.35)bucket.lightIslands++;
                }
              }
              output.tokens[token]=bucket;
            }
            return output;
          },{tokens:DARK_TOKENS,textTokens:DARK_TEXT_TOKENS,backgroundTokens:DARK_BACKGROUND_TOKENS});
          record(item,viewport,'dark-root-no-horizontal-overflow',metrics.scrollWidth<=metrics.clientWidth+1,`${metrics.scrollWidth}/${metrics.clientWidth}`);
          record(item,viewport,'dark-runtime-clean',runtime.length===0,runtime.join(' | '));
          for(const token of DARK_TOKENS){const source=metrics.tokens[token],target=darkAggregate[token];for(const key of ['visible','textSamples','textFailures','graphicSamples','graphicFailures','lightIslands'])target[key]+=source[key];for(const key of ['minTextContrast','minGraphicContrast'])if(source[key]!=null)target[key]=target[key]==null?source[key]:Math.min(target[key],source[key]);}
        }catch(error){record(item,viewport,'dark-test-execution',false,error?.stack||error?.message||String(error));}
      }
      for(const token of DARK_TOKENS){const item={route:'(dark-matrix)',target:`.${token}`};const bucket=darkAggregate[token];record(item,viewport,'dark-token-visible',bucket.visible>0,`visible=${bucket.visible}`);if(DARK_TEXT_TOKENS.includes(token)){record(item,viewport,'dark-text-samples',bucket.textSamples>0,`samples=${bucket.textSamples}`);record(item,viewport,'dark-text-contrast',bucket.textFailures===0,`failures=${bucket.textFailures} minimum=${bucket.minTextContrast==null?'n/a':bucket.minTextContrast.toFixed(2)}`);record(item,viewport,'dark-graphic-contrast',bucket.graphicFailures===0,`samples=${bucket.graphicSamples} failures=${bucket.graphicFailures} minimum=${bucket.minGraphicContrast==null?'n/a':bucket.minGraphicContrast.toFixed(2)}`);}if(DARK_BACKGROUND_TOKENS.includes(token))record(item,viewport,'dark-no-light-island',bucket.lightIslands===0,`lightIslands=${bucket.lightIslands}`);record(item,viewport,'dark-test-execution',true);}
    } finally {
      await context.close();
    }
  }
} catch (error) {
  results.push({route:'(harness)',target:'(harness)',viewport:'(harness)',contract:'harness-execution',ok:false,detail:error?.stack||error?.message||String(error)});
} finally {
  if(browser)await browser.close().catch(()=>{});
  if(server)await new Promise((resolve)=>server.close(resolve));
  await persist();
}
const failed=results.filter((result)=>!result.ok);console.log(`Nagornaya epistemic browser contracts: ${results.length-failed.length}/${results.length} PASS`);if(failed.length){for(const failure of failed)console.error(`FAIL ${failure.viewport} ${failure.target} ${failure.contract}: ${failure.detail}`);process.exit(1);}console.log('✅ Nagornaya epistemic UI browser contract passed');
