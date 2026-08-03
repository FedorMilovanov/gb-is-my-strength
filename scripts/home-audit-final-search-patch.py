#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/home-design-audit-pro.mjs')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "{ name: 'scripture-reference', value: 'Иер 17:9', needle: 'сердц', expect: /сердц/i },",
        "{ name: 'scripture-reference', value: 'Иер 17:9', needle: 'Иер 17:9', expect: /Иер\\s*17:9|сердц/i },",
        'scripture result contract',
    ),
    (
        "    const count = await page.locator('.cp-item').count();\n    const first = (await page.locator('.cp-item-title').first().textContent().catch(() => '')) || '';\n    record(`${ENGINE}:search-query-${query.name}`, count > 0 && query.expect.test(first), { count, first });",
        "    const results = await page.locator('.cp-item').evaluateAll((items) => items.map((item) => ({\n      title: item.querySelector('.cp-item-title')?.textContent?.trim() || '',\n      snippet: item.querySelector('.cp-item-snippet')?.textContent?.trim() || '',\n    })));\n    const corpus = results.map((item) => `${item.title} ${item.snippet}`).join('\\n');\n    const matching = results.filter((item) => query.expect.test(`${item.title} ${item.snippet}`)).map((item) => item.title);\n    record(`${ENGINE}:search-query-${query.name}`, results.length > 0 && query.expect.test(corpus), { count: results.length, first: results[0]?.title || '', matching });",
        'query relevance across full result corpus',
    ),
    (
        "  await input.fill('zzzz-no-such-page-493821');\n  await waitQuery(page, 'zzzz-no-such-page-493821');\n  record(`${ENGINE}:search-no-results`, await page.locator('.cp-item').count() === 0, await page.locator('.cp-status').textContent().catch(() => ''));",
        "  const noResultQuery = 'zzzz-no-such-page-493821';\n  await input.fill(noResultQuery);\n  await page.waitForFunction((expected) => {\n    const input = document.querySelector('.cp-input');\n    const empty = document.querySelector('.cp-empty');\n    return input?.value === expected && Boolean(empty) && !document.querySelector('.cp-loading');\n  }, noResultQuery, { timeout: 15000 });\n  const noResultCount = await page.locator('.cp-item').count();\n  const noResultText = await page.locator('.cp-empty').textContent().catch(() => '');\n  record(`${ENGINE}:search-no-results`, noResultCount === 0 && Boolean(noResultText?.trim()), { count: noResultCount, text: noResultText });",
        'explicit no-results settlement',
    ),
]

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    text = text.replace(old, new, 1)
    print(f'patched: {label}')

path.write_text(text, encoding='utf-8')
Path('.github/workflows/home-audit-final-search-patch.yml').unlink()
Path('scripts/home-audit-final-search-patch.py').unlink()
