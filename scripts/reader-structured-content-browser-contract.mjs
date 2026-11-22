import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const shots = process.env.READER_STRUCTURED_SHOTS || path.join(root, '.cache', 'reader-structured-shots');
fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const f = path.resolve(dist, '.' + (u.endsWith('/') ? u + 'index.html' : u));
    const rel = path.relative(dist, f);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500).end(String(e)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port + '/articles/dzhon-gill-istoricheskiy-kontekst/';
let scenarios = 0;
try {
  for (const [engine, driver] of Object.entries({ chromium, webkit })) {
    const browser = await driver.launch();
    for (const width of [320, 390, 430, 768, 1440]) {
      for (const theme of ['light', 'dark']) {
        const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 500, hasTouch: width < 500, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        assert.equal(response.status(), 200);
        if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
        await page.waitForTimeout(90);
        const info = await page.evaluate(() => {
          const all = [...document.querySelectorAll('article.article-body table[data-responsive-layout="stacked-prose"]')];
          return { overflow: document.documentElement.scrollWidth - innerWidth, entries: all.map(t => {
            const r = t.getBoundingClientRect(), parent = t.parentElement.getBoundingClientRect();
            const headings = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim());
            const rows = [...t.querySelectorAll('tbody tr')];
            const cells = rows.flatMap(x => [...x.querySelectorAll('td')]);
            const labels = rows.every(x => [...x.querySelectorAll('td')].every((c, i) => c.dataset.label === headings[i]));
            const pseudo = getComputedStyle(cells[1], '::before');
            return {
              rows: rows.length, cells: cells.length, labels, w: r.width, parentW: parent.width,
              scroll: t.parentElement.scrollWidth - t.parentElement.clientWidth,
              thead: getComputedStyle(t.tHead).display,
              tbody: getComputedStyle(t.tBodies[0]).display,
              row: getComputedStyle(rows[0]).display,
              cell: getComputedStyle(cells[0]).display,
              pseudoDisplay: pseudo.display, pseudoPosition: pseudo.position,
              allCellsInside: cells.every(c => { const q = c.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.left >= -1 && q.right <= innerWidth + 1; })
            };
          }) };
        });
        const key = engine + ' ' + width + ' ' + theme;
        assert.equal(info.entries.length, 7, key + ': seven tables');
        assert.equal(info.entries.reduce((s, e) => s + e.rows, 0), 34, key + ': 34 rows');
        assert.equal(info.entries.reduce((s, e) => s + e.cells, 0), 97, key + ': 97 cells');
        assert.ok(info.entries.every(e => e.labels), key + ': all source column labels');
        assert.ok(info.entries.every(e => e.thead !== 'none'),
          key + ': authored column headers must not be display:none in a11y tree');
        assert.equal(info.overflow, 0, key + ': no horizontal page overflow');
        if (width <= 700) {
          assert.ok(info.entries.every(e => e.tbody === 'grid' && e.row === 'grid' && e.cell === 'block'), key + ': stacked cards');
          assert.ok(info.entries.every(e => e.w <= e.parentW + 1 && e.scroll <= 1 && e.allCellsInside), key + ': no hidden table column');
          assert.ok(info.entries.every(e => e.pseudoDisplay === 'block' && e.pseudoPosition === 'static'), key + ': visible labels never overlap');
        } else assert.ok(info.entries.every(e => e.tbody !== 'grid'), key + ': desktop table remains');
        const ax = await page.locator('table[data-responsive-layout]').nth(1).ariaSnapshot();
        assert.ok(ax.includes('table:') && ax.includes('rowgroup:') &&
          ax.includes('cell "') && ax.includes('columnheader "'),
          key + ': semantic table and authored column headers accessible');
        if ((width === 320 || width === 390 || width === 1440) && theme === 'light') {
          await page.locator('table[data-responsive-layout]').nth(1).scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(shots, engine + '-' + width + '-historical-context.jpg'), type: 'jpeg', quality: 75 });
        }
        assert.deepEqual(errors, [], key + ': zero JS errors');
        scenarios++;
        await ctx.close();
      }
    }

    // W95: a second non-Gill, non-Nagornaya Reader route uses the very
    // SAME typed prose comparison. Preserve exact authored content/headers,
    // legitimate desktop table, phone reflow, screen-reader column names.
    for(const width of [320,390,700,701,768]){
      const phone=width<=700;
      const adult=await browser.newContext({viewport:{width,height:844},
        isMobile:phone,hasTouch:phone,serviceWorkers:'block',reducedMotion:'reduce'});
      const article=await adult.newPage();
      const destination='http://127.0.0.1:'+server.address().port+
        '/articles/sovershennoletie-roditelskaya-vlast-chto-menyaetsya/';
      const response=await article.goto(destination,{waitUntil:'domcontentloaded',timeout:25000});
      assert.equal(response.status(),200,engine+' adulthood route');
      const props=await article.evaluate(()=>{
        const t=document.querySelector('article[data-teen-series-article="adult-child-authority"] .teen-series-prose table[data-responsive-layout="stacked-prose"]');
        if(!t)return null;
        const heads=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());
        const trs=[...t.querySelectorAll('tbody tr')];
        const cells=trs.flatMap(x=>[...x.querySelectorAll('td')]);
        const first=cells[0].getBoundingClientRect();
        const rect=t.getBoundingClientRect();
        const firstStyle=getComputedStyle(cells[0]);
        const proseKey=t.getAttribute('data-key-type');
        return {heads,rows:trs.length,cells:cells.length,
          labels:trs.every(row=>[...row.cells].every((cell,i)=>cell.dataset.label===heads[i])),
          overflow:document.documentElement.scrollWidth-innerWidth,
          tableWidth:rect.width,firstWidth:first.width,
          firstWhiteSpace:firstStyle.whiteSpace,
          firstWordBreak:firstStyle.wordBreak,
          keyType:proseKey,
          display:getComputedStyle(t).display,
          header:getComputedStyle(t.tHead).display,body:getComputedStyle(t.tBodies[0]).display};
      });
      const label=engine+' adulthood '+width;
      assert.ok(props,label+' authored table exists');
      assert.deepEqual(props.heads,['Статус','Что обычно остаётся особенно сильным','Что заметно меняется'],
        label+' exactly three authored column headings');
      assert.equal(props.keyType,'prose',label+' prose key explicitly opted in');
      assert.equal(props.rows,5,label+' five source comparison rows');
      assert.equal(props.cells,15,label+' all source cells kept');
      assert.equal(props.heads.length,3,label+' original column headings');
      assert.equal(props.labels,true,label+' no mismatched data-labels');
      assert.ok(props.overflow<=1,label+' no document horizontal overflow');
      assert.notEqual(props.header,'none',label+' column headers not suppressed');
      if(phone){
        assert.equal(props.body,'grid',label+' prose cards, not squashed columns');
        assert.ok(props.firstWidth>130,label+' first column remains readable as a card');
        assert.ok(props.tableWidth<=width,label+' cards inside viewport');
      }else{
        assert.notEqual(props.body,'grid',label+' full desktop table');
        assert.equal(props.firstWhiteSpace,'normal',label+' no legacy nowrap on long Russian status labels');
        assert.equal(props.firstWordBreak,'normal',label+' prose words do not split at arbitrary letters');
        assert.ok(props.firstWidth<=props.tableWidth*0.43,
          label+' prose key does not consume half the table: '+props.firstWidth+'/'+props.tableWidth);
      }
      const semantic=article.getByRole('table',{
        name:'Семейные отношения и обязанности в разные периоды взрослой жизни'
      });
      assert.equal(await semantic.count(),1,label+' named accessible source table');
      const accessibleHeaders=await semantic.getByRole('columnheader').allTextContents();
      assert.deepEqual(accessibleHeaders.map(x=>x.trim()),[
        'Статус','Что обычно остаётся особенно сильным','Что заметно меняется'
      ],label+' original column headers in accessibility tree');
      if(width===320||width===390||width===701||width===768){
        const cellTable=article.locator('article[data-teen-series-article] table[data-responsive-layout]');
        await cellTable.scrollIntoViewIfNeeded();
        await article.screenshot({path:path.join(shots,engine+'-'+width+'-adult-table.jpg'),
          type:'jpeg',quality:77,animations:'disabled'});
      }
      await adult.close();
    }

    // W98: two pre-existing editorial comparisons in the Heart handbook.
    // Readable typed cards, exact authored copy/labels and native AX headings;
    // Gill chronology and Nagornaya remain separate owners.
    for(const width of [320,390,701,768,1440]){
      const phone=width<=700;
      for(const theme of (width===390?['light','dark']:['light'])){
        const heartContext=await browser.newContext({viewport:{width,height:844},
          isMobile:phone,hasTouch:phone,serviceWorkers:'block',reducedMotion:'reduce'});
        const hp=await heartContext.newPage(),heartErrors=[];
        hp.on('pageerror',e=>heartErrors.push(e.message));
        const heartResponse=await hp.goto(url.slice(0,url.indexOf('/articles/'))+
          '/articles/serdce-spravochnik/',{waitUntil:'domcontentloaded',timeout:25000});
        assert.equal(heartResponse.status(),200,engine+' heart guide route');
        if(theme==='dark')await hp.evaluate(()=>document.documentElement.classList.add('dark'));
        const tableRoot=hp.locator('article[data-responsive-prose-owner="heart-guide"] table[data-responsive-layout="stacked-prose"]');
        assert.equal(await tableRoot.count(),2,engine+' '+width+' '+theme+' two authored comparisons');
        const originals=[
          {name:'Четыре состояния сердца и свободы воли',
            headings:['Состояние','Воля (по Августину)','Сердце'],rows:4,cells:12},
          {name:'Чувство святое или подделка',
            headings:['Чувство','Святое','Подделка'],rows:5,cells:15}
        ];
        for(const [i,expected] of originals.entries()){
          const t=tableRoot.nth(i);
          const metrics=await t.evaluate(table=>{
            const headings=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
            const rows=[...table.querySelectorAll('tbody tr')];
            const cells=rows.flatMap(x=>[...x.cells]);
            const bounds=table.getBoundingClientRect();
            return{headings,rows:rows.length,cells:cells.length,
              allLabels:rows.every(row=>[...row.cells].every((cell,j)=>cell.dataset.label===headings[j])),
              insideViewport:cells.every(cell=>{const r=cell.getBoundingClientRect();
                return r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1}),
              body:getComputedStyle(table.tBodies[0]).display,
              header:getComputedStyle(table.tHead).display,
              width:bounds.width,
              overflow:document.documentElement.scrollWidth-innerWidth};
          });
          const tag=engine+' heart '+width+' '+theme+' T'+i;
          assert.deepEqual(metrics.headings,expected.headings,tag+' exact source column headings');
          assert.equal(metrics.rows,expected.rows,tag+' original row count');
          assert.equal(metrics.cells,expected.cells,tag+' original cell count');
          assert.ok(metrics.allLabels,tag+' every authored data-label matches column');
          assert.notEqual(metrics.header,'none',tag+' native columnheader available');
          assert.ok(metrics.overflow<=1,tag+' no document x-overflow');
          assert.equal(metrics.insideViewport,true,tag+' every text cell physically readable');
          if(phone)assert.equal(metrics.body,'grid',tag+' styled prose comparison cards');
          else assert.notEqual(metrics.body,'grid',tag+' real desktop table');
          const semantic=hp.getByRole('table',{name:expected.name});
          assert.equal(await semantic.count(),1,tag+' named table accessibility');
          assert.deepEqual((await semantic.getByRole('columnheader').allTextContents()).map(x=>x.trim()),
            expected.headings,tag+' native accessible headers');
          if((width===320||width===390||width===768)&&theme==='light'){
            await t.scrollIntoViewIfNeeded();
            await hp.screenshot({path:path.join(shots,engine+'-'+width+'-heart-'+i+'.jpg'),
              type:'jpeg',quality:76,animations:'disabled'});
          }
        }
        assert.deepEqual(heartErrors,[],engine+' heart page script errors');
        scenarios++;
        await heartContext.close();
      }
    }

        // Same real MDX route, JavaScript disabled. CSS and native columnheader
    // semantics must survive the mobile view and return to a true print table.
    const noJsAdult=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
      hasTouch:true,javaScriptEnabled:false,serviceWorkers:'block',reducedMotion:'reduce'});
    const noJsPage=await noJsAdult.newPage();
    const noJsResponse=await noJsPage.goto(url.slice(0,url.indexOf('/articles/'))+
      '/articles/sovershennoletie-roditelskaya-vlast-chto-menyaetsya/',
      {waitUntil:'domcontentloaded',timeout:25000});
    assert.equal(noJsResponse.status(),200,engine+' adulthood no-JS HTTP');
    const table=noJsPage.locator('article[data-teen-series-article] .teen-series-prose table[data-responsive-layout="stacked-prose"]');
    const mobile=await table.evaluate(t=>({
      display:getComputedStyle(t).display,
      body:getComputedStyle(t.tBodies[0]).display,
      header:getComputedStyle(t.tHead).display,
      rows:t.tBodies[0].rows.length,
      pageOverflow:document.documentElement.scrollWidth-innerWidth
    }));
    assert.equal(mobile.display,'block',engine+' adult no-JS mobile cards');
    assert.equal(mobile.body,'grid',engine+' adult no-JS rows');
    assert.notEqual(mobile.header,'none',engine+' adult no-JS accessible headers');
    assert.equal(mobile.rows,5,engine+' adult no-JS rows preserved');
    assert.ok(mobile.pageOverflow<=1,engine+' adult no-JS no page overflow');
    const headers=await table.getByRole('columnheader').allTextContents();
    assert.deepEqual(headers.map(s=>s.trim()),
      ['Статус','Что обычно остаётся особенно сильным','Что заметно меняется'],
      engine+' adult no-JS columnheader roles preserved');
    await noJsPage.emulateMedia({media:'print'});
    const printable=await table.evaluate(t=>({
      table:getComputedStyle(t).display,
      head:getComputedStyle(t.tHead).display,
      body:getComputedStyle(t.tBodies[0]).display,
      row:getComputedStyle(t.tBodies[0].rows[0]).display,
      cell:getComputedStyle(t.tBodies[0].rows[0].cells[0]).display,
      minWidth:getComputedStyle(t).minWidth,
      overflowX:getComputedStyle(t).overflowX
    }));
    assert.deepEqual([printable.table,printable.head,printable.body,printable.row,printable.cell],
      ['table','table-header-group','table-row-group','table-row','table-cell'],
      engine+' adult print restores native rows and columns');
    assert.equal(printable.minWidth,'0px',engine+' print no 34rem floor');
    assert.equal(printable.overflowX,'visible',engine+' print no impossible scrollport');
    await noJsAdult.close();

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: false, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const nojs = await page.evaluate(() => {
      const t = document.querySelector('table[data-responsive-layout]');
      return { viewportWidth: innerWidth, mobileMedia: matchMedia('(max-width: 700px)').matches, tbody: getComputedStyle(t.tBodies[0]).display, labels: [...t.querySelectorAll('tbody td')].every(x => Boolean(x.dataset.label)) };
    });
    assert.ok(nojs.mobileMedia && nojs.viewportWidth <= 700, engine + ': real phone-sized CSS viewport without JS');
    assert.equal(nojs.tbody, 'grid', engine + ': no-JS cards');
    assert.ok(nojs.labels, engine + ': no-JS labels');
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => {
      const t = document.querySelector('table[data-responsive-layout]');
      return { table: getComputedStyle(t).display, header: getComputedStyle(t.tHead).display,
        body: getComputedStyle(t.tBodies[0]).display,
        row: getComputedStyle(t.tBodies[0].rows[0]).display,
        cell: getComputedStyle(t.tBodies[0].rows[0].cells[0]).display,
        labelsSuppressed: getComputedStyle(t.tBodies[0].rows[0].cells[1], '::before').display === 'none' };
    });
    assert.equal(pr.table, 'table', engine + ': print uses real table');
    assert.equal(pr.header, 'table-header-group', engine + ': print headers retained');
    assert.equal(pr.body, 'table-row-group', engine + ': print tbody restored');
    assert.equal(pr.row, 'table-row', engine + ': print rows restored');
    assert.equal(pr.cell, 'table-cell', engine + ': print columns restored');
    assert.ok(pr.labelsSuppressed, engine + ': mobile labels not duplicated in print');
    scenarios += 2;
    await ctx.close();

    // W89: numbered progress rail stays independent, while Context and
    // Handbook restore each heading's quiet circular bullet.
    for (const route of ['/articles/dzhon-gill-istoricheskiy-kontekst/',
                         '/articles/dzhon-gill-spravochnik/']) {
      for (const width of [320, 390, 768]) {
        const tocContext = await browser.newContext({ viewport: {width, height:844},
          isMobile:width<500, hasTouch:width<500, serviceWorkers:'block', reducedMotion:'reduce' });
        const tocPage = await tocContext.newPage();
        const baseUrl = url.slice(0,url.indexOf('/articles/'));
        const resp = await tocPage.goto(baseUrl + route, {waitUntil:'domcontentloaded'});
        assert.equal(resp.status(),200,engine+' '+route+' route');
        // A hidden bottom sheet returns zero geometry even if its authored CSS
        // would position the dot correctly. Open it BEFORE measuring pixels.
        if (width < 768) {
          await tocPage.locator('#mobPartTocBtn').click({timeout:7000});
          await tocPage.waitForFunction(() => {
            const overlay=document.querySelector('#partTocOverlay');
            return overlay &&
              (overlay.getAttribute('aria-hidden')==='false' || overlay.classList.contains('open')) &&
              overlay.getBoundingClientRect().width > 0;
          },null,{timeout:7000});
        }
        const tocResult = await tocPage.evaluate(() => {
          const item = document.querySelector('#partTocOverlay .gbat-part.cur.gbat-part--label');
          const dots = [...(item?.querySelectorAll('.gbat-subs .gbat-dot')||[])];
          const rail = item?.querySelector('.gbat-rail');
          const numbered = document.querySelector('#partTocOverlay .gbat-part:not(.gbat-part--label) .gbat-dot');
          const first = item?.querySelector('.gbat-subs .gbat-sub:not(.gbat-sat)');
          const bullet = first?.querySelector('.gbat-dot');
          const caption = bullet?.nextElementSibling;
          const bulletGap = bullet && caption
            ? caption.getBoundingClientRect().left - bullet.getBoundingClientRect().right : -1;
          const layoutReady = !!(first && first.getClientRects().length && first.getBoundingClientRect().width);
          return { bulletGap, layoutReady,
            matched: !!item, dots:dots.length,
            visibleDots:dots.filter(e=>getComputedStyle(e).display!=='none').length,
            rail:rail?getComputedStyle(rail).display:null,
            numberedDot:numbered?getComputedStyle(numbered).display:null,
          };
        });
        const tag=engine+' '+route+' '+width;
        assert.ok(tocResult.matched&&tocResult.dots>0,tag+' current label part with sections');
        if(width<768){
          assert.equal(tocResult.visibleDots,tocResult.dots,tag+' every outline item shows its circle');
          assert.equal(tocResult.rail,'none',tag+' no frontmatter rail');
          assert.ok(tocResult.layoutReady,tag+' measure after opening the sheet, not hidden zero rectangles');
          assert.ok(tocResult.bulletGap>=8,tag+' bullet must not collide with text: '+tocResult.bulletGap);
          assert.notEqual(tocResult.numberedDot,'none',tag+' numbered part unchanged');
          await tocPage.screenshot({path:path.join(shots,engine+'-'+width+'-'+route.split('/')[2]+'-toc.jpg'),
            type:'jpeg',quality:76,animations:'disabled'});
        } else {
          assert.ok(tocResult.visibleDots>0,tag+' tablet/desktop legacy dots unchanged');
        }
        scenarios++;
        await tocContext.close();
      }
    }
    await browser.close();
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ passed: scenarios, screenshots: shots }));
