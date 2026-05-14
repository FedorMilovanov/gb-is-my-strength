#!/usr/bin/env node
/**
 * patch-v2-apply.js — единый прогон патчей AUDIT V2 + AUDIT_10_OF_10.
 *
 * Делает по порядку:
 *   1. BreadcrumbList → @graph (SEO-3 V2)
 *   2. speakable во все Article JSON-LD (SEO-1 V2)
 *   3. .summary-card в недостающие статьи (SEO-2 V2)
 *   4. Self-host Google Fonts: убирает <link> на googleapis/gstatic
 *      и заменяет stylesheet на /fonts/fonts.css (PERF-1 V2)
 *   5. Hardcoded z-index → CSS-токены (UX-1 V2)
 *   6. Author label «Автор» → «Редактор» (ATR-10.1 AUDIT_10)
 *   7. feed.xml: og.jpg → og.webp + унификация dc:creator (ATR-10.4)
 *   8. Inline event handlers → data-action / CSS class (UX-3 V2)
 *   9. JSON-LD нормализация: editor/author через @id (SEO-1.3a AUDIT_10)
 *  10. translator-нода для Тип C (Нагорная) (SEO-1.3c)
 *  11. UI-3.2: emoji 📖/✕/✅ в production-интерфейсе → SVG
 *  12. NAV-11.2: mailto subject/body автоподстановка
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const log = (...a) => console.log('[patch-v2]', ...a);
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'fonts'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const read  = f => fs.readFileSync(f, 'utf8');
const write = (f, c) => fs.writeFileSync(f, c, 'utf8');
const rel   = p => path.relative(ROOT, p).replace(/\\/g, '/');

const allFiles  = walk(ROOT);
const htmlFiles = allFiles.filter(p => p.endsWith('.html') && !rel(p).match(/^(google|yandex)/));

const stats = {
  breadcrumbsMerged: 0, speakableAdded: 0, summaryAdded: 0,
  fontsLocalised: 0, zindexReplaced: 0, authorLabelFixed: 0,
  feedFixed: 0, inlineHandlersRemoved: 0, jsonldNormalized: 0,
  translatorAdded: 0, emojiReplaced: 0, mailtoFilled: 0
};

/* ─── 1. BreadcrumbList → @graph ──────────────────────────────────── */
function mergeBreadcrumbs(file) {
  let html = read(file);
  const ldRe = /<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  const blocks = [];
  let m;
  while ((m = ldRe.exec(html)) !== null) {
    blocks.push({ raw: m[0], json: m[1], index: m.index, length: m[0].length });
  }
  if (blocks.length < 2) return false;
  let standalone = null, mainGraph = null;
  for (const b of blocks) {
    let parsed; try { parsed = JSON.parse(b.json); } catch { continue; }
    if (parsed['@type'] === 'BreadcrumbList' && !parsed['@graph']) standalone = { ...b, parsed };
    else if (parsed['@graph']) mainGraph = { ...b, parsed };
  }
  if (!standalone || !mainGraph) return false;
  const breadcrumb = { ...standalone.parsed }; delete breadcrumb['@context'];
  const wp = mainGraph.parsed['@graph'].find(x => x && (x['@type'] === 'WebPage' || x['@type'] === 'CollectionPage'));
  breadcrumb['@id'] = (wp?.url || wp?.['@id'] || '') + '#breadcrumbs';
  mainGraph.parsed['@graph'].push(breadcrumb);
  const newMainBlock = '<script type="application/ld+json">\n' + JSON.stringify(mainGraph.parsed, null, 2) + '\n</script>';
  if (standalone.index < mainGraph.index) {
    html = html.slice(0, standalone.index) + html.slice(standalone.index + standalone.length).replace(mainGraph.raw, newMainBlock);
  } else {
    html = html.replace(mainGraph.raw, newMainBlock).replace(standalone.raw, '');
  }
  write(file, html.replace(/\n{3,}/g, '\n\n'));
  return true;
}

/* ─── 2. speakable во все Article JSON-LD ─────────────────────────── */
function addSpeakable(file) {
  let html = read(file);
  const ldRe = /<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let touched = false;
  html = html.replace(ldRe, (full, jsonText) => {
    let data; try { data = JSON.parse(jsonText); } catch { return full; }
    let modified = false;
    const visit = (n) => {
      if (!n || typeof n !== 'object') return;
      const t = n['@type'];
      const isArticle = t === 'Article' || t === 'ScholarlyArticle' ||
        t === 'NewsArticle' || t === 'BlogPosting' ||
        (Array.isArray(t) && t.some(x => /Article|BlogPosting/.test(x)));
      if (isArticle && !n.speakable) {
        n.speakable = {
          "@type": "SpeakableSpecification",
          "cssSelector": ["h1", ".article-lead", ".summary-card", "[data-speakable]"]
        };
        modified = true;
      }
      for (const k of Object.keys(n)) visit(n[k]);
    };
    visit(data); if (data['@graph']) data['@graph'].forEach(visit);
    if (!modified) return full;
    touched = true;
    return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</script>';
  });
  if (touched) write(file, html);
  return touched;
}

/* ─── 3. .summary-card в недостающие статьи ───────────────────────── */
const SUMMARIES = {
  'articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html': {
    title: 'Коротко',
    items: [
      'Христоцентричная герменевтика стремится показать связь каждого библейского текста со Христом.',
      'Опасность — устанавливать связь со Христом помимо авторского замысла, жанра и контекста.',
      'Грамматико-исторический метод раскрывает Христа в Писании не хуже, а глубже любого «обхода» текста.',
      'Богословие не должно подменять экзегезу: даже типология должна быть укоренена в самом тексте.',
      'Чау показывает: верность тексту защищает Христа от произвольных толкований и обогащает христологию.'
    ]
  },
  'articles/krajne-li-isporcheno-serdce/index.html': {
    title: 'Коротко',
    items: [
      'Иеремия 17:9 описывает падшее сердце как «кривое» (ʿāqōb) и «неисцелимо больное» (ʾānûš).',
      'К верующему стих применим как предупреждение: остаточный грех способен оправдывать сам себя.',
      'Новое сердце по Иез. 36:26 — не отмена диагноза, а Божий ответ на него во Христе.',
      'Простой совет: не делать сердце последним судом; проверять его Писанием, молитвой, плодами и братским словом.',
      'simul iustus et peccator — христианин одновременно полностью оправдан и продолжает борьбу с грехом.'
    ]
  },
  'nagornaya/chast-1/index.html': {
    title: 'Коротко',
    items: [
      'Часть 1 рассматривает содержание Нагорной проповеди (Мф 5–7) — её структуру и смысловые блоки.',
      'Нагорная проповедь — не свод этических максим, а описание жизни в Царстве Божьем.',
      'Заповеди Блаженства задают онтологию ученика, а не список достижений.',
      'Контекст Мф 5:1 — гора, толпа, ученики; это методически отличает её от Луки 6:17–49 (на равнине).',
      'Цель серии — показать связность проповеди как единого богословского события, а не сборника тезисов.'
    ]
  },
  'nagornaya/chast-2/index.html': {
    title: 'Коротко',
    items: [
      'Часть 2 — методология: как именно записан и передан текст Нагорной проповеди.',
      'Различия с Лукой 6 объясняются разными адресатами, а не противоречием.',
      'Письменная фиксация Матфея — результат памяти учеников, оживотворённой Святым Духом (Ин 14:26).',
      'Греческий текст сохраняет следы арамейского оригинала: ʿanawim → πτωχοὶ τῷ πνεύματι.',
      'Богодухновенность не означает диктовку: Дух действует через личность и стиль автора.'
    ]
  },
  'nagornaya/chast-3/index.html': {
    title: 'Коротко',
    items: [
      'Часть 3 рассматривает адресата Нагорной проповеди.',
      'Первичный адресат — ученики Христа в контексте обещанного Царства.',
      'Этика Нагорной проповеди не диспенсационно «отложена», а действует в Церкви сейчас.',
      'Радикальные требования (Мф 5:38–48) не отменяют Закон, но раскрывают его сердцевину.',
      'Применимость — здесь и сейчас: для ученика, живущего в Духе и под властью Слова.'
    ]
  },
  'nagornaya/chast-4/index.html': {
    title: 'Коротко',
    items: [
      'Часть 4 — богодухновенность и текстология Нагорной проповеди.',
      'Текст Мф 5–7 имеет высокую степень текстуальной стабильности по ранним папирусам.',
      'Различия в формулировках Мф vs Лк не подрывают доктрину богодухновенности.',
      'Святой Дух раскрывает многогранность арамейского ʿanawim через двух евангелистов.',
      'Чикагское заявление (1978) о безошибочности применимо к оригинальному тексту, а не к переводам.'
    ]
  },
  'nagornaya/chast-5/index.html': {
    title: 'Коротко',
    items: [
      'Часть 5 рассматривает Нагорную проповедь в категории «Закон и Евангелие».',
      'Христос не отменяет Закон (Мф 5:17), но раскрывает его подлинное намерение.',
      'Закон в Нагорной проповеди — не путь спасения, а описание жизни уже спасённых.',
      'Антитезы «Вы слышали — а Я говорю вам» — это углубление Закона, а не его пересмотр.',
      'Единство Ветхого и Нового Завета — основа реформатской герменевтики.'
    ]
  },
  'nagornaya/istochniki/index.html': {
    title: 'Коротко',
    items: [
      'Аннотированный список источников по серии «Нагорная проповедь».',
      'Включает академические комментарии (Carson, France, Bock, Stein).',
      'Документы: Чикагское заявление о безошибочности (1978), TMS-материалы.',
      'Каждый источник снабжён кратким описанием, ролью в исследовании и рекомендацией читателю.',
      'Цель раздела — обеспечить полную верифицируемость серии (E-E-A-T).'
    ]
  },
  'nagornaya/nakhodki/index.html': {
    title: 'Коротко',
    items: [
      '21 ключевая исследовательская находка по Нагорной проповеди.',
      'Каждая находка имеет богословское значение и пастырское применение.',
      'Раздел построен как навигация по корпусу серии для быстрого поиска идей.',
      'Связан с источниками и пятью основными частями цикла.',
      'Подходит для проповедников, преподавателей и студентов как справочный аппарат.'
    ]
  },
  'nagornaya/seriya/index.html': {
    title: 'Коротко',
    items: [
      'Полная навигация по серии «Нагорная проповедь»: 5 частей, источники, находки.',
      'Каждая часть — самостоятельное исследование, объединённое общей методологией.',
      'Серия рассчитана на ~110 минут чтения и подходит для последовательного изучения.',
      'Богословская база — реформатская, методологическая — TMS / Chicago Statement.',
      'Все материалы открыты, без подписки и регистрации.'
    ]
  },
  'pastor-series/index.html': {
    title: 'Коротко',
    items: [
      'Серия «20 антисоветов пастору» — системный анализ пасторских патологий.',
      'Темы: власть, подотчётность, манипуляция Писанием, газлайтинг, законничество.',
      'Каждая статья опирается на Писание и ставит зеркало внутреннему диагнозу служения.',
      'Применение терминов «газлайтинг», «нарциссизм» — в пастырском, а не клиническом смысле.',
      'Цель серии — содействовать здоровой церковной культуре, а не обвинению конкретных людей.'
    ]
  }
};
function buildSummaryHTML(meta) {
  const items = meta.items.map(t =>
    `      <li class="summary-card__item">
        <span class="summary-card__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <p class="summary-card__text">${t}</p>
      </li>`).join('\n');
  return `
<section class="summary-card" aria-labelledby="summary-title-auto" data-speakable>
  <h2 id="summary-title-auto" class="summary-card__head">${meta.title}</h2>
  <ul class="summary-card__body" role="list">
${items}
  </ul>
</section>
`;
}
function addSummaryCard(file) {
  const r = rel(file);
  const meta = SUMMARIES[r];
  if (!meta) return false;
  let html = read(file);
  if (html.includes('class="summary-card"')) return false;
  const block = buildSummaryHTML(meta);
  const leadRe = /(<\w+[^>]+class="[^"]*article-lead[^"]*"[^>]*>[\s\S]*?<\/\w+>)/i;
  if (leadRe.test(html)) { html = html.replace(leadRe, `$1\n${block}`); }
  else {
    const h1Re = /(<h1[^>]*>[\s\S]*?<\/h1>)/i;
    if (h1Re.test(html)) html = html.replace(h1Re, `$1\n${block}`);
    else return false;
  }
  write(file, html);
  return true;
}

/* ─── 4. Self-host Google Fonts ───────────────────────────────────── */
function localiseFonts(file) {
  let html = read(file);
  let touched = false;
  // Удаляем preconnect к googleapis/gstatic в любом порядке атрибутов
  const preRe = /\s*<link[^>]*(?:href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*rel="preconnect"|rel="preconnect"[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com")[^>]*>/gi;
  if (preRe.test(html)) { html = html.replace(preRe, ''); touched = true; }
  // Замена stylesheet ссылки на локальный fonts.css
  const ssRe = /<link[^>]+href="https:\/\/fonts\.googleapis\.com\/css2[^"]+"[^>]*>/g;
  if (ssRe.test(html)) {
    const fileDir = path.dirname(file);
    const fontsCSS = path.relative(fileDir, path.join(ROOT, 'fonts/fonts.css')).replace(/\\/g, '/');
    html = html.replace(ssRe,
      `<link rel="preload" as="style" href="${fontsCSS}">\n<link rel="stylesheet" href="${fontsCSS}">`);
    touched = true;
  }
  if (touched) write(file, html);
  return touched;
}

/* ─── 5. z-index hardcoded → CSS-токены ───────────────────────────── */
const Z_MAP = {
  '99999':'var(--z-absolute)', '20000':'var(--z-critical)', '19999':'var(--z-popover)',
  '19000':'var(--z-panel)',    '15000':'var(--z-overlay-modal)', '10001':'var(--z-modal-1)',
  '10000':'var(--z-modal)',    '9999':'var(--z-modal-low)',      '9998':'var(--z-toast-high)',
  '9800':'var(--z-toast)',     '9100':'var(--z-tooltip-high)',   '9000':'var(--z-tooltip)',
  '8999':'var(--z-tooltip-low)','8998':'var(--z-dropdown-high)', '2500':'var(--z-overlay)',
  '2000':'var(--z-bottom-bar)','800':'var(--z-raised-high)'
};
function replaceZIndex(file) {
  if (file.endsWith('.min.css')) return false;
  let src = read(file), touched = false;
  // не трогать строки объявления токенов `--z-...:`
  const out = [];
  src.split('\n').forEach(line => {
    const stripped = line.trimStart();
    if (stripped.startsWith('--z-') && stripped.includes(':')) { out.push(line); return; }
    const newLine = line.replace(/z-index\s*:\s*(\d{3,6})\b/gi, (full, num) => {
      if (Z_MAP[num]) { touched = true; stats.zindexReplaced++; return `z-index: ${Z_MAP[num]}`; }
      return full;
    });
    out.push(newLine);
  });
  if (touched) write(file, out.join('\n'));
  return touched;
}

/* ─── 6. «Автор» → «Редактор» в 20-antisovetov ────────────────────── */
function fixAuthorLabel(file) {
  if (!file.endsWith('20-antisovetov-pastoru/index.html')) return false;
  let html = read(file);
  if (!/<div class="author-card-label">Автор<\/div>/.test(html)) return false;
  html = html.replace(/<div class="author-card-label">Автор<\/div>/, '<div class="author-card-label">Редактор</div>');
  write(file, html);
  return true;
}

/* ─── 7. feed.xml: og.jpg → og.webp + dc:creator ──────────────────── */
function fixFeed() {
  const file = path.join(ROOT, 'feed.xml');
  let xml = read(file);
  let touched = false;
  if (xml.includes('og-preview.jpg')) {
    xml = xml.replace(/og-preview\.jpg/g, 'og-preview-1200x630.webp');
    touched = true;
  }
  if (/<dc:creator>Фёдор Милованов \(ред\.\)<\/dc:creator>/.test(xml)) {
    xml = xml.replace(/<dc:creator>Фёдор Милованов \(ред\.\)<\/dc:creator>/g, '<dc:creator>Фёдор Милованов</dc:creator>');
    touched = true;
  }
  if (touched) write(file, xml);
  return touched;
}

/* ─── 8. Inline event handlers ────────────────────────────────────── */
function removeInlineHandlers(file) {
  let s = read(file), orig = s;
  // hover-эффекты серийных карточек → класс gb-series-link
  s = s.replace(/\s*onmouseover="this\.style\.borderColor='rgba\(184,136,42,\.5\)';this\.style\.background='#fff8ed';this\.style\.transform='translateY\(-2px\)'"/gi, '');
  s = s.replace(/\s*onmouseout="this\.style\.borderColor='rgba\(184,136,42,\.2\)';this\.style\.background='#faf8f5';this\.style\.transform='translateY\(0\)'"/gi, '');
  // Добавить класс gb-series-link на ссылки, в style которых rgba(184,136,42,.2)
  s = s.replace(/<a [^>]*?style="[^"]*rgba\(184,136,42,\.2\)[^"]*"[^>]*?>/g, function (tag) {
    if (/class="[^"]*gb-series-link/.test(tag)) return tag;
    if (/class="([^"]*)"/.test(tag)) return tag.replace(/class="([^"]*)"/, 'class="$1 gb-series-link"');
    return tag.replace('<a ', '<a class="gb-series-link" ');
  });
  // closeMobileNav() → data-close-nav
  s = s.replace(/onclick="closeMobileNav\(\)"/g, 'data-close-nav');
  // openSearch / GBSearch → data-action="open-search"
  s = s.replace(/onclick="window\.dispatchEvent\(new CustomEvent\('gb:openSearch'\)\)"/g, 'data-action="open-search"');
  s = s.replace(/onclick="window\.GBSearch && window\.GBSearch\.open\(\)"/g, 'data-action="open-search"');
  if (s !== orig) {
    write(file, s);
    stats.inlineHandlersRemoved++;
    return true;
  }
  return false;
}

/* ─── 9. JSON-LD normalize: editor/author → @id ───────────────────── */
function normalizeJsonLD(file) {
  let html = read(file);
  const ldRe = /<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let touched = false;
  html = html.replace(ldRe, (full, jsonText) => {
    let data; try { data = JSON.parse(jsonText); } catch { return full; }
    let modified = false;
    const PERSON_ID = 'https://gospod-bog.ru/about/#person';
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      // editor: если это полный Person с url=about — заменить на @id ref
      if (node.editor && typeof node.editor === 'object' && !Array.isArray(node.editor)) {
        const e = node.editor;
        const isOur = e['@id'] === PERSON_ID || (e.url && e.url.indexOf('/about/') !== -1) ||
                      (e.name && /Фёдор Милованов/.test(e.name));
        if (isOur && Object.keys(e).length > 1) {
          node.editor = { "@id": PERSON_ID };
          modified = true;
        }
      }
      // author: то же — но только если автор Фёдор (для Тип A/B)
      if (node.author && typeof node.author === 'object' && !Array.isArray(node.author)) {
        const a = node.author;
        const isOur = a['@id'] === PERSON_ID ||
                      ((a.url && a.url.indexOf('/about/') !== -1) && /Фёдор Милованов/.test(a.name || ''));
        if (isOur && Object.keys(a).length > 1) {
          node.author = { "@id": PERSON_ID };
          modified = true;
        }
      }
      // translator: то же
      if (node.translator && typeof node.translator === 'object' && !Array.isArray(node.translator)) {
        const t = node.translator;
        const isOur = t['@id'] === PERSON_ID ||
                      ((t.url && t.url.indexOf('/about/') !== -1) && /Фёдор Милованов/.test(t.name || ''));
        if (isOur && Object.keys(t).length > 1) {
          node.translator = { "@id": PERSON_ID };
          modified = true;
        }
      }
      // BreadcrumbList — добавить @id если нет
      if (node['@type'] === 'BreadcrumbList' && !node['@id']) {
        const last = node.itemListElement && node.itemListElement[node.itemListElement.length - 1];
        const url = last && (last.item || (last.item && last.item['@id']));
        if (url) { node['@id'] = url + '#breadcrumbs'; modified = true; }
      }
      for (const k of Object.keys(node)) visit(node[k]);
    };
    visit(data); if (data['@graph']) data['@graph'].forEach(visit);
    if (!modified) return full;
    touched = true;
    return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</script>';
  });
  if (touched) {
    write(file, html);
    stats.jsonldNormalized++;
  }
  return touched;
}

/* ─── 10. Translator-нода для Тип C (Нагорная) ────────────────────── */
function addTranslatorForNagornaya(file) {
  if (!/^nagornaya\/chast-\d\/index\.html$/.test(rel(file))) return false;
  let html = read(file);
  let touched = false;
  // Добавить <meta name="translator" content="Фёдор Милованов"> если нет
  if (!/<meta\s+name="translator"/i.test(html)) {
    html = html.replace(/(<meta\s+name="author"[^>]*>)/i,
      '$1\n<meta name="translator" content="Фёдор Милованов">');
    touched = true;
  }
  // Добавить translator: { @id } в JSON-LD Article если нет
  const ldRe = /<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  html = html.replace(ldRe, (full, jsonText) => {
    let data; try { data = JSON.parse(jsonText); } catch { return full; }
    let modified = false;
    const visit = (n) => {
      if (!n || typeof n !== 'object') return;
      const t = n['@type'];
      const isArticle = t === 'Article' || t === 'ScholarlyArticle' ||
        (Array.isArray(t) && t.some(x => /Article/.test(x)));
      if (isArticle && !n.translator) {
        n.translator = { "@id": "https://gospod-bog.ru/about/#person" };
        modified = true;
      }
      for (const k of Object.keys(n)) visit(n[k]);
    };
    visit(data); if (data['@graph']) data['@graph'].forEach(visit);
    if (!modified) return full;
    touched = true;
    return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</script>';
  });
  if (touched) {
    write(file, html);
    stats.translatorAdded++;
  }
  return touched;
}

/* ─── 11. Emoji в production-интерфейсе → SVG ─────────────────────── */
const SVG_BOOK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-2px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
const SVG_CLOSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="display:inline-block;vertical-align:-1px"><path d="M6 6l12 12M18 6l-12 12"/></svg>';

function replaceEmoji(file) {
  let s = read(file), orig = s;
  // Заменяем 📖 в bookmark-toast-icon (article-страницы)
  s = s.replace(/<span aria-hidden="true" class="bookmark-toast-icon">📖<\/span>/g,
    '<span aria-hidden="true" class="bookmark-toast-icon">' + SVG_BOOK + '</span>');
  // Заменяем ✕ в кнопках закрытия (btoc-close, bookmark-toast-close, popover-close-btn)
  s = s.replace(/(<button[^>]+class="btoc-close"[^>]*>)✕(<\/button>)/g, '$1' + SVG_CLOSE + '$2');
  s = s.replace(/(<button[^>]+class="bookmark-toast-close"[^>]*>)✕(<\/button>)/g, '$1' + SVG_CLOSE + '$2');
  s = s.replace(/(<div class="popover-close-btn">)✕(<\/div>)/g, '$1' + SVG_CLOSE + '$2');
  // 📖 Осталось — оставляем только текст в btocTimeLeft (без эмодзи)
  s = s.replace(/<span id="btocTimeLeft">📖 Осталось:/g, '<span id="btocTimeLeft">Осталось:');
  if (s !== orig) {
    write(file, s);
    stats.emojiReplaced++;
    return true;
  }
  return false;
}

/* ─── 12. mailto subject/body автоподстановка ─────────────────────── */
function fillMailto(file) {
  let s = read(file), orig = s;
  // Уже расширенные mailto оставляем; целимся в простой mailto:viktorco2012@gmail.com без ?
  s = s.replace(/href="mailto:viktorco2012@gmail\.com"\s*\n([^>]*?aria-label="Написать на Email")/g,
    function (full, rest) {
      // Не трогаем если уже есть subject
      if (full.includes('?subject=')) return full;
      return 'href="mailto:viktorco2012@gmail.com?subject=Неточность%20в%20статье&body=Здравствуйте%2C%0A%0AЯ%20нашёл%20неточность%20в%20материале.%0A%0AОписание%3A%20"\n' + rest;
    });
  if (s !== orig) {
    write(file, s);
    stats.mailtoFilled++;
    return true;
  }
  return false;
}

/* ─── EXECUTION ───────────────────────────────────────────────────── */
log('1/12 BreadcrumbList → @graph');
htmlFiles.forEach(f => { if (mergeBreadcrumbs(f)) { stats.breadcrumbsMerged++; log('  merged:', rel(f)); } });

log('2/12 speakable во все Article JSON-LD');
htmlFiles.forEach(f => { if (addSpeakable(f)) { stats.speakableAdded++; log('  speakable+:', rel(f)); } });

log('3/12 .summary-card в недостающие статьи');
htmlFiles.forEach(f => { if (addSummaryCard(f)) { stats.summaryAdded++; log('  summary+:', rel(f)); } });

log('4/12 Self-host Google Fonts');
htmlFiles.forEach(f => { if (localiseFonts(f)) { stats.fontsLocalised++; log('  fonts→local:', rel(f)); } });

log('5/12 z-index → CSS-tokens');
allFiles.forEach(f => { if (/\.(html|css|js)$/.test(f) && !f.endsWith('.min.css')) replaceZIndex(f); });

log('6/12 «Автор» → «Редактор»');
htmlFiles.forEach(f => { if (fixAuthorLabel(f)) stats.authorLabelFixed++; });

log('7/12 feed.xml');
if (fixFeed()) stats.feedFixed++;

log('8/12 Inline handlers');
htmlFiles.forEach(f => { removeInlineHandlers(f); });

log('9/12 JSON-LD normalize (editor/author/translator → @id)');
htmlFiles.forEach(f => { normalizeJsonLD(f); });

log('10/12 translator-нода для Тип C (Нагорная)');
htmlFiles.forEach(f => { addTranslatorForNagornaya(f); });

log('11/12 Emoji → SVG в production-UI');
htmlFiles.forEach(f => { replaceEmoji(f); });

log('12/12 mailto subject/body autofill');
htmlFiles.forEach(f => { fillMailto(f); });

console.log('\n[patch-v2] Сводка:');
console.log(JSON.stringify(stats, null, 2));
