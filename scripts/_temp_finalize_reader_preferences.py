#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'scripts/reader-preferences-regression-test.js',
    """  assert(source.includes('ReaderPreferencesHead'), `${path.relative(ROOT, file)} must import shared head preferences`);
  assert(source.includes('<ReaderPreferencesHead />'), `${path.relative(ROOT, file)} must render shared head preferences`);
}""",
    """  assert(source.includes('ReaderPreferencesHead'), `${path.relative(ROOT, file)} must import shared head preferences`);
  assert(source.includes('<ReaderPreferencesHead />'), `${path.relative(ROOT, file)} must render shared head preferences`);
  const preferenceIndex = source.indexOf('<ReaderPreferencesHead />');
  const charset = /<meta\\s+[^>]*charset\\s*=\\s*[\"']?[^>]+>/i.exec(source);
  const csp = /<meta\\s+[^>]*http-equiv\\s*=\\s*[\"']Content-Security-Policy[\"'][^>]*>/i.exec(source);
  if (charset) assert(preferenceIndex > charset.index + charset[0].length - 1, `${path.relative(ROOT, file)} preferences must follow charset`);
  if (csp) assert(preferenceIndex > csp.index + csp[0].length - 1, `${path.relative(ROOT, file)} preferences must follow CSP`);
}""",
    'Astro ordering assertions',
)

replace_once(
    'scripts/reader-preferences-regression-test.js',
    """  assert(source.includes('js/reader-preferences-head.js?v='), `${path.relative(ROOT, file)} missing first-paint bootstrap`);
  assert(source.includes('css/reader-preferences.css?v='), `${path.relative(ROOT, file)} missing preference tokens`);
  assert(source.includes('js/reader-preferences.js?v='), `${path.relative(ROOT, file)} missing preference runtime`);
}""",
    """  assert(source.includes('js/reader-preferences-head.js?v='), `${path.relative(ROOT, file)} missing first-paint bootstrap`);
  assert(source.includes('css/reader-preferences.css?v='), `${path.relative(ROOT, file)} missing preference tokens`);
  assert(source.includes('js/reader-preferences.js?v='), `${path.relative(ROOT, file)} missing preference runtime`);
  const preferenceIndex = source.indexOf('js/reader-preferences-head.js?v=');
  const charset = /<meta\\s+[^>]*charset\\s*=\\s*[\"']?[^>]+>/i.exec(source);
  const csp = /<meta\\s+[^>]*http-equiv\\s*=\\s*[\"']Content-Security-Policy[\"'][^>]*>/i.exec(source);
  if (charset) assert(preferenceIndex > charset.index + charset[0].length - 1, `${path.relative(ROOT, file)} preferences must follow charset`);
  if (csp) assert(preferenceIndex > csp.index + csp[0].length - 1, `${path.relative(ROOT, file)} preferences must follow CSP`);
}""",
    'legacy ordering assertions',
)

replace_once(
    'src/components/article-pilots/gill-series/GillReaderSettingsSheet.astro',
    ''' * Sepia is scoped to [data-gill-v16][data-gill-reader-theme="sepia"] under
 * a <64em media query (see css/floating-cluster.css) — it never touches
 * html.sepia (doesn't exist sitewide) or bleeds into desktop/other routes.
 * "Ночь" reuses the existing sitewide html.dark toggle so there is only
 * ONE dark-mode implementation, not a second competing one.
 *''',
    ''' * State comes from the universal GBReaderPreferences store. Existing Gill
 * attributes/CSS variables remain a compatibility adapter so visual parity and
 * selectors stay stable while Day, Sepia, Night, line height and measure now
 * persist across books, series, standalone articles and ordinary pages.
 *''',
    'Gill settings documentation',
)

replace_once(
    'src/components/article-pilots/_shared/ReaderSettings.astro',
    ''' * Полностью самодостаточен: своя разметка (паттерн .hmsheet), свои scoped-стили
 * и свой <script>. НЕ трогает [data-gill-v16]-CSS и floating-cluster.* — чтобы
 * гарантированно не задеть рабочую мобилку Gill. Тема/интервал/ширина
 * применяются к #content и запоминаются в собственных localStorage-ключах.
 *
 * Открывается по событию `hm:open-settings` (шестерёнку в нижнем баре шлёт
 * HermenevtikaMobileBar). Размер текста переиспользует общесайтовый контракт
 * data-fc-action="font-up/down" — как и Gill.
 *''',
    ''' * Разметка и scoped-стили остаются самостоятельным standalone-adapter, чтобы
 * не менять рабочие селекторы Hermenevtika/Kod Da Vinci. Состояние больше не
 * принадлежит компоненту: тема, сепия, интервал, ширина и размер текста читаются
 * и записываются через общий GBReaderPreferences store.
 *
 * Открывается по событию `hm:open-settings`; размер текста сохраняет существующий
 * data-fc-action="font-up/down" контракт через общий floating-cluster adapter.
 *''',
    'standalone settings documentation',
)

replace_once(
    'src/components/article-pilots/_shared/ReaderSettings.astro',
    '''    /* --- Scoped sepia (mobile only), отчётливая тёплая бумага — не трогает
       html.dark/site theme; заметно контрастнее дефолтного кремового. --- */''',
    '''    /* Compatibility selector for existing standalone article CSS. The canonical
       Sepia state is global; GBReaderPreferences mirrors it onto this root. */''',
    'standalone sepia CSS documentation',
)

replace_once(
    'src/components/article-pilots/gill-series/GillSeriesMobileBar.astro',
    ''' *   BOTTOM bar: dual-progress ring → «Сейчас читаете» (opens Part TOC,
 *     unchanged) → theme cycle (День→Сепия→Ночь→День,
 *     window.applyGillReaderTheme) → settings sheet trigger → «Поделиться»''',
    ''' *   BOTTOM bar: dual-progress ring → «Сейчас читаете» (opens Part TOC,
 *     unchanged) → fast binary Day/Night toggle through the canonical global
 *     preference adapter (Sepia remains in Settings) → settings → «Поделиться»''',
    'Gill mobile bar documentation',
)

print('reader preference ordering assertions and adapter documentation finalized')
