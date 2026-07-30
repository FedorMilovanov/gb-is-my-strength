from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "scripts/home-browser-contract.mjs"

old = """    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });
    assert.equal(await searchInput.evaluate((element) => element === document.activeElement), true, 'canonical Ctrl+K did not focus search input');
"""
new = """    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const input = document.querySelector('.cp-input');
      return input !== null && input === document.activeElement;
    });
    assert.equal(await searchInput.evaluate((element) => element === document.activeElement), true, 'canonical Ctrl+K did not focus search input');
"""

text = TARGET.read_text(encoding="utf-8")
count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one immediate search-focus assertion block, found {count}")
text = text.replace(old, new, 1)
if "await page.waitForFunction(() => {\n      const input = document.querySelector('.cp-input');" not in text:
    raise SystemExit("condition-based focus readiness was not installed")
if "await page.waitForTimeout" in new:
    raise SystemExit("arbitrary timeout is forbidden in the focus readiness fix")
TARGET.write_text(text, encoding="utf-8")
print("home search focus contract updated")
