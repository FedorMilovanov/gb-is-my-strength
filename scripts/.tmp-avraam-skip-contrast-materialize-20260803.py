#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / 'src/components/karty/avraam/AvraamMap.astro'
WITNESS = ROOT / 'scripts/avraam-dossier-witness.mjs'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f'guard failed: {message}')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    require(count == 1, f'{label}: expected one occurrence, found {count}')
    return text.replace(old, new, 1)


def update_component() -> None:
    text = COMPONENT.read_text(encoding='utf-8')
    require('data-map-skip-link' not in text, 'skip link already exists')
    require('tabindex="-1"' not in text.split('id="stage"', 1)[1].split('</div>', 1)[0], 'stage already has tabindex')

    heading = '<h1 class="sr-only" data-pagefind-body>Путь Авраама — интерактивная карта. От Ура Халдейского до горы Мория: 22 объекта — 19 маршрутных мест и 3 контекстные точки; 8 этапов; 5 сюжетов; археология; хронология 175 лет.</h1>'
    skip = '''<a class="map-skip-link" data-map-skip-link href="#stage">Перейти к интерактивной карте</a>
<style>
  .map-skip-link {
    position: fixed;
    inset-block-start: max(10px, env(safe-area-inset-top));
    inset-inline-start: max(10px, env(safe-area-inset-left));
    z-index: 2147483647;
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    padding: 10px 16px;
    border: 1px solid rgba(232, 200, 121, .65);
    border-radius: 10px;
    background: #0d111a;
    color: #e8c879;
    font: 600 14px/1.35 system-ui, sans-serif;
    text-decoration: none;
    box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
    transform: translateY(calc(-100% - 24px));
  }
  .map-skip-link:focus,
  .map-skip-link:focus-visible {
    transform: translateY(0);
    outline: 3px solid #fff;
    outline-offset: 3px;
  }
</style>
''' + heading
    text = replace_once(text, heading, skip, 'insert route-owned skip link')

    stage_old = '''  aria-busy="true"
  aria-label="Интерактивная карта пути Авраама"
  style="position:fixed;inset:0;background:#070a10"
></div>'''
    stage_new = '''  aria-busy="true"
  aria-label="Интерактивная карта пути Авраама"
  tabindex="-1"
  style="position:fixed;inset:0;background:#070a10"
></div>'''
    text = replace_once(text, stage_old, stage_new, 'make map stage programmatically focusable')

    init_old = '''  function init() {
    var container = document.getElementById('stage');
    if (!container) return;

    // Inject Avraam-specific visual overrides (from legacy avraam-app.js style block)'''
    init_new = '''  function init() {
    var container = document.getElementById('stage');
    if (!container) return;
    var skipLink = document.querySelector('[data-map-skip-link]');
    if (skipLink) {
      skipLink.addEventListener('click', function(){
        setTimeout(function(){ container.focus({ preventScroll: true }); }, 0);
      });
    }

    // Inject Avraam-specific visual overrides (from legacy avraam-app.js style block)'''
    text = replace_once(text, init_old, init_new, 'bind skip-link focus transfer')

    require(text.count('data-map-skip-link') == 2, 'unexpected skip-link marker count')
    require(text.count('tabindex="-1"') >= 1, 'stage tabindex missing after materialization')
    COMPONENT.write_text(text, encoding='utf-8')


def update_witness() -> None:
    text = WITNESS.read_text(encoding='utf-8')
    require('verifyStaticNavigation' not in text, 'static navigation witness already exists')
    require('archMetadata' not in text, 'contrast witness already exists')

    wait_old = '''async function waitForMap(page) {
  page.setDefaultTimeout(8000);
  await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    return Boolean(document.querySelector('.me-map,#mapRoot') && document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg') && (stage?.getAttribute('data-map-state') === 'ready' || !stage));
  }, { timeout: 60000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}' });
  const introStart = page.getByRole('button', { name: /Начать изучение/i });'''
    wait_new = '''async function verifyStaticNavigation(page, scope) {
  const contract = await page.evaluate(() => {
    const skip = document.querySelector('[data-map-skip-link]');
    const heading = document.querySelector('h1.sr-only');
    const fallback = document.querySelector('[data-map-static-projection]');
    const stage = document.querySelector('[data-map-stage]');
    const precedes = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      skipCount: document.querySelectorAll('[data-map-skip-link]').length,
      href: skip?.getAttribute('href') || null,
      text: (skip?.textContent || '').replace(/\\s+/g, ' ').trim(),
      stageTabIndex: stage?.tabIndex ?? null,
      stageTabIndexAttribute: stage?.getAttribute('tabindex') || null,
      order: {
        skipBeforeHeading: precedes(skip, heading),
        headingBeforeFallback: precedes(heading, fallback),
        fallbackBeforeStage: precedes(fallback, stage),
      },
    };
  });
  if (contract.skipCount !== 1) fail(scope, `skip-link count ${contract.skipCount}`);
  if (contract.href !== '#stage') fail(scope, `skip-link href ${contract.href}`);
  if (!contract.text) fail(scope, 'skip-link has no accessible text');
  if (contract.stageTabIndex !== -1 || contract.stageTabIndexAttribute !== '-1') fail(scope, `stage tabindex ${contract.stageTabIndexAttribute}/${contract.stageTabIndex}`);
  if (!Object.values(contract.order).every(Boolean)) fail(scope, `static reading order ${JSON.stringify(contract.order)}`);

  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  const focusedSkip = await page.evaluate(() => document.activeElement?.hasAttribute?.('data-map-skip-link') || false);
  if (!focusedSkip) fail(scope, 'first keyboard Tab did not reach the skip link');
  const focusedGeometry = await page.locator('[data-map-skip-link]').evaluate(node => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { width: rect.width, height: rect.height, top: rect.top, left: rect.left, visibility: style.visibility, display: style.display };
  });
  if (focusedGeometry.width < 44 || focusedGeometry.height < 44 || focusedGeometry.top < -1 || focusedGeometry.left < -1 || focusedGeometry.visibility === 'hidden' || focusedGeometry.display === 'none') {
    fail(scope, `focused skip-link is not a visible 44px target ${JSON.stringify(focusedGeometry)}`);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'stage');
  const focusedAfterActivation = await page.evaluate(() => ({ id: document.activeElement?.id || null, hash: location.hash }));
  if (focusedAfterActivation.id !== 'stage' || focusedAfterActivation.hash !== '#stage') fail(scope, `skip activation ${JSON.stringify(focusedAfterActivation)}`);
  await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
  return { ...contract, focusedSkip, focusedGeometry, focusedAfterActivation };
}

async function waitForMap(page, scope) {
  page.setDefaultTimeout(8000);
  await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}' });
  const staticNavigation = await verifyStaticNavigation(page, `${scope}/static-navigation`);
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    return Boolean(document.querySelector('.me-map,#mapRoot') && document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg') && (stage?.getAttribute('data-map-state') === 'ready' || !stage));
  }, { timeout: 60000 });
  const introStart = page.getByRole('button', { name: /Начать изучение/i });'''
    text = replace_once(text, wait_old, wait_new, 'add static navigation witness')

    wait_return_old = '''  if (await disabledLayers.count()) {
    if (await layerSummary.count()) await layerSummary.click();
    while (await disabledLayers.count()) {
      await disabledLayers.first().click();
      await page.waitForTimeout(40);
    }
  }
}'''
    wait_return_new = '''  if (await disabledLayers.count()) {
    if (await layerSummary.count()) await layerSummary.click();
    while (await disabledLayers.count()) {
      await disabledLayers.first().click();
      await page.waitForTimeout(40);
    }
  }
  return staticNavigation;
}'''
    text = replace_once(text, wait_return_old, wait_return_new, 'return static navigation evidence')

    rect_old = '''    const rect = node => node ? node.getBoundingClientRect().toJSON() : null;
    const tabs = tablist ? Array.from(tablist.querySelectorAll('.me-tab[data-tab]')).map(node => ({'''
    rect_new = '''    const rect = node => node ? node.getBoundingClientRect().toJSON() : null;
    const parseCssColor = value => {
      value = String(value || '').trim().toLowerCase();
      if (!value || value === 'transparent') return [0, 0, 0, 0];
      let match = value.match(/^rgba?\\((.+)\\)$/);
      if (match) {
        const parts = match[1].replace(/\\//g, ' ').split(/[\\s,]+/).filter(Boolean);
        const channel = token => token.endsWith('%') ? Math.max(0, Math.min(255, parseFloat(token) * 2.55)) : Math.max(0, Math.min(255, parseFloat(token)));
        const alpha = parts[3] === undefined ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
        return [channel(parts[0]), channel(parts[1]), channel(parts[2]), Math.max(0, Math.min(1, alpha))];
      }
      match = value.match(/^color\\(srgb\\s+(.+)\\)$/);
      if (match) {
        const parts = match[1].replace(/\\//g, ' ').split(/\\s+/).filter(Boolean);
        const channel = token => token.endsWith('%') ? parseFloat(token) * 2.55 : parseFloat(token) * 255;
        const alpha = parts[3] === undefined ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
        return [channel(parts[0]), channel(parts[1]), channel(parts[2]), Math.max(0, Math.min(1, alpha))];
      }
      return null;
    };
    const composite = (foreground, background) => {
      const fa = foreground[3], ba = background[3], alpha = fa + ba * (1 - fa);
      if (alpha <= 0) return [0, 0, 0, 0];
      return [
        (foreground[0] * fa + background[0] * ba * (1 - fa)) / alpha,
        (foreground[1] * fa + background[1] * ba * (1 - fa)) / alpha,
        (foreground[2] * fa + background[2] * ba * (1 - fa)) / alpha,
        alpha,
      ];
    };
    const effectiveBackground = node => {
      const chain = [];
      for (let current = node?.parentElement; current; current = current.parentElement) chain.push(current);
      let background = [255, 255, 255, 1];
      for (const current of chain.reverse()) {
        const parsed = parseCssColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0) background = composite(parsed, background);
      }
      return background;
    };
    const luminance = rgb => {
      const linear = rgb.slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4);
      });
      return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    };
    const contrastSample = node => {
      const declared = getComputedStyle(node).color;
      const foreground = parseCssColor(declared);
      const background = effectiveBackground(node);
      if (!foreground) return { text: (node.textContent || '').trim().slice(0, 160), className: node.className, declared, valid: false, contrast: null };
      const painted = composite(foreground, background);
      const l1 = luminance(painted), l2 = luminance(background);
      const contrast = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      return {
        text: (node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160),
        className: node.className,
        declared,
        foreground: painted.slice(0, 3).map(value => Number(value.toFixed(2))),
        background: background.slice(0, 3).map(value => Number(value.toFixed(2))),
        valid: Number.isFinite(contrast),
        contrast: Number(contrast.toFixed(3)),
      };
    };
    const tabs = tablist ? Array.from(tablist.querySelectorAll('.me-tab[data-tab]')).map(node => ({'''
    text = replace_once(text, rect_old, rect_new, 'add browser color compositing helpers')

    images_old = '''    const images = content ? Array.from(content.querySelectorAll('img')).map(img => ({
      alt: img.alt,
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    })) : [];
    return {'''
    images_new = '''    const images = content ? Array.from(content.querySelectorAll('img')).map(img => ({
      alt: img.alt,
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    })) : [];
    const archMetadata = content ? Array.from(content.querySelectorAll('.map-arch-source__meta')).filter(isVisible).map(contrastSample) : [];
    return {'''
    text = replace_once(text, images_old, images_new, 'collect archaeology contrast samples')

    return_old = '''      links,
      images,
      variantRows: content?.querySelectorAll('.me-sci-item').length || 0,'''
    return_new = '''      links,
      images,
      archMetadata,
      variantRows: content?.querySelectorAll('.me-sci-item').length || 0,'''
    text = replace_once(text, return_old, return_new, 'return archaeology contrast samples')

    validate_old = '''  } else if ((state.content?.textLength || 0) < 20) {
    fail(scope, `content too short (${state.content?.textLength || 0})`);
  }
  for (const control of state.controls) {'''
    validate_new = '''  } else if ((state.content?.textLength || 0) < 20) {
    fail(scope, `content too short (${state.content?.textLength || 0})`);
  }
  if (tabId === 'arch') {
    for (const sample of state.archMetadata || []) {
      if (!sample.valid || !Number.isFinite(sample.contrast)) fail(scope, `unparseable archaeology metadata color ${JSON.stringify(sample)}`);
      else if (sample.contrast < 4.5) fail(scope, `archaeology metadata contrast ${sample.contrast}:1 < 4.5:1 :: ${sample.text}`);
    }
  }
  for (const control of state.controls) {'''
    text = replace_once(text, validate_old, validate_new, 'enforce archaeology metadata contrast')

    result_old = '''  const result = { viewport, places: [], contextPoints: [], stateCount: 0, failures: [], warnings: [] };
  const failureStart = failures.length;'''
    result_new = '''  const result = { viewport, staticNavigation: null, places: [], contextPoints: [], stateCount: 0, failures: [], warnings: [] };
  const failureStart = failures.length;'''
    text = replace_once(text, result_old, result_new, 'store static navigation result')
    text = replace_once(text, '    await waitForMap(page);', '    result.staticNavigation = await waitForMap(page, viewport.id);', 'invoke static navigation witness')

    summary_old = '''const expectedStates = audit.counts.expectedStatesPerViewport * VIEWPORTS.length;
const actualStates = records.reduce((sum, record) => sum + record.stateCount, 0);
if (actualStates !== expectedStates) fail('summary', `state count ${actualStates} != ${expectedStates}`);
const result = {'''
    summary_new = '''const expectedStates = audit.counts.expectedStatesPerViewport * VIEWPORTS.length;
const actualStates = records.reduce((sum, record) => sum + record.stateCount, 0);
if (actualStates !== expectedStates) fail('summary', `state count ${actualStates} != ${expectedStates}`);
const contrastSamples = records.flatMap(record => record.places.flatMap(place => place.states.flatMap(entry => entry.state.archMetadata || [])));
if (!contrastSamples.length) fail('summary', 'no visible archaeology metadata contrast samples were captured');
const invalidContrastSamples = contrastSamples.filter(sample => !sample.valid || !Number.isFinite(sample.contrast) || sample.contrast < 4.5);
if (invalidContrastSamples.length) fail('summary', `${invalidContrastSamples.length} archaeology metadata samples fail 4.5:1`);
const contrastSummary = {
  samples: contrastSamples.length,
  minimum: contrastSamples.length ? Math.min(...contrastSamples.map(sample => sample.contrast)) : null,
  maximum: contrastSamples.length ? Math.max(...contrastSamples.map(sample => sample.contrast)) : null,
  invalid: invalidContrastSamples.length,
};
const result = {'''
    text = replace_once(text, summary_old, summary_new, 'summarize archaeology contrast')

    result_fields_old = '''  expectedStates,
  actualStates,
  records,
  failures,'''
    result_fields_new = '''  expectedStates,
  actualStates,
  contrastSummary,
  records,
  failures,'''
    text = replace_once(text, result_fields_old, result_fields_new, 'write contrast summary')

    md_old = '''- Expected tab states: ${expectedStates}\n- Captured tab states: ${actualStates}\n\n| Viewport | Places | Tab states | Context points | Failures | Warnings |'''
    md_new = '''- Expected tab states: ${expectedStates}\n- Captured tab states: ${actualStates}\n- Archaeology metadata contrast samples: ${contrastSummary.samples}\n- Minimum archaeology metadata contrast: ${contrastSummary.minimum ?? '—'}:1\n\n| Viewport | Places | Tab states | Context points | Failures | Warnings |'''
    text = replace_once(text, md_old, md_new, 'report contrast summary')

    require(text.count('verifyStaticNavigation') == 2, 'static navigation helper/call count')
    require(text.count('archMetadata') >= 5, 'contrast contract markers missing')
    WITNESS.write_text(text, encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    require(args.write, 'explicit --write is required')
    update_component()
    update_witness()
    print('materialized Avraam skip-link and computed contrast witness')


if __name__ == '__main__':
    main()
