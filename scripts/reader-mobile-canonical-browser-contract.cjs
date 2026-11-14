const fs=require('fs'),path=require('path'),http=require('http');
const {chromium,firefox,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),results=[],errors=[];
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
// CI runners do not have USERPROFILE; keep screenshots beside other QA reports.
// A caller may override the location without creating another local V-numbered copy.
const out=process.env.GB_READER_MOBILE_QA_DIR||path.join(__dirname,'..','reports','reader-mobile-canonical');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');let file=path.resolve(root,decodeURIComponent(u.pathname).slice(1));if(!path.extname(file))file=path.join(file,'index.html');if(path.relative(root,file).startsWith('..')||!fs.existsSync(file)){res.writeHead(404);return res.end('missing');}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}catch(e){res.writeHead(500);res.end(String(e));}});
const routes=[
 ['baptists','/baptisty-rossii/noch-na-kure/'],
 ['heart','/articles/chto-bibliya-nazyvaet-serdcem/'],
 ['gill','/articles/dzhon-gill-chast-1-chelovek/'],
 ['herm','/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
 ['apostasy','/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/'],
 ['lawson','/articles/steven-lawson-samoobman-i-publichnyy-golos/']
];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{
   for(const [slug,route] of routes)for(const width of [320,390,430,1440]){
    const page=await browser.newPage({viewport:{width,height:width===1440?900:844},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'});
    const row={engine:engineName,slug,width},pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    try{
     const resp=await page.goto(url+route,{waitUntil:'domcontentloaded',timeout:25000});await page.waitForTimeout(250);row.http=resp.status();
     if(width<1200){
      const bar=page.locator('[data-reader-mobile-speed]');
      if(await bar.count()!==1)throw Error('missing shared mobile speed owner');
      const play=bar.locator('.reader-mobile-play');
      const before=await play.boundingBox();
      const badge=bar.locator('.reader-mobile-speed-badge');
      const menuBtn=bar.locator('[data-reader-mobile-menu-target]');
      const settings=page.locator('.reader-mobile-action[aria-label^="Настройки чтения"]');
      if(await play.count()!==1||await badge.count()!==1||await menuBtn.count()!==1||await settings.count()!==1)throw Error('canonical controls missing or duplicate');
      const nav=await menuBtn.locator('svg path').getAttribute('d');
      if(nav!=='M4 7h16M4 12h16M4 17h16')throw Error('noncanonical hamburger');
      if(before.width>44)throw Error('oversized Play='+before.width);
      if(await page.locator('[data-fc-action="scroll-top"]:visible').count())throw Error('unwanted back-to-top arrow');
      if(await page.locator('.mobile-bottom-bar .gb-theme-toggle:visible,.hmbar .gb-theme-toggle:visible').count())throw Error('theme still occupies toolbar');
      await badge.click();await page.waitForTimeout(100);
      const state=await page.evaluate(()=>{
        const b=document.querySelector('[data-reader-mobile-speed]'),rail=b.querySelector('.reader-mobile-speedrail'),m=b.querySelector('.reader-mobile-menu-trigger'),play=b.querySelector('.reader-mobile-play'),badge=b.querySelector('.reader-mobile-speed-badge');
        const rates=[...rail.querySelectorAll('[data-speed]')].map(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return{x:r.x,y:r.y,w:r.width,h:r.height,color:s.color,active:x.getAttribute('aria-checked')}});
        const a=rail.getBoundingClientRect(),p=play.getBoundingClientRect();
        return{open:b.classList.contains('speed-open'),rateCount:rates.length,rates,rail:{x:a.x,y:a.y,w:a.width,h:a.height,right:a.right},play:{x:p.x,y:p.y,w:p.width,h:p.height,left:p.left},menuInert:m.inert,menuVisible:getComputedStyle(m).opacity,scrollWidth:document.documentElement.scrollWidth,viewWidth:innerWidth,badgeWidth:badge.getBoundingClientRect().width};
      });
      row.state=state;
      if(!state.open||state.rateCount!==6)throw Error('speed rail did not open with 6 rates');
      if(state.rates.some((c,i)=>i>0&&(c.x<=state.rates[i-1].x||Math.abs(c.y-state.rates[0].y)>3)))throw Error('not sideways/horizontal');
      if(state.rail.right>state.play.left+2)throw Error('rail overlaps Play');
      if(state.scrollWidth>state.viewWidth+2)throw Error('page overflow');
      if(!state.menuInert)throw Error('hidden menu not inert');
      const after=await play.boundingBox();
      if(Math.abs(after.x-before.x)>1||Math.abs(after.y-before.y)>1)throw Error('Play moved opening speed');
      if(engineName==='chromium'&&['baptists','heart','herm'].includes(slug)&&width===390)await page.screenshot({path:path.join(out,slug+'-mobile-v12-speed-open.png'),animations:'disabled'});
      await bar.locator('.reader-mobile-speed-rate[data-speed="1.75"]').click();
      await page.waitForTimeout(300);
      const stored=await page.evaluate(()=>localStorage.getItem('gb:audio:rate'));
      if(stored!=='1.75')throw Error('rate not persisted');
      row.rate=stored;
      // Existing settings sheets (both engines) must offer all 3 canonical themes.
      await settings.click({timeout:4000});
      await page.waitForTimeout(160);
      const count=await page.locator('[data-hm-theme]:visible,[data-gill-theme-btn]:visible').count();
      row.settingsThemeChoices=count;
      if(count!==3)throw Error('three themes not inside settings: '+count);
      if(engineName==='chromium'&&slug==='herm'&&width===390)await page.screenshot({path:path.join(out,'herm-mobile-v12-settings.png'),animations:'disabled'});
     }else{
      const play=page.locator('.gb-ember:visible').first();
      await play.hover();await page.waitForTimeout(180);
      const menu=play.locator('xpath=..').locator('.gb-ember-expand.is-open');
      if(!await menu.count())throw Error('desktop historic speed popover absent');
      const state=await menu.evaluate(node=>{const s=getComputedStyle(node);return{direction:s.flexDirection,rates:[...node.querySelectorAll('[data-speed]')].map(x=>({x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y})),choices:node.querySelectorAll('[data-speed]').length}});
      row.state=state;
      if(state.choices!==6||state.direction!=='column'||state.rates.some((x,i)=>i>0&&x.y<=state.rates[i-1].y))throw Error('desktop original vertical rate regression');
     }
     if(pageErrors.length)throw Error('browser page exception '+pageErrors.slice(0,3).join(';'));
     row.pass=true;
    }catch(e){row.pass=false;row.error=String(e).slice(0,950);errors.push(row);}
    finally{results.push(row);await page.close()}
   }
  }finally{await browser.close()}
 }
 const output={cases:results.length,passes:results.length-errors.length,failures:errors,results};
 fs.writeFileSync(path.join(out,'V12_CANONICAL_BROWSER.json'),JSON.stringify(output,null,2));
 console.log(JSON.stringify({cases:output.cases,passes:output.passes,failures:errors.slice(0,22).map(x=>({engine:x.engine,slug:x.slug,width:x.width,error:x.error}))},null,2));
 if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2}).finally(()=>server.close());
