from pathlib import Path

css_path = Path('public/css/site.css')
audit_path = Path('scripts/nagornaya-visual-parity-audit.js')
browser_path = Path('scripts/nagornaya-epistemic-ui-browser-test.mjs')
css = css_path.read_text(encoding='utf-8')
audit = audit_path.read_text(encoding='utf-8')
browser = browser_path.read_text(encoding='utf-8')

marker = '/* NAGORNAYA DARK CONFIRMED TOKENS — browser authority 2026-08-04 */'
if marker in css:
    raise SystemExit('Nagornaya dark CSS marker already present')
css_block = '''

/* NAGORNAYA DARK CONFIRMED TOKENS — browser authority 2026-08-04 */
html.dark body.nagornaya-page .text-blue-600{color:#93c5fd}
html.dark body.nagornaya-page .text-rose-600{color:#fda4af}
html.dark body.nagornaya-page .text-purple-600{color:#d8b4fe}
html.dark body.nagornaya-page .text-purple-700{color:#d8b4fe}
html.dark body.nagornaya-page .text-teal-700{color:#5eead4}
html.dark body.nagornaya-page .bg-stone-200{background-color:#292524}
html.dark body.nagornaya-page .text-orange-700{color:#fdba74}
html.dark body.nagornaya-page .text-red-600{color:#fca5a5}
html.dark body.nagornaya-page .text-rose-700{color:#fda4af}
'''
css = css.rstrip() + css_block + '\n'

audit_anchor = "mustNotExist('src/components/nagornaya/NagornayaPageMain.astro', 'old shared raw-fragment NagornayaPageMain retired');"
if audit.count(audit_anchor) != 1:
    raise SystemExit('visual audit insertion anchor drift')
audit_insert = '''const confirmedDarkCss = read('public/css/site.css');
const confirmedDarkTokens = {
  'text-blue-600': 'color:#93c5fd',
  'text-rose-600': 'color:#fda4af',
  'text-purple-600': 'color:#d8b4fe',
  'text-purple-700': 'color:#d8b4fe',
  'text-teal-700': 'color:#5eead4',
  'bg-stone-200': 'background-color:#292524',
  'text-orange-700': 'color:#fdba74',
  'text-red-600': 'color:#fca5a5',
  'text-rose-700': 'color:#fda4af',
};
must(confirmedDarkCss, '/* NAGORNAYA DARK CONFIRMED TOKENS — browser authority 2026-08-04 */', 'confirmed dark-token authority marker');
for (const [token, declaration] of Object.entries(confirmedDarkTokens)) {
  must(confirmedDarkCss, `html.dark body.nagornaya-page .${token}{${declaration}}`, `confirmed dark selector: ${token}`);
}

'''
audit = audit.replace(audit_anchor, audit_insert + audit_anchor, 1)

cases_anchor = "];\nconst VIEWPORTS = [{id:'mobile-320'"
if browser.count(cases_anchor) != 1:
    raise SystemExit('browser DARK_CASES insertion anchor drift')
dark_cases = '''];
const DARK_CASES = [
  { route:'/nagornaya/chast-1/', tokens:['text-blue-600'] },
  { route:'/nagornaya/chast-2/', tokens:['text-orange-700'] },
  { route:'/nagornaya/chast-3/', tokens:['text-purple-600','text-purple-700','bg-stone-200'] },
  { route:'/nagornaya/chast-5/', tokens:['text-rose-600','text-rose-700','bg-stone-200'] },
  { route:'/nagornaya/istochniki/', tokens:['text-red-600'] },
  { route:'/nagornaya/nakhodki/', tokens:['text-teal-700','text-blue-600'] },
];
const VIEWPORTS = [{id:'mobile-320'\n'''
browser = browser.replace(cases_anchor, dark_cases, 1)

old_csp = '''function isExpectedLocalhostCspIconError(text){
  if(!text.includes('violates the following Content Security Policy directive'))return false;
  for(const url of EXPECTED_LOCALHOST_CSP_ICON_URLS){if(text.includes(`'${url}'`))return true;}
  return false;
}
'''
new_csp = '''function isExpectedLocalhostCspIconError(text){
  if(!text.includes('violates the following Content Security Policy directive'))return false;
  if(text.includes("Loading the image 'https://gospod-bog.ru/"))return true;
  for(const url of EXPECTED_LOCALHOST_CSP_ICON_URLS){if(text.includes(`'${url}'`))return true;}
  return false;
}
'''
if browser.count(old_csp) != 1:
    raise SystemExit('browser CSP helper anchor drift')
browser = browser.replace(old_csp, new_csp, 1)

function_anchor = '\nlet browser;\nlet server;\n'
if browser.count(function_anchor) != 1:
    raise SystemExit('browser function insertion anchor drift')
dark_function = r'''
async function verifyDarkResidual(page,viewport,base){
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  for(const item of DARK_CASES){
    const runtime=[];
    page.removeAllListeners('pageerror');page.removeAllListeners('console');page.removeAllListeners('requestfailed');
    page.on('pageerror',(error)=>runtime.push(`pageerror: ${error.message}`));
    page.on('console',(message)=>{if(message.type()==='error'&&!isExpectedLocalhostCspIconError(message.text()))runtime.push(`console: ${message.text()}`);});
    page.on('requestfailed',(request)=>{const url=new URL(request.url());if(url.origin===base)runtime.push(`requestfailed: ${url.pathname}`);});
    const evidence={route:item.route,target:'(dark-residual)'};
    try{
      const response=await page.goto(base+item.route,{waitUntil:'load'});
      record(evidence,viewport,'dark-http-200',response?.status()===200,`status=${response?.status()}`);
      await page.evaluate(()=>{try{localStorage.setItem('theme','dark');}catch{}document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';window.dispatchEvent(new CustomEvent('themechange',{detail:{theme:'dark'}}));});
      await page.waitForTimeout(150);
      const measured=await page.evaluate((tokens)=>{
        const parse=(value)=>{const match=String(value||'').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/i);return match?{r:+match[1],g:+match[2],b:+match[3],a:match[4]==null?1:+match[4]}:{r:0,g:0,b:0,a:0};};
        const composite=(fg,bg)=>{const a=fg.a+bg.a*(1-fg.a);return a?{r:(fg.r*fg.a+bg.r*bg.a*(1-fg.a))/a,g:(fg.g*fg.a+bg.g*bg.a*(1-fg.a))/a,b:(fg.b*fg.a+bg.b*bg.a*(1-fg.a))/a,a}:{r:255,g:255,b:255,a:1};};
        const channel=(value)=>{const x=value/255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4;};
        const luminance=(rgb)=>.2126*channel(rgb.r)+.7152*channel(rgb.g)+.0722*channel(rgb.b);
        const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
        const visible=(el)=>{const cs=getComputedStyle(el),box=el.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>.01&&box.width>0&&box.height>0;};
        const background=(start)=>{let node=start;const layers=[];while(node&&node.nodeType===1){const color=parse(getComputedStyle(node).backgroundColor);if(color.a>.001)layers.push(color);node=node.parentElement;}let result={r:255,g:255,b:255,a:1};for(let index=layers.length-1;index>=0;index--)result=composite(layers[index],result);return result;};
        const emojiOnly=(text)=>Boolean(text)&&/^(?:[\p{Extended_Pictographic}\uFE0F\u200D\s])+$/u.test(text);
        const threshold=(cs)=>{const size=parseFloat(cs.fontSize)||16,weight=parseInt(cs.fontWeight,10)||400;return size>=24||(size>=18.66&&weight>=700)?3:4.5;};
        const output={};
        for(const token of tokens){
          const nodes=[...document.getElementsByClassName(token)].filter(visible);
          if(token.startsWith('bg-')){
            const samples=nodes.map((node)=>{const bg=background(node);return{luminance:luminance(bg),rgb:[Math.round(bg.r),Math.round(bg.g),Math.round(bg.b)]};});
            output[token]={visible:nodes.length,lightIslands:samples.filter((sample)=>sample.luminance>.35).length,samples};
          }else{
            const samples=nodes.map((node)=>{const text=(node.textContent||'').replace(/\s+/g,' ').trim();const cs=getComputedStyle(node);const ratio=contrast(parse(cs.color),background(node));return{text,emojiOnly:emojiOnly(text),hasGraphic:Boolean(node.querySelector('svg,img,canvas')),ratio,required:threshold(cs)};});
            const textual=samples.filter((sample)=>sample.text&&!sample.emojiOnly);
            output[token]={visible:nodes.length,textual:textual.length,failures:textual.filter((sample)=>sample.ratio+1e-6<sample.required),minimum:textual.length?Math.min(...textual.map((sample)=>sample.ratio)):null,samples};
          }
        }
        return{dark:document.documentElement.classList.contains('dark'),overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),tokens:output};
      },item.tokens);
      record(evidence,viewport,'dark-theme-applied',measured.dark);
      record(evidence,viewport,'dark-no-horizontal-overflow',measured.overflow<=1,`overflow=${measured.overflow}`);
      for(const token of item.tokens){
        const result=measured.tokens[token];const tokenEvidence={route:item.route,target:`.${token}`};
        record(tokenEvidence,viewport,'dark-token-visible',result.visible>0,`visible=${result.visible}`);
        if(token.startsWith('bg-'))record(tokenEvidence,viewport,'dark-no-light-island',result.visible>0&&result.lightIslands===0,JSON.stringify(result.samples));
        else{
          record(tokenEvidence,viewport,'dark-text-samples-present',result.textual>0,`textual=${result.textual}`);
          record(tokenEvidence,viewport,'dark-text-contrast',result.textual>0&&result.failures.length===0,`minimum=${result.minimum?.toFixed(2)} failures=${JSON.stringify(result.failures.slice(0,3))}`);
        }
      }
      record(evidence,viewport,'dark-runtime-clean',runtime.length===0,runtime.join(' | '));
    }catch(error){record(evidence,viewport,'dark-test-execution',false,error?.stack||error?.message||String(error));}
  }
}
'''
browser = browser.replace(function_anchor, '\n' + dark_function + function_anchor, 1)

loop_anchor = '''      }
    } finally {
      await context.close();
'''
if browser.count(loop_anchor) != 1:
    raise SystemExit(f'browser loop anchor drift: {browser.count(loop_anchor)}')
browser = browser.replace(loop_anchor, '''      }
      await verifyDarkResidual(page,viewport,base);
    } finally {
      await context.close();
''', 1)

css_path.write_text(css, encoding='utf-8')
audit_path.write_text(audit, encoding='utf-8')
browser_path.write_text(browser, encoding='utf-8')
