#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'patched {label}: {relative}')


replace_once(
    'js/reader-preferences.js',
    '''    // During the compatibility window another tab may still use the old
    // binary theme toggle. Import that change instead of allowing divergence.
    if (event.key === 'theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
      commit({ theme: event.newValue }, { source: 'legacy-storage' });
    }
''',
    '''    // During the compatibility window another tab may still use the old
    // binary theme toggle. Canonical Sepia is intentionally stronger: our own
    // compatibility write (`theme=light`) must never downgrade another tab.
    if (event.key === 'theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
      var canonical = parseStored(safeGet(STORAGE_KEY));
      if (canonical && canonical.theme === 'sepia') return;
      if (canonical && canonical.theme === event.newValue) return;
      commit({ theme: event.newValue }, { source: 'legacy-storage' });
    }
''',
    'cross-tab canonical Sepia precedence',
)

replace_once(
    'scripts/reader-preferences-browser-smoke.js',
    '''    // 6. Representative mobile width matrix.
    for (const width of WIDTHS) {
''',
    '''    // 6. Canonical Sepia survives the compatibility `theme=light` storage
    // event and remains synchronized across two simultaneously open tabs.
    {
      const left = await openSurface(context, ROUTES.page);
      const right = await openSurface(context, ROUTES.gill);
      await left.page.evaluate(() => window.GBReaderPreferences.setTheme('dark', { source: 'cross-tab-precondition' }));
      await right.page.waitForFunction(() => window.GBReaderPreferences?.get?.().theme === 'dark', null, { timeout: 8000 });
      await left.page.evaluate(() => window.GBReaderPreferences.setTheme('sepia', { source: 'cross-tab-sepia' }));
      await right.page.waitForFunction(() => window.GBReaderPreferences?.get?.().theme === 'sepia', null, { timeout: 8000 });
      await left.page.waitForTimeout(250);
      const leftState = await snapshot(left.page);
      const rightState = await snapshot(right.page);
      result(
        'Canonical Sepia remains synchronized across tabs',
        left.errors.length === 0 && right.errors.length === 0 &&
          left.failed.length === 0 && right.failed.length === 0 &&
          leftState.theme === 'sepia' && rightState.theme === 'sepia' &&
          leftState.prefs?.theme === 'sepia' && rightState.prefs?.theme === 'sepia' &&
          JSON.parse(leftState.canonical || '{}').theme === 'sepia' &&
          JSON.parse(rightState.canonical || '{}').theme === 'sepia',
        { leftState, rightState, leftErrors: left.errors, rightErrors: right.errors, leftFailed: left.failed, rightFailed: right.failed },
      );
      await left.page.close();
      await right.page.close();
    }

    // 7. Representative mobile width matrix.
    for (const width of WIDTHS) {
''',
    'two-tab Sepia browser witness',
)

print('reader cross-tab patch complete')
