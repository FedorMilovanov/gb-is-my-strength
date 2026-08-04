from pathlib import Path
import json

CSS_MARKER = '/* NG-DARK-01 cascade-safe Chromium-confirmed utility remaps */'
OLD_SW_VERSION = 'gb-v193-offline-contract-20260801'
NEW_SW_VERSION = 'gb-v194-nagornaya-dark-20260804'
EXPECTED_IMPORTANT_COUNT = 134

css_path = Path('css/nagornaya-mobile-toc.css')
css = css_path.read_text(encoding='utf-8')
if CSS_MARKER in css:
    raise SystemExit('dark repair marker already exists')
if css.count('!important') != EXPECTED_IMPORTANT_COUNT:
    raise SystemExit(f'!important baseline drift: {css.count("!important")} != {EXPECTED_IMPORTANT_COUNT}')
css_block = '''

/* NG-DARK-01 cascade-safe Chromium-confirmed utility remaps */
html.dark body.nagornaya-page .text-blue-600{color:#93c5fd}
html.dark body.nagornaya-page .text-rose-600,
html.dark body.nagornaya-page .text-rose-700,
html.dark body.nagornaya-page .text-red-600{color:#fca5a5}
html.dark body.nagornaya-page .text-purple-600,
html.dark body.nagornaya-page .text-purple-700{color:#c4b5fd}
html.dark body.nagornaya-page .text-teal-700{color:#5eead4}
html.dark body.nagornaya-page .text-orange-700{color:#fdba74}
html.dark body.nagornaya-page .bg-stone-200{background-color:var(--color-surface-muted);color:var(--color-text);border-color:var(--color-border)}
'''
updated_css = css.rstrip() + css_block
if updated_css.count('!important') != EXPECTED_IMPORTANT_COUNT:
    raise SystemExit('cascade repair must not add !important')
css_path.write_text(updated_css, encoding='utf-8')

browser_path = Path('scripts/nagornaya-epistemic-ui-browser-test.mjs')
browser = browser_path.read_text(encoding='utf-8')
viewport_anchor = "const VIEWPORTS = [{id:'mobile-320',width:320,height:760},{id:'mobile-390',width:390,height:844},{id:'desktop-1440',width:1440,height:900}];"
constants = viewport_anchor + "\n" + '''const DARK_ROUTES=['/nagornaya/','/nagornaya/chast-1/','/nagornaya/chast-2/','/nagornaya/chast-3/','/nagornaya/chast-4/','/nagornaya/chast-5/','/nagornaya/seriya/','/nagornaya/istochniki/','/nagornaya/nakhodki/'];
const DARK_TEXT_TOKENS=['text-blue-600','text-rose-600','text-purple-600','text-purple-700','text-teal-700','text-orange-700','text-red-600','text-rose-700'];
const DARK_BACKGROUND_TOKENS=['bg-stone-200'];
const DARK_TOKENS=[...DARK_TEXT_TOKENS,...DARK_BACKGROUND_TOKENS];'''
if browser.count(viewport_anchor) != 1:
    raise SystemExit(f'viewport anchor drift: {browser.count(viewport_anchor)}')
browser = browser.replace(viewport_anchor, constants, 1)

tail = '''      }
    } finally {
      await context.close();
    }
  }
} catch (error) {'''
dark_matrix = r'''      }

      await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
      await page.addInitScript(()=>{try{localStorage.setItem('theme','dark');}catch{}});
      const darkAggregate=Object.fromEntries(DARK_TOKENS.map((token)=>[token,{visible:0,textSamples:0,textFailures:0,graphicSamples:0,graphicFailures:0,lightIslands:0,minTextContrast:null,minGraphicContrast:null}]));
      for(const route of DARK_ROUTES){
        const item={route,target:'(dark-theme)'};const runtime=[];
        try{
          page.removeAllListeners('pageerror');page.removeAllListeners('console');page.removeAllListeners('requestfailed');
          page.on('pageerror',(error)=>runtime.push(`pageerror: ${error.message}`));
          page.on('console',(message)=>{if(message.type()==='error'&&!isExpectedLocalhostCspIconError(message.text()))runtime.push(`console: ${message.text()}`);});
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
} catch (error) {'''
if browser.count(tail) != 1:
    raise SystemExit(f'dark-matrix insertion anchor drift: {browser.count(tail)}')
browser = browser.replace(tail, dark_matrix, 1)
browser_path.write_text(browser, encoding='utf-8')

sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
if sw.count(OLD_SW_VERSION) != 1:
    raise SystemExit(f'SW version anchor drift: {sw.count(OLD_SW_VERSION)}')
sw_path.write_text(sw.replace(OLD_SW_VERSION, NEW_SW_VERSION, 1), encoding='utf-8')

baseline_path = Path('migration/sw-cache-version-baseline.json')
baseline = json.loads(baseline_path.read_text(encoding='utf-8'))
if baseline.get('currentExpectedCacheVersion') != OLD_SW_VERSION or baseline.get('currentDistProductionCacheVersion') != OLD_SW_VERSION:
    raise SystemExit('SW baseline version drift')
baseline['version'] = 8
baseline['captured'] = '2026-08-04'
baseline['currentDistProductionCacheVersion'] = NEW_SW_VERSION
baseline['currentExpectedCacheVersion'] = NEW_SW_VERSION
baseline['purpose'] = 'Service Worker cache version baseline. currentExpectedCacheVersion MUST equal sw.js CACHE_VERSION at all times. v194 invalidates the precached Nagornaya CSS after the cascade-safe Chromium-confirmed dark-theme contrast repair. Source merge is not a production deployment.'
baseline_path.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

matrix_path = Path('data/offline-route-matrix.json')
matrix = json.loads(matrix_path.read_text(encoding='utf-8'))
if matrix.get('cacheVersion') != OLD_SW_VERSION:
    raise SystemExit('offline matrix cache version drift')
matrix['cacheVersion'] = NEW_SW_VERSION
matrix_path.write_text(json.dumps(matrix, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Applied cascade-safe Nagornaya dark-theme repair and SW cache bump.')
