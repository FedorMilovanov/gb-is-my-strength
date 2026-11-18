#!/usr/bin/env node
/**
 * Agent 9 — targeted actual-PDF regression, not a new publication/runtime owner.
 * Serve the intended build separately on 0.0.0.0. No routes/history are created.
 * Requires isolated Playwright, @sparticuz/chromium and PyMuPDF (no repo deps).
 * JOURNAL_PDF_PYTHONPATH may prepend isolated Python tooling; missing tools fail.
 * Prepend al2023 libs to the PRESERVED LD_LIBRARY_PATH before running on Arena.
 * Chromium PDF evidence is not Firefox/WebKit/physical-device/owner approval.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const base = process.env.JOURNAL_BASE_URL || 'http://127.0.0.1:4173';
const out = path.resolve(process.env.JOURNAL_PRINT_REPORT_DIR || 'reports/g3-editorial/agent-9/print');
const scratch = path.resolve(process.env.JOURNAL_PRINT_SCRATCH_DIR || '.cache/g3-editorial-audit/agent9-print');
await fs.mkdir(out, { recursive: true });
await fs.mkdir(scratch, { recursive: true });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const report = {
  createdAt: new Date().toISOString(), agent: 'Agent 9',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  base, scope: 'Four public actual-PDF states + one former-gutter negative control only; not full editorial/cross-engine acceptance.',
  sourceHashes: {}, browser: null, cases: [], negativeControl: null, failures: [], unavailable: [],
};
for (const file of ['src/components/journal/journalEditorial.css', 'src/components/journal/JournalDocumentHead.astro', 'scripts/journal-editorial-agent9-print-test.mjs']) report.sourceHashes[file] = hash(await fs.readFile(file));
const check = (condition, label) => { if (!condition) report.failures.push(label); };
const pdfOptions = { format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } };
const raw = [];
let browser;
try {
  const { chromium } = await import(process.env.JOURNAL_PLAYWRIGHT_MODULE || 'playwright');
  const chromiumModule = process.env.JOURNAL_CHROMIUM_MODULE || '@sparticuz/chromium';
  const Chromium = (await import(chromiumModule)).default;
  const executablePath = await Chromium.executablePath();
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  browser = await chromium.launch({ executablePath, headless: true, args });
  report.browser = { engine: 'Chromium', version: browser.version(), executablePath, headless: true, args, pdfOptions };
  for (const entry of [
    { name: 'journal-light', route: '/journal/', theme: 'light' },
    { name: 'journal-dark', route: '/journal/', theme: 'dark' },
    { name: 'dossier-light', route: '/journal/dossiers/g3/', theme: 'light' },
    { name: 'dossier-dark', route: '/journal/dossiers/g3/', theme: 'dark' },
    { name: 'dossier-negative-control', route: '/journal/dossiers/g3/', theme: 'light', control: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU', colorScheme: entry.theme, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(), errors = { javascript: [], console: [], requests: [], http: [] };
      page.on('pageerror', (error) => errors.javascript.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
      page.on('requestfailed', (request) => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }));
      page.on('response', (response) => { if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() }); });
      await page.addInitScript((theme) => localStorage.setItem('gb:reader-preferences:v1', JSON.stringify({ version: 1, theme })), entry.theme);
      const response = await page.goto(base + entry.route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print' });
      if (entry.control) await page.locator('.bibliography-list').evaluate((list) => { list.style.paddingInlineStart = '24px'; });
      const state = await page.evaluate(() => ({
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        headings: [...document.querySelectorAll('main h1,main h2,main h3')].map((node) => node.textContent.trim()),
        paragraphs: [...document.querySelectorAll('.prose > p,.journal-prose > p,.journal-intro,.journal-lead')].map((node) => ({
          text: node.textContent.trim(),
          floatingFirstLetter: getComputedStyle(node, '::first-letter').float !== 'none',
        })),
        sources: [...document.querySelectorAll('.bibliography-item h3')].map((node) => node.textContent.trim()),
        sourceCount: document.querySelectorAll('.bibliography-item').length,
        author: document.querySelector('.je-author-byline')?.textContent.trim().replace(/\s+/g, ' ') || null,
        mainInk: getComputedStyle(document.querySelector('main')).color,
        screenChromeHidden: [...document.querySelectorAll('.je-masthead,.je-page-chrome,.je-editorial-rail,.mcp-top')].every((node) => node.getClientRects().length === 0),
        bibliographyPadding: document.querySelector('.bibliography-list') ? getComputedStyle(document.querySelector('.bibliography-list')).paddingInlineStart : null,
      }));
      const pdf = path.join(scratch, entry.name + '.pdf');
      await page.pdf({ ...pdfOptions, path: pdf });
      const bytes = await fs.readFile(pdf);
      const savedPdf = entry.name === 'dossier-light' ? path.join(out, 'dossier-print-a4.pdf') : null;
      if (savedPdf) await fs.copyFile(pdf, savedPdf);
      raw.push({ ...entry, pdf, savedPdf, pdfSha256: hash(bytes), pdfBytes: bytes.length, status: response.status(), state, errors });
      check(response.status() === 200 && state.theme === entry.theme, `${entry.name}: route/theme`);
      check(state.screenChromeHidden && state.mainInk === 'rgb(0, 0, 0)', `${entry.name}: print chrome/ink`);
      check(Object.values(errors).flat().length === 0, `${entry.name}: browser errors ${JSON.stringify(errors)}`);
    } catch (error) { report.failures.push(`${entry.name}: ${error.stack || error}`); }
    finally { await context.close(); }
  }
} catch (error) { report.unavailable.push({ tool: 'Chromium PDF', reason: error.stack || String(error) }); }
finally { if (browser) await browser.close(); }
const rawManifest = path.join(scratch, 'capture-manifest.json');
await fs.writeFile(rawManifest, JSON.stringify(raw, null, 2));

// Actual page-content clipping is narrower than the PDF page box. Text extraction
// alone sees clipped glyphs, so compare every native marker span to the real clip.
const inspectPython = String.raw`
import json,re,sys,unicodedata
import pymupdf
normalize=lambda text: re.sub(r'\s+','',unicodedata.normalize('NFKC',text).replace('\u00ad','')).casefold()
results=[]
for case in json.load(open(sys.argv[1])):
    doc=pymupdf.open(case['pdf']);text=normalize('\n'.join(page.get_text(sort=True) for page in doc));markers=[];pages=[]
    for index,page in enumerate(doc):
        clips=[item['scissor'] for item in page.get_drawings(extended=True) if item['type']=='clip' and item.get('level')==0]
        clip=clips[0] if clips else page.rect
        outside=[word[4] for word in page.get_text('words') if word[0]<0 or word[1]<0 or word[2]>page.rect.width or word[3]>page.rect.height]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    value=span['text'].strip()
                    if re.fullmatch(r'\d+\.',value):
                        box=pymupdf.Rect(span['bbox'])
                        markers.append({'ordinal':int(value[:-1]),'page':index+1,'bbox':list(box),'clip':list(clip),'clipped':box.x0<clip.x0 or box.x1>clip.x1,'leftOvershootPt':max(0,clip.x0-box.x0)})
        pages.append({'page':index+1,'width':page.rect.width,'height':page.rect.height,'outOfPageWords':outside})
    missingHeadings=[value for value in case['state']['headings'] if normalize(value) not in text]
    missingSources=[value for value in case['state']['sources'] if normalize(value) not in text]
    paragraphWarnings=[]
    for index,paragraph in enumerate(case['state']['paragraphs']):
        value=paragraph['text'];start=value[1:61] if paragraph['floatingFirstLetter'] else value[:60]
        if normalize(start) not in text or normalize(value[-60:]) not in text:paragraphWarnings.append(index)
    results.append({'name':case['name'],'pageCount':len(doc),'pages':pages,'markerCount':len(markers),'markers':markers,'clippedOrdinals':[item['ordinal'] for item in markers if item['clipped']],'missingHeadings':missingHeadings,'missingSourceTitles':missingSources,'matchedSourceTitles':len(case['state']['sources'])-len(missingSources),'unfoundParagraphSnippets':paragraphWarnings,'screenControlTextFound':[label for label in ['Поиск по сайту','Тёмная тема','Светлая тема','Перейти к содержимому'] if normalize(label) in text],'authorFound':not case['state']['author'] or normalize(case['state']['author']) in text})
print(json.dumps({'tool':'PyMuPDF '+pymupdf.VersionBind,'cases':results},ensure_ascii=False))
`;
const environment = { ...process.env };
if (process.env.JOURNAL_PDF_PYTHONPATH) environment.PYTHONPATH = process.env.JOURNAL_PDF_PYTHONPATH + (environment.PYTHONPATH ? path.delimiter + environment.PYTHONPATH : '');
const inspection = spawnSync(process.env.JOURNAL_PDF_PYTHON || 'python3', ['-c', inspectPython, rawManifest], { encoding: 'utf8', env: environment, maxBuffer: 4 * 1024 * 1024 });
if (inspection.status !== 0) report.unavailable.push({ tool: 'Actual PDF inspection / PyMuPDF', reason: inspection.stderr || inspection.error?.message || `exit ${inspection.status}` });
else {
  const decoded = JSON.parse(inspection.stdout);
  report.pdfInspector = decoded.tool;
  for (const result of decoded.cases) {
    const capture = raw.find((entry) => entry.name === result.name);
    const entry = { ...result, pdf: capture.savedPdf || capture.pdf, pdfSha256: capture.pdfSha256, pdfBytes: capture.pdfBytes, status: capture.status, theme: capture.theme, paddingInlineStart: capture.state.bibliographyPadding, errors: capture.errors };
    if (capture.control) {
      report.negativeControl = { ...entry, method: 'Temporary inline padding-inline-start:24px on the existing bibliography list only; actual fonts, content, assets and page settings unchanged.' };
      check(JSON.stringify(result.clippedOrdinals) === JSON.stringify(Array.from({ length: 12 }, (_, index) => index + 10)), 'Former-gutter PDF negative control must detect ordinals 10–21');
    } else {
      report.cases.push(entry);
      check(result.clippedOrdinals.length === 0, `${result.name}: actual PDF clipped markers ${result.clippedOrdinals.join(',')}`);
    }
    check(result.pages.every((page) => page.outOfPageWords.length === 0), `${result.name}: text outside PDF page box`);
    check(result.missingHeadings.length === 0 && result.unfoundParagraphSnippets.length === 0, `${result.name}: incomplete headings/paragraph snippets`);
    check(result.screenControlTextFound.length === 0 && result.authorFound, `${result.name}: controls/byline text`);
    if (capture.route.includes('/dossiers/')) {
      check(result.markerCount === 21 && JSON.stringify(result.markers.map((marker) => marker.ordinal)) === JSON.stringify(Array.from({ length: 21 }, (_, index) => index + 1)), `${result.name}: exactly 21 native ordered markers`);
      check(result.matchedSourceTitles === 21 && result.missingSourceTitles.length === 0, `${result.name}: exactly 21 source titles`);
    }
  }
}
check(report.cases.length === 4, 'All four public PDF states must execute');
check(Boolean(report.negativeControl), 'Actual PDF negative control must execute');
await fs.writeFile(path.join(out, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ head: report.head, dirty: report.dirty, cases: report.cases.map(({ name, pageCount, markerCount, matchedSourceTitles, clippedOrdinals }) => ({ name, pageCount, markerCount, matchedSourceTitles, clippedOrdinals })), negativeControl: report.negativeControl?.clippedOrdinals, failures: report.failures, unavailable: report.unavailable }, null, 2));
if (report.failures.length || report.unavailable.length) process.exitCode = 1;
