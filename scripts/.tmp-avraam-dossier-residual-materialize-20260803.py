#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENGINE = ROOT / "karty/_engine/map-engine.js"
WITNESS = ROOT / "scripts/avraam-dossier-witness.mjs"
SELF = ROOT / "scripts/.tmp-avraam-dossier-residual-materialize-20260803.py"
WORKFLOW = ROOT / ".github/workflows/.tmp-avraam-dossier-residual-materialize-20260803.yml"

EXPECTED_SHA256 = {
    ENGINE: "e6fae3b5ce7239a687034b488b33e601f635b42f4a8b5f54c37dcbaea260bcfb",
    WITNESS: "3ff7efa22ac72eb9f300cfca733cb874882bbc40615719f3f2b149e7e4244c6b",
}
EXPECTED_AFTER = {
    ENGINE: "8fd1f82b2980514da5712ac0900e1465d0b95b2ec296c876029eb531b18a88f0",
    WITNESS: "3b576706d5b58dc644fd550b1a2274038f197bd6f8596c0580a112a421ec168e",
}


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


for path, expected in EXPECTED_SHA256.items():
    actual = digest(path)
    if actual != expected:
        raise RuntimeError(f"source drift for {path.relative_to(ROOT)}: {actual} != {expected}")

engine = ENGINE.read_text(encoding="utf-8")
engine = replace_once(
    engine,
    "btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});",
    "btn.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});",
    "deterministic tab activation scroll",
)
engine = replace_once(
    engine,
    "requestAnimationFrame(()=>initialTab?.scrollIntoView({block:'nearest',inline:'start'}));",
    "requestAnimationFrame(()=>initialTab?.scrollIntoView({behavior:'auto',block:'nearest',inline:'start'}));",
    "deterministic initial tab scroll",
)
ENGINE.write_text(engine, encoding="utf-8")

witness = WITNESS.read_text(encoding="utf-8")
witness = replace_once(
    witness,
    """  const mainStory = page.locator('[data-story=\"main\"]');
  if (await mainStory.count()) {
    await mainStory.first().click({ force: true }).catch(() => mainStory.first().evaluate(node => node.click()));
    await page.waitForTimeout(120);
  }
}""",
    """  const mainStory = page.locator('[data-story=\"main\"]');
  if (await mainStory.count()) {
    await mainStory.first().click({ force: true }).catch(() => mainStory.first().evaluate(node => node.click()));
    await page.waitForTimeout(120);
  }

  // The dossier inventory covers every route place, including places on
  // default-off candidate/war layers. Enable those layers through their real
  // controls before exercising markers; do not synthesize clicks on hidden DOM.
  const layerSummary = page.locator('.me-layers__summary');
  const disabledLayers = page.locator('.me-layers__toggle[aria-pressed=\"false\"]');
  if (await disabledLayers.count()) {
    if (await layerSummary.count()) await layerSummary.click();
    while (await disabledLayers.count()) {
      await disabledLayers.first().click();
      await page.waitForTimeout(40);
    }
  }
}""",
    "enable default-off layers through real controls",
)
witness = replace_once(
    witness,
    """      await marker.focus().catch(() => {});
      await marker.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
      await page.locator('.me-panel--open').waitFor({ state: 'visible', timeout: 5000 });""",
    """      await marker.focus();
      const markerEntry = await marker.evaluate(node => ({
        focused: document.activeElement === node,
        role: node.getAttribute('role'),
        tabIndex: node.tabIndex,
        ariaHidden: node.getAttribute('aria-hidden'),
        layerHidden: node.getAttribute('data-me-layer-hidden'),
      }));
      if (!markerEntry.focused || markerEntry.role !== 'button' || markerEntry.tabIndex !== 0 || markerEntry.ariaHidden === 'true' || markerEntry.layerHidden === '1') {
        fail(placeScope, `marker is not keyboard-reachable ${JSON.stringify(markerEntry)}`);
        continue;
      }
      await page.keyboard.press('Enter');
      await page.locator('.me-panel--open').waitFor({ state: 'visible', timeout: 5000 });""",
    "keyboard marker entry",
)
witness = replace_once(
    witness,
    """        await tab.click({ force: true });
        await page.waitForTimeout(70);""",
    """        await tab.evaluate(node => node.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' }));
        await page.waitForFunction(node => {
          const strip = node.closest('.me-tabs');
          if (!strip) return false;
          const tabRect = node.getBoundingClientRect();
          const stripRect = strip.getBoundingClientRect();
          return tabRect.left >= stripRect.left - 1 && tabRect.right <= stripRect.right + 1;
        }, await tab.elementHandle());
        await tab.click();
        await page.waitForTimeout(70);""",
    "physical visible tab click",
)
witness = replace_once(
    witness,
    """      if (present) {
        await marker.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        await page.waitForTimeout(100);
        panelOpened = Boolean(await page.locator('.me-panel--open').count());
      }
      if (panelOpened) fail(scope, 'context point opened a route dossier');
      result.contextPoints.push({ id: place.id, present, panelOpened });""",
    """      let markerState = null;
      if (present) {
        markerState = await marker.evaluate(node => ({
          role: node.getAttribute('role'),
          tabIndex: node.getAttribute('tabindex'),
          ariaHidden: node.getAttribute('aria-hidden'),
        }));
        if (markerState.role || markerState.tabIndex !== null || markerState.ariaHidden !== 'true') {
          fail(scope, `context point is unexpectedly interactive ${JSON.stringify(markerState)}`);
        }
        await marker.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        await page.waitForTimeout(100);
        panelOpened = Boolean(await page.locator('.me-panel--open').count());
      }
      if (panelOpened) fail(scope, 'context point opened a route dossier');
      result.contextPoints.push({ id: place.id, present, panelOpened, markerState });""",
    "context point noninteractive contract",
)
WITNESS.write_text(witness, encoding="utf-8")

for path, expected in EXPECTED_AFTER.items():
    actual = digest(path)
    if actual != expected:
        raise RuntimeError(f"post-materialize digest mismatch for {path.relative_to(ROOT)}: {actual} != {expected}")

run("node", "--check", str(ENGINE.relative_to(ROOT)))
run("node", "--check", str(WITNESS.relative_to(ROOT)))
run("git", "diff", "--check")

changed = set(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).splitlines())
allowed_suffixes = {
    "karty/_engine/map-engine.js",
    "scripts/avraam-dossier-witness.mjs",
    "scripts/.tmp-avraam-dossier-residual-materialize-20260803.py",
    ".github/workflows/.tmp-avraam-dossier-residual-materialize-20260803.yml",
}
for row in changed:
    path = row[3:]
    if path not in allowed_suffixes:
        raise RuntimeError(f"unexpected changed path: {row}")

SELF.unlink()
WORKFLOW.unlink()
run("git", "diff", "--check")
print("materialized bounded dossier residual repair")
