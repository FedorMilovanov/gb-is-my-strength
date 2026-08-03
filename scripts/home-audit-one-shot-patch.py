#!/usr/bin/env python3
from pathlib import Path
import re


def replace_exact(path: str, old: str, new: str, label: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} exact matches in {path}, got {count}')
    file.write_text(text.replace(old, new), encoding='utf-8')
    print(f'patched {label}: {path}')


def replace_regex(path: str, pattern: str, replacement: str, label: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, flags=re.MULTILINE | re.DOTALL)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} regex matches in {path}, got {count}')
    file.write_text(updated, encoding='utf-8')
    print(f'patched {label}: {path}')


replace_exact(
    'src/components/home/HomePageHead.astro',
    '<meta http-equiv="X-Content-Type-Options" content="nosniff">\n',
    '',
    'remove invalid http-equiv meta',
)
replace_exact(
    'src/components/home/HomeHero.astro',
    '<div class="h-hero-brand" aria-label="Богословская библиотека «Господь Бог — Сила Моя»">',
    '<div class="h-hero-brand">',
    'remove invalid generic aria-label',
)

audit = 'scripts/home-design-audit-pro.mjs'
replace_exact(
    audit,
    "const sections = ['#issledovat', '#publikacii', '.h-quote-section', '.h-about', '.article-end-sdg-wrap', '.h-footer']",
    "const sections = ['#issledovat', '#publikacii', '.h-about', '.h-quote-section', '.article-end-sdg-wrap', '.h-footer']",
    'correct actual INDEX section order',
)

replace_regex(
    audit,
    r"^async function waitQuery\(page, query\) \{.*?^\}",
    '''async function waitQuery(page, query, expectedTitle = '') {
  await page.waitForFunction(({ query: expectedQuery, expectedTitle: titleNeedle }) => {
    const input = document.querySelector('.cp-input');
    if (input?.value !== expectedQuery || document.querySelector('.cp-loading')) return false;
    const headings = [...document.querySelectorAll('.cp-group-hd > span:first-child')]
      .map((node) => node.textContent?.trim() || '');
    const staleHeadings = new Set(['Рекомендуемое', 'Новое', 'Недавние запросы', 'Популярные исследования']);
    const processed = headings.some((heading) => heading && !staleHeadings.has(heading));
    const empty = Boolean(document.querySelector('.cp-empty'));
    const titles = [...document.querySelectorAll('.cp-item-title')]
      .map((node) => (node.textContent || '').toLocaleLowerCase('ru-RU'));
    const matched = !titleNeedle || titles.some((title) => title.includes(titleNeedle.toLocaleLowerCase('ru-RU')));
    return (processed || empty) && matched;
  }, { query, expectedTitle }, { timeout: 15000 });
  await page.waitForTimeout(80);
}''',
    'wait for processed Pagefind results',
)

replace_exact(
    audit,
    "  const queries = [\n",
    "  const allScope = page.locator('.cp-scope-chip[data-scope=\"all\"]');\n  await allScope.click();\n  const queries = [\n",
    'reset scope before query matrix',
)
for old, new, label in [
    ("{ name: 'canonical-title', value: 'Нагорная проповедь', expect: /Нагорная\\s+проповедь/i }",
     "{ name: 'canonical-title', value: 'Нагорная проповедь', needle: 'Нагорная проповедь', expect: /Нагорная\\s+проповедь/i }",
     'canonical query needle'),
    ("{ name: 'scripture-reference', value: 'Иер 17:9', expect: /сердц/i }",
     "{ name: 'scripture-reference', value: 'Иер 17:9', needle: 'сердц', expect: /сердц/i }",
     'scripture query needle'),
    ("{ name: 'partial-cyrillic', value: 'герменевтик', expect: /герменевтик/i }",
     "{ name: 'partial-cyrillic', value: 'герменевтик', needle: 'герменевтик', expect: /герменевтик/i }",
     'partial query needle'),
    ("{ name: 'trimmed-query', value: '  Джон Гилл  ', expect: /Джон\\s+Гилл/i }",
     "{ name: 'trimmed-query', value: '  Джон Гилл  ', needle: 'Джон Гилл', expect: /Джон\\s+Гилл/i }",
     'trimmed query needle'),
]:
    replace_exact(audit, old, new, label)

replace_exact(
    audit,
    '    await waitQuery(page, query.value);',
    '    await waitQuery(page, query.value, query.needle);',
    'wait for query-specific result',
)
replace_exact(
    audit,
    "  await waitQuery(page, 'Нагорная проповедь');",
    "  await waitQuery(page, 'Нагорная проповедь', 'Нагорная проповедь');",
    'wait for canonical result after rapid and scope checks',
    expected=2,
)
replace_exact(
    audit,
    "  }\n\n  await input.fill('Нагорная проповедь');\n",
    "  }\n  await allScope.click();\n\n  await input.fill('Нагорная проповедь');\n",
    'restore all scope before ranking checks',
)
replace_exact(
    audit,
    "const dialog = document.querySelector('.cp-dialog')?.getBoundingClientRect();",
    "const dialog = document.querySelector('.cp-box')?.getBoundingClientRect();",
    'measure actual search dialog',
)
replace_exact(
    audit,
    "  const input = page.locator('.cp-input');\n  await input.waitFor({ state: 'visible' });\n  return input;",
    "  const input = page.locator('.cp-input');\n  await input.waitFor({ state: 'visible' });\n  await page.waitForFunction(() => document.querySelector('.cp-input') === document.activeElement, undefined, { timeout: 5000 });\n  return input;",
    'wait for canonical search focus',
)

replace_exact(
    '.github/workflows/home-live-external-audit.yml',
    'curl -sS --max-time 240 --retry 2 --get \\\n',
    'curl -sS --max-time 240 --get \\\n',
    'avoid concatenated PageSpeed error JSON',
)

Path('.github/workflows/home-audit-one-shot-patch.yml').unlink()
Path('scripts/home-audit-one-shot-patch.py').unlink()
print('one-shot patch source removed')
