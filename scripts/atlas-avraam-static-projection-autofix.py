from pathlib import Path

avraam_path = Path('src/components/karty/avraam/AvraamMap.astro')
fallback_path = Path('src/components/karty/_shared/MapRuntimeFallback.astro')
witness_path = Path('scripts/avraam-static-projection-witness.mjs')

avraam = avraam_path.read_text(encoding='utf-8')
old_h1 = '<h1 class="sr-only" data-pagefind-body>Путь Авраама — интерактивная карта. От Ура Халдейского до горы Мория: 19 мест, 8 этапов, 5 сюжетов (Лех-леха, Война царей, Акеда), археология, хронология 175 лет.</h1>'
new_h1 = '<h1 class="sr-only" data-pagefind-body>Путь Авраама — интерактивная карта. От Ура Халдейского до горы Мория: 22 объекта — 19 маршрутных мест и 3 контекстные точки; 8 этапов; 5 сюжетов; археология; хронология 175 лет.</h1>'
old_section = '<section class="sr-only map-text-fallback" data-pagefind-body aria-label="Путь Авраама — текстовая версия карты с источниками">'
new_section = '<section class="sr-only map-text-fallback" data-map-static-projection data-pagefind-body aria-label="Путь Авраама — текстовая версия карты с источниками">'
old_heading = '  <h2>Путь Авраама по Бытие 11–25: маршрут, этапы и историко-археологический контекст</h2>\n'
new_heading = old_heading + '  <p class="map-static-facts"><strong>Состав карты:</strong> 22 объекта — 19 маршрутных мест и 3 контекстные точки; 8 этапов; 5 сюжетов; 40 фотографий.</p>\n'
for label, old in [('H1', old_h1), ('fallback section', old_section), ('fallback heading', old_heading)]:
    count = avraam.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor count drift: {count}')
avraam = avraam.replace(old_h1, new_h1, 1)
avraam = avraam.replace(old_section, new_section, 1)
avraam = avraam.replace(old_heading, new_heading, 1)
if avraam.count('22 объекта') != 2:
    raise SystemExit(f'unexpected 22-object count: {avraam.count("22 объекта")}')
if avraam.count('data-map-static-projection') != 1:
    raise SystemExit('static projection marker did not materialize exactly once')
avraam_path.write_text(avraam, encoding='utf-8')

fallback = fallback_path.read_text(encoding='utf-8')
nojs_anchor = '''    .map-text-fallback a {
      color: #9fd7ff !important;
    }
'''
nojs_replacement = nojs_anchor + '''
    .map-text-fallback .map-static-facts {
      margin: 0 0 24px !important;
      padding: 14px 16px !important;
      border-left: 3px solid #e8c879 !important;
      background: rgba(232, 200, 121, 0.08) !important;
      color: #f2ead5 !important;
    }
'''
print_anchor = '''  @media (max-width: 420px) {
'''
print_css = '''  @media print {
    @page {
      size: A4;
      margin: 14mm 13mm 16mm;
    }

    html,
    body {
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      background: #fff !important;
      color: #111 !important;
    }

    [data-map-stage],
    .me-map,
    .map-runtime-noscript {
      display: none !important;
    }

    .map-text-fallback.sr-only[data-map-static-projection] {
      display: block !important;
      position: static !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      clip: auto !important;
      clip-path: none !important;
      white-space: normal !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      color: #111 !important;
      box-shadow: none !important;
      font: 11pt/1.48 Georgia, "Times New Roman", serif !important;
    }

    .map-text-fallback[data-map-static-projection] h2 {
      margin: 0 0 8mm !important;
      color: #111 !important;
      font: 700 22pt/1.14 Georgia, "Times New Roman", serif !important;
      break-after: avoid-page;
    }

    .map-text-fallback[data-map-static-projection] h3 {
      margin: 7mm 0 2.5mm !important;
      color: #111 !important;
      font: 700 14pt/1.22 Georgia, "Times New Roman", serif !important;
      break-after: avoid-page;
    }

    .map-text-fallback[data-map-static-projection] p,
    .map-text-fallback[data-map-static-projection] li {
      color: #111 !important;
      orphans: 3;
      widows: 3;
    }

    .map-text-fallback[data-map-static-projection] ol,
    .map-text-fallback[data-map-static-projection] ul {
      padding-left: 1.5em !important;
    }

    .map-text-fallback[data-map-static-projection] a {
      color: #111 !important;
      text-decoration: underline !important;
    }

    .map-text-fallback[data-map-static-projection] .map-static-facts {
      margin: 0 0 7mm !important;
      padding: 4mm 5mm !important;
      border: 0.35mm solid #8b6a22 !important;
      border-left-width: 1.2mm !important;
      background: #f6f0df !important;
      color: #111 !important;
      break-inside: avoid-page;
    }
  }

'''
if fallback.count(nojs_anchor) != 1:
    raise SystemExit(f'no-JS style anchor count drift: {fallback.count(nojs_anchor)}')
if fallback.count(print_anchor) != 1:
    raise SystemExit(f'print insertion anchor count drift: {fallback.count(print_anchor)}')
fallback = fallback.replace(nojs_anchor, nojs_replacement, 1)
fallback = fallback.replace(print_anchor, print_css + print_anchor, 1)
if fallback.count('@media print') != 1:
    raise SystemExit('print contract did not materialize exactly once')
if fallback.count('data-map-static-projection') < 7:
    raise SystemExit('print projection selectors incomplete')
fallback_path.write_text(fallback, encoding='utf-8')

witness = witness_path.read_text(encoding='utf-8')
old_map = '      mapPresent: Boolean(map),'
new_map = '      mapVisible: Boolean(map && map.getClientRects().length),'
old_verify = "  if (snapshot.mapPresent) fail('interactive map remains present');"
new_verify = "  if (snapshot.mapVisible) fail('interactive map remains visible');"
if witness.count(old_map) != 1:
    raise SystemExit(f'witness map anchor count drift: {witness.count(old_map)}')
if witness.count(old_verify) != 1:
    raise SystemExit(f'witness verification anchor count drift: {witness.count(old_verify)}')
witness = witness.replace(old_map, new_map, 1).replace(old_verify, new_verify, 1)
witness_path.write_text(witness, encoding='utf-8')

print('AVRAAM STATIC PROJECTION APPLIED')
