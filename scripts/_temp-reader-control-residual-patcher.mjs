#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment is not unique`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function replaceRegexOnce(source, re, after, label) {
  const matches = [...source.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  return source.replace(re, after);
}

const readerRailPath = 'src/components/article-pilots/_shared/ReaderRail.astro';
let readerRail = read(readerRailPath);
readerRail = replaceOnce(
  readerRail,
  "export interface ReaderRailTocItem { href: string; label: string; level: number; }",
  "import SiteSectionsMenu from './SiteSectionsMenu.astro';\n\nexport interface ReaderRailTocItem { href: string; label: string; level: number; }",
  'ReaderRail shared menu import',
);
readerRail = replaceOnce(
  readerRail,
  "---\n<aside class=\"hrail\"",
  "---\n<SiteSectionsMenu />\n<aside class=\"hrail\"",
  'ReaderRail shared menu render',
);
readerRail = replaceOnce(
  readerRail,
  "      <span class=\"hrail-track\" aria-hidden=\"true\"><i></i></span>",
  "      <li class=\"hrail-track-slot\" role=\"presentation\" aria-hidden=\"true\" style=\"display:contents\"><span class=\"hrail-track\"><i></i></span></li>",
  'ReaderRail valid list track carrier',
);
readerRail = replaceOnce(
  readerRail,
  "    <button class=\"hrail-bottom-btn\" type=\"button\" data-fc-action=\"search\" aria-label=\"Поиск и разделы сайта\">",
  "    <button class=\"hrail-bottom-btn\" id=\"hMobileMenuBtn\" type=\"button\" aria-label=\"Открыть меню\" aria-expanded=\"false\" aria-controls=\"hMobileNav\" data-tip=\"Меню сайта\">",
  'ReaderRail Menu not Search action',
);
readerRail = replaceOnce(
  readerRail,
  "    const rows = Array.from(toc.querySelectorAll('li'));",
  "    const rows = Array.from(toc.querySelectorAll(':scope > li:not(.hrail-track-slot)'));",
  'ReaderRail scrollspy excludes decorative list carrier',
);
write(readerRailPath, readerRail);

const seriesRailPath = 'src/components/article-pilots/gill-series/GillSeriesRail.astro';
let seriesRail = read(seriesRailPath);
seriesRail = replaceOnce(
  seriesRail,
  "          <span aria-hidden=\"true\" class=\"gbs2-track\"><i></i></span>",
  "          <li class=\"gbs2-track-slot\" role=\"presentation\" aria-hidden=\"true\" style=\"display:contents\"><span class=\"gbs2-track\"><i></i></span></li>",
  'SeriesRail valid list track carrier',
);
write(seriesRailPath, seriesRail);

const chromePath = 'src/components/article-pilots/gill-series/GillSeriesChrome.astro';
let chrome = read(chromePath);
chrome = replaceOnce(
  chrome,
  "import ReaderActionsRuntime from '@/components/reader-platform/ReaderActionsRuntime.astro';",
  "import ReaderActionsRuntime from '@/components/reader-platform/ReaderActionsRuntime.astro';\nimport SiteSectionsMenu from '../_shared/SiteSectionsMenu.astro';",
  'GillSeriesChrome shared menu import',
);
chrome = replaceRegexOnce(
  chrome,
  /<!-- Site-sections menu opened by the rail hamburger\.[\s\S]*?(?=<div class=\"gbs2-world\")/,
  '<SiteSectionsMenu />\n\n',
  'GillSeriesChrome inline menu extraction',
);
write(chromePath, chrome);

const tocPath = 'src/components/article-pilots/gill-series/GillPartTocOverlay.astro';
let toc = read(tocPath);
toc = replaceOnce(
  toc,
  "        const isLabel = item.mark.kind === 'label';\n        return (",
  "        const isLabel = item.mark.kind === 'label';\n        const partRegionId = `gbat-part-region-${item.id}`;\n        return (",
  'Part TOC deterministic part region id',
);
toc = replaceOnce(
  toc,
  "            <button class=\"gbat-hd\" type=\"button\" aria-expanded={isCurrent ? 'true' : 'false'}>",
  "            <button class=\"gbat-hd\" type=\"button\" aria-expanded={isCurrent ? 'true' : 'false'} aria-controls={partRegionId}>",
  'Part TOC part trigger relation',
);
toc = replaceOnce(
  toc,
  "            <div class=\"gbat-subs\"><div><div class=\"gbat-pad\">",
  "            <div class=\"gbat-subs\" id={partRegionId}><div><div class=\"gbat-pad\">",
  'Part TOC part controlled region',
);
toc = replaceOnce(
  toc,
  "                const artSecs = config.pages[art.id]?.partToc || [];\n                return (",
  "                const artSecs = config.pages[art.id]?.partToc || [];\n                const artRegionId = `gbat-art-region-${art.id}`;\n                return (",
  'Part TOC deterministic article region id',
);
toc = replaceOnce(
  toc,
  "                        <button class=\"gbat-art-chev\" type=\"button\" aria-expanded={isHere ? 'true' : 'false'} aria-label={`Оглавление: ${art.title}`}>",
  "                        <button class=\"gbat-art-chev\" type=\"button\" aria-expanded={isHere ? 'true' : 'false'} aria-controls={artRegionId} aria-label={`Оглавление: ${art.title}`}>",
  'Part TOC article trigger relation',
);
toc = replaceOnce(
  toc,
  "                    <div class=\"gbat-artsecs\"><div>",
  "                    <div class=\"gbat-artsecs\" id={artRegionId}><div>",
  'Part TOC article controlled region',
);
write(tocPath, toc);

const menuPath = 'src/components/article-pilots/_shared/SiteSectionsMenu.astro';
if (fs.existsSync(menuPath)) throw new Error(`${menuPath}: refusing to overwrite existing owner`);
write(menuPath, `<!-- Shared static projection of the existing site-sections menu.\n     Open/close, Escape and scroll-lock remain owned by js/site.js. -->\n<div id="hMobileBackdrop" class="h-mobile-backdrop" aria-hidden="true"></div>\n<div class="h-mobile-nav" id="hMobileNav" aria-hidden="true">\n  <span class="gbs-menu-label" aria-hidden="true">Разделы сайта</span>\n  <a href="../../#publikacii" data-close-nav><span>Публикации</span><svg class="gbs-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></a>\n  <a href="../../#razbor" data-close-nav><span>Разбор заблуждений</span><svg class="gbs-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></a>\n  <a href="../../biografii/" data-close-nav><span>Биографии</span><svg class="gbs-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></a>\n  <a href="../../articles/" data-close-nav><span>Все статьи</span><svg class="gbs-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></a>\n  <a href="../../about/" data-close-nav><span>О проекте</span><svg class="gbs-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></a>\n</div>\n`);

console.log('reader-control residual patch: PASS');
