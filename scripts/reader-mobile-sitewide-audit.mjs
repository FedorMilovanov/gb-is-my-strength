import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),DIST=path.join(ROOT,'dist');
const OUT=path.join(ROOT,'reports','reader-mobile-sitewide-audit');fs.mkdirSync(OUT,{recursive:true});
const ROUTES=[['grok','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],['gill','/articles/dzhon-gill-chast-1-chelovek/'],['sermon','/nagornaya/chast-1/'],['heart','/articles/krajne-li-isporcheno-serdce/'],['pastor','/articles/20-antisovetov-pastoru/'],['baptist-chapter','/baptisty-rossii/goneniya-i-sovest/'],['baptists','/baptisty-rossii/']];
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const srv=http.createServer((req,res)=>{
 const url=decodeURIComponent((req.url||'/').split('?')[0]),file=path.resolve(DIST,'.'+(url.endsWith('/')?url+'index.html':url)),rel=path.relative(DIST,file);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+srv.address().port,result=[];
for(const [engine,driver] of Object.entries({chromium,webkit,firefox})){
 const browser=await driver.launch({headless:true});
 for(const width of [320,375,390,430,480]){
  const height=width===320?640:844;
  for(const [name,route] of ROUTES){
   if(process.env.GB_MOBILE_AUDIT_ONLY && process.env.GB_MOBILE_AUDIT_ONLY !== [engine,width,name].join(':'))continue;
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:engine!=='firefox',deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(6000);
   // Only the local built Product belongs to this hermetic browser contract.
   // Wait until its styles/assets settle before testing precise tap geometry;
   // the separate first-paint suite owns intentionally early loading states.
   await page.route(url=>!url.toString().startsWith(origin),route=>route.abort('blockedbyclient'));
   const row={engine,width,height,name,route,fail:[],warnings:[],measure:null,anchor:null,settings:null,errors:[]};
   page.on('pageerror',err=>row.errors.push(String(err).slice(0,180)));
   try{
    const response=await page.goto(origin+route,{waitUntil:'networkidle',timeout:20000});if(response.status()!==200)row.fail.push('HTTP '+response.status());
    await page.waitForTimeout(150);
    row.measure=await page.evaluate(()=>{
     const h=document.documentElement;
     const cols=[...document.querySelectorAll('main,article,.article-main,.page-wrap')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cl:String(e.className).slice(0,55),x:Math.round(r.x),w:Math.round(r.width),right:Math.round(r.right)}}).filter(x=>x.w>100);
     const bottom=[...document.querySelectorAll('.mobile-bottom-bar,.bottom-bar,.gbs2-bottom,.gb-mobile-bar,[data-mobile-chrome]')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>100&&r.height>10&&s.visibility!=='hidden'&&s.display!=='none'}).map(e=>{const r=e.getBoundingClientRect();return {selector:String(e.className).slice(0,60),top:Math.round(r.top),height:Math.round(r.height),position:getComputedStyle(e).position}});
     const controls=[...document.querySelectorAll('button,[role="button"]')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.y>=0&&r.y<innerHeight&&s.visibility!=='hidden'&&s.display!=='none'}).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,cl:String(e.className).slice(0,40),label:e.getAttribute('aria-label')||e.textContent?.trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y)}});
     return {innerWidth,clientWidth:h.clientWidth,scrollWidth:h.scrollWidth,innerHeight,cols:cols.slice(0,8),bottom,smallControls:controls.filter(x=>x.w<24||x.h<24).slice(0,10),controls:controls.slice(0,20)};
    });
    if(row.measure.scrollWidth>row.measure.clientWidth+2)row.fail.push('horizontal overflow '+(row.measure.scrollWidth-row.measure.clientWidth));
    if(row.measure.smallControls.length)row.warnings.push('tiny controls '+row.measure.smallControls.map(x=>x.id||x.cl).join(','));
    if(['gill','heart','pastor','baptist-chapter'].includes(name)){
      // The fixed mobile top bar needs one inset on the outer canvas only.
      // A former descendant selector repeated the 72px inset on main and
      // article, creating a 216px blank lead on Heart pages.
      row.canvasInset=await page.evaluate(()=>{
        const root=document.querySelector('[data-gill-v16]');
        const canvas=root?.querySelector('.page-wrap');
        if(!canvas)return null;
        const px=e=>parseFloat(getComputedStyle(e).paddingTop)||0;
        const bottom=e=>parseFloat(getComputedStyle(e).paddingBottom)||0;
        const owner=px(canvas),bottomOwner=bottom(canvas);
        const nested=[...canvas.querySelectorAll('main,article')].filter(e=>getComputedStyle(e).display!=='none')
          .map(e=>({tag:e.tagName,cl:String(e.className).slice(0,45),top:Math.round(px(e)),bottom:Math.round(bottom(e))}));
        const hero=canvas.querySelector('#gbs2Hero');
        return {
          owner,bottomOwner,nested,
          bodyBottom:bottom(document.body),rootBottom:bottom(root),
          heroY:hero?.getBoundingClientRect().top??null
        };
      });
      if(!row.canvasInset||row.canvasInset.owner<50||row.canvasInset.nested.some(e=>Math.abs(e.top-row.canvasInset.owner)<1))
        row.fail.push('nested mobile reader duplicates outer toolbar top inset');
      // The fixed lower bar also requires one reserved inset, never one per
      // nested article, main, root and body (formerly 330-468px wasted).
      const b=row.canvasInset;
      if(b&&(b.bottomOwner<90||b.bodyBottom>2||b.rootBottom>2||
        b.nested.some(e=>Math.abs(e.bottom-b.bottomOwner)<1)))
        row.fail.push('nested reader duplicates bottom-bar clearance');
    }
    if(name==='gill'||name==='pastor'||name==='baptist-chapter'){
      // Real fixed chrome, not merely a rendered button: the manuscript
      // texture once overrode Play's position to relative and placed the
      // top bar AFTER a very long article while the bottom bar stayed fixed.
      row.seriesChrome=await page.evaluate(()=>{
        const root=document.querySelector('.gbs2-world[data-gill-v16]');
        const top=root?.querySelector('.mobile-top-bar[data-gill-mobile-bar]');
        const bottom=root?.querySelector('.mobile-bottom-bar[data-gill-mobile-bar]');
        const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);
          return {position:s.position,top:r.top,bottom:r.bottom,display:s.display,opacity:s.opacity};};
        const play=top?.querySelector('.gb-ember'),pr=play?.getBoundingClientRect();
        const hit=pr&&document.elementFromPoint(pr.x+pr.width/2,pr.y+pr.height/2);
        const badge=top?.querySelector('.mobile-spdbadge'),br=badge?.getBoundingClientRect();
        const badgeHit=br&&document.elementFromPoint(br.x+br.width/2,br.y+br.height/2);
        return {scrollY,top:box(top),bottom:box(bottom),
          playHit:!!(play&&(play===hit||play.contains(hit))),
          playCenter:pr&&{x:pr.x+pr.width/2,y:pr.y+pr.height/2},
          blockedBy:hit?.getAttribute('class')||hit?.tagName||null,
          badgeHit:!!(badge&&(badge===badgeHit||badge.contains(badgeHit)))};
      });
      const c=row.seriesChrome;
      if(!c.top||c.top.position!=='fixed'||Math.abs(c.top.top)>4||!c.playHit)
        row.fail.push('series mobile Play toolbar is not fixed and hit-testable');
      if(!c.bottom||c.bottom.position!=='fixed'||Math.abs(c.bottom.bottom-height)>4)
        row.fail.push('series mobile bottom toolbar is not fixed to viewport');
    }
    if((name==='heart'||name==='pastor')&&width===390){
      const anchor=page.locator('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]').first();
      if(await anchor.count()){
       // A loaded DOM is not yet a stable touch surface: WebKit/Linux may
       // still apply font-driven layout and browser scroll correction.
       await page.evaluate(async()=>{await document.fonts.ready;});
       await page.waitForFunction(()=>document.documentElement.dataset.gbArticleInteractionsReady==='1');
       // Use exactly one native scroll operation. Stacking Playwright's
       // scrollIntoViewIfNeeded with another explicit scroll leaves competing
       // scroll restorations in WebKit and changes the target under the tap.
       await anchor.evaluate(e=>{
         const r=e.getBoundingClientRect();
         window.scrollTo({top:window.scrollY+r.top+r.height/2-innerHeight/2,behavior:'instant'});
       });
       // A scroll action can finish while asynchronously populated content
       // is still changing height. Require stable scroll + anchor geometry
       // over consecutive painted frames before the native touchscreen tap.
       await anchor.evaluate(async e=>{
         let prev=null,stable=0;
         for(let frame=0;frame<200;frame++){
           await new Promise(resolve=>requestAnimationFrame(resolve));
           const r=e.getBoundingClientRect();
           const next=[r.x,r.y,r.width,r.height,scrollX,scrollY,document.documentElement.scrollHeight];
           const same=prev&&next.every((x,i)=>Math.abs(x-prev[i])<.3);
           stable=same?stable+1:0;
           if(stable>=15)return;
           prev=next;
         }
         throw new Error('anchor/scroll geometry not settled after 200 frames');
       });
       row.anchor=await anchor.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,inside:y>=0&&y<innerHeight,hit:hit?.outerHTML.slice(0,100),correct:hit===e||e.contains(hit)}});
       if(!row.anchor.inside||!row.anchor.correct)row.fail.push('heading anchor center is not a hit target');
       else try{
        // We have just verified the actual visible hit target. Deliver an
        // exact touchscreen gesture at a fresh center instead of asking the
        // desktop-centric locator actionability loop to keep scrolling.
        const touch=await anchor.evaluate(e=>{
          const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
          const hit=document.elementFromPoint(x,y);
          return {x,y,owned:hit===e||e.contains(hit),scrollY,anchorTop:r.top,innerHeight,visualTop:visualViewport?.offsetTop,visualScale:visualViewport?.scale};
        });
        if(!touch.owned)throw new Error('heading anchor center changed before native touch');
        row.anchor.beforeTouch=touch;
        await page.evaluate(()=>{
          window.__gbMobileAnchorTrace=[];
          ['pointerdown','pointerup','touchstart','touchend','click'].forEach(type=>
            window.addEventListener(type,event=>{
              const el=document.querySelector('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]');
              window.__gbMobileAnchorTrace.push({
                type,target:event.target?.tagName||'',
                anchorTop:el?.getBoundingClientRect().top,
                scrollY,owned:!!event.target?.closest?.('.heading-anchor')
              });
            },{capture:true}));
        });
        await page.touchscreen.tap(touch.x,touch.y);
        await page.waitForTimeout(90);
        row.anchor.events=await page.evaluate(()=>window.__gbMobileAnchorTrace||[]);
        row.anchor.after=await page.evaluate(()=>({hash:location.hash,toast:document.getElementById('anchor-copy-toast')?.classList.contains('is-visible')}));
        if(!row.anchor.after.hash&&!row.anchor.after.toast)row.fail.push('heading anchor tap produced no feedback or fragment');
       }catch(e){row.fail.push('heading anchor tap '+String(e).slice(0,500));}
      }
    }
    if((name==='heart'||name==='pastor')&&width===390){
      // The toolbar can translate out, but article padding must never
      // animate when gbs2-tbhidden toggles: a real finger otherwise lands
      // on a different heading after scroll anchoring.
      row.chromeGeometry=await page.evaluate(async()=>{
        const root=document.querySelector('[data-gill-v16]'),main=root?.querySelector('main.article-main');
        if(!root||!main)return null;
        const wasHidden=root.classList.contains('gbs2-tbhidden');
        const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
        const read=()=>({topPadding:parseFloat(getComputedStyle(main).paddingTop)||0});
        root.classList.remove('gbs2-tbhidden');
        await frame();await frame();const visible=read();
        root.classList.add('gbs2-tbhidden');
        await frame();await frame();const hidden=read();
        root.classList.toggle('gbs2-tbhidden',wasHidden);
        return {visible,hidden};
      });
      if(row.chromeGeometry&&Math.abs(row.chromeGeometry.visible.topPadding-row.chromeGeometry.hidden.topPadding)>.5)
        row.fail.push('top-bar hide modifies article padding and shifts touch targets');
    }
    if(name==='grok'&&width===390){
      // The mobile toolbar may slide out, but hiding it must not move the
      // reading surface. Moving article padding loses in-flight touch targets.
      row.grokChromeGeometry=await page.evaluate(async()=>{
        const root=document.body,main=document.querySelector('main.article-main--hrail');
        if(!main)return null;
        const old=root.classList.contains('hm-tbhidden');
        const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
        const measure=()=>({
          padding:parseFloat(getComputedStyle(main).paddingTop)||0,
          y:main.getBoundingClientRect().y
        });
        root.classList.remove('hm-tbhidden');
        await frame();await frame();const shown=measure();
        root.classList.add('hm-tbhidden');
        await frame();await frame();const hidden=measure();
        root.classList.toggle('hm-tbhidden',old);
        return {shown,hidden};
      });
      const c=row.grokChromeGeometry;
      if(c&&(Math.abs(c.shown.padding-c.hidden.padding)>.5||Math.abs(c.shown.y-c.hidden.y)>.5))
        row.fail.push('Grok toolbar hide shifts article reading geometry');
    }
    if(name==='grok'&&width===390){
      const legal=await page.evaluate(()=>{
        const n=document.querySelector('.article-header > .notice');
        const details=n?.querySelector('.notice__details'),pdf=n?.querySelector('a[href*="TMSJ-Volume"]');
        const all=n?.textContent||'';
        return {exists:!!n,rights:all.includes('Разрешение относится к данной публикации'),
          source:all.includes('Abner Chou'),pdf:!!pdf,
          extra:!!details,collapsed:details?.open===false,
          noticeHeight:Math.round(n?.getBoundingClientRect().height||0)};
      });
      row.legal=legal;
      if(!(legal.exists&&legal.rights&&legal.source&&legal.pdf&&legal.extra&&legal.collapsed))
        row.fail.push('licensed source/PDF or native disclosure unavailable');
      const summary=page.locator('.notice__details > summary');
      if(await summary.count()){
        await summary.tap();
        if(!(await page.locator('.notice__details').evaluate(e=>e.open)))row.fail.push('native source notes do not expand');
        if(!(await page.locator('.notice__details-content').innerText()).includes('fedormilovanov@yandex.ru'))
          row.fail.push('editorial contact vanished from native disclosure');
        await summary.tap();
      }
      const badge=page.locator('#hmSpdBadge');
      if(await badge.isVisible()){
        const bounds=await badge.boundingBox();
        const play=await page.locator('.hm-playwrap .hm-ember').boundingBox();
        row.speed={badge:bounds,play};
        row.speed.initial=await page.locator('#hmSpeedrail').evaluate(e=>({inert:e.inert,hidden:e.getAttribute('aria-hidden')}));
        if(!row.speed.initial.inert||row.speed.initial.hidden!=='true')
          row.fail.push('closed speed rail is keyboard accessible');
        if(!bounds||bounds.width<44||bounds.height<44)
          row.fail.push('speed target smaller than 44x44');
        if(!play||play.width<40||play.height<40)
          row.fail.push('Play control smaller than 40x40');
        row.speed.hits=await page.evaluate(()=>{
          const badge=document.querySelector('#hmSpdBadge');
          const play=document.querySelector('.hm-playwrap .hm-ember');
          const hit=el=>{
            if(!el)return false;
            const r=el.getBoundingClientRect();
            const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return target===el||el.contains(target);
          };
          const a=badge?.getBoundingClientRect(),b=play?.getBoundingClientRect();
          const overlap=a&&b&&Math.max(a.left,b.left)<Math.min(a.right,b.right)
            &&Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom);
          return {badge:hit(badge),play:hit(play),overlap:!!overlap};
        });
        if(!row.speed.hits.badge||!row.speed.hits.play||row.speed.hits.overlap)
          row.fail.push('Play and speed are not independent hit targets');
        await badge.tap();
        const expanded=await page.locator('.hmtop').evaluate(e=>e.classList.contains('speed-open'));
        row.speed.open=await page.locator('#hmSpeedrail').evaluate(e=>({inert:e.inert,hidden:e.getAttribute('aria-hidden')}));
        if(!expanded||row.speed.open.inert||row.speed.open.hidden==='true')
          row.fail.push('speed badge failed to open accessible rate selector');
        else{
          await page.locator('#hmSpeedrail [data-speed="1.25"]').tap();
          const selected=await badge.innerText();
          const checked=await page.locator('#hmSpeedrail [data-speed="1.25"]').getAttribute('aria-checked');
          if(!selected.includes('1.25')||checked!=='true')row.fail.push('speech rate choice not synchronized');
          await page.waitForFunction(()=>document.querySelector('#hmSpeedrail')?.inert===true,null,{timeout:3000});
          row.speed.closed=await badge.getAttribute('aria-expanded');
          if(row.speed.closed!=='false')row.fail.push('speed disclosure does not close accessibly');
        }
      }
    }
    if(name==='grok'&&width===390){
      const settings=page.locator('#hmSettingsBtn');
      if(await settings.isVisible()){await settings.tap();await page.waitForTimeout(360);row.settings=await page.evaluate(()=>{const s=document.querySelector('#hmSettings'),r=s?.getBoundingClientRect();return {open:s?.classList.contains('is-open'),y:r?.y,h:r?.height,scrollWidth:document.documentElement.scrollWidth,inert:s?.inert}});if(!row.settings.open)row.fail.push('settings did not open from tap');await page.screenshot({path:path.join(OUT,engine+'-'+width+'-grok-settings.png')});await page.keyboard.press('Escape');}
    }
    if(name==='grok'&&width===390){
      const toc=page.locator('#hmSectionBtn');
      if(await toc.isVisible()){
        await toc.tap();await page.waitForTimeout(260);
        const shown=await page.evaluate(()=>document.getElementById('hmSheet')?.classList.contains('is-open'));
        if(!shown)row.fail.push('toc did not open on native section-button tap');
        await page.keyboard.press('Escape');
      }
    }
    if(width===390&&['grok','heart','sermon','baptists'].includes(name)){
      // Visual evidence is only valid after font/layout settlement. The site
      // has smooth scrolling, so scrollTo(x,y) can capture a mid-animation
      // frame rather than the article's actual end.
      await page.goto(origin+route,{waitUntil:'networkidle',timeout:20000});
      await page.evaluate(async()=>{
        await document.fonts.ready;
        window.scrollTo({top:0,behavior:'instant'});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      await page.screenshot({path:path.join(OUT,engine+'-'+width+'-'+name+'-top.png'),animations:'disabled'});
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await page.waitForFunction(()=>{
        const end=Math.max(0,document.documentElement.scrollHeight-innerHeight);
        return Math.abs(scrollY-end)<=2;
      },null,{timeout:5000});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      row.endScreenshot=await page.evaluate(()=>({
        scrollY,expected:Math.max(0,document.documentElement.scrollHeight-innerHeight)
      }));
      if(Math.abs(row.endScreenshot.scrollY-row.endScreenshot.expected)>2)
        row.fail.push('end screenshot is not at document end');
      await page.screenshot({path:path.join(OUT,engine+'-'+width+'-'+name+'-end.png'),animations:'disabled'});
    }
   }catch(e){row.fail.push('execution '+String(e).slice(0,220));}
   result.push(row);await context.close();
  }
 }
 await browser.close();
}
await new Promise(r=>srv.close(r));fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({cases:result.length,failed:result.filter(x=>x.fail.length).map(x=>({engine:x.engine,width:x.width,name:x.name,fail:x.fail,anchor:x.anchor})),warnings:result.filter(x=>x.warnings.length).map(x=>({engine:x.engine,width:x.width,name:x.name,warnings:x.warnings}))},null,2));

if(result.some(row=>row.fail.length)) process.exitCode=1;

// The existing three-browser mobile CI is the WebKit owner for the same
// cross-book contract that engine:sweep checks in Chromium-only CI jobs.
// A filtered local witness must remain narrow, so do not expand it to 126
// unrelated cases when GB_MOBILE_AUDIT_ONLY selects one scenario.
if (!process.exitCode && !process.env.GB_MOBILE_AUDIT_ONLY) {
  const { spawnSync } = await import('node:child_process');
  const layout = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'series-layout-browser-contract.mjs')], {
    cwd: ROOT, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, GB_LAYOUT_ENGINES: 'chromium,webkit' },
  });
  if (layout.error) throw layout.error;
  if (layout.status !== 0) process.exitCode = layout.status || 1;
}
