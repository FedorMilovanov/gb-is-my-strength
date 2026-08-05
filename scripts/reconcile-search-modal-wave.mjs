#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS_PATH = path.join(ROOT, 'js/search.js');
const CSS_PATH = path.join(ROOT, 'css/command-palette.css');
const CONTRACT_PATH = path.join(ROOT, 'scripts/search-modal-browser-contract.mjs');

function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  assert.notEqual(first, -1, `missing exact anchor: ${label}`);
  assert.equal(text.indexOf(before, first + before.length), -1, `non-unique exact anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function replaceExactCount(text, before, after, expected, label) {
  const found = text.split(before).length - 1;
  assert.equal(found, expected, `${label}: expected ${expected} anchors, found ${found}`);
  return text.split(before).join(after);
}

let js = fs.readFileSync(JS_PATH, 'utf8');

js = replaceOnce(
  js,
  `<input class="cp-input" type="text" placeholder="Поиск по статьям и ссылкам…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Поиск" aria-autocomplete="list" aria-controls="cp-listbox"><button class="cp-clear" style="display:none" aria-label="Очистить">` + "'+r+'" + `</button></div>`,
  `<input class="cp-input" type="text" placeholder="Поиск по статьям и ссылкам…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" role="combobox" aria-label="Поиск" aria-haspopup="listbox" aria-expanded="false" aria-autocomplete="list" aria-controls="cp-listbox"><button class="cp-clear" style="display:none" aria-label="Очистить запрос">` + "'+r+'" + `</button><button class="cp-close" type="button" aria-label="Закрыть поиск">` + "'+r+'" + `</button></div>`,
  'combobox and close-button markup',
);

js = replaceOnce(
  js,
  `var x=k.querySelector(".cp-box"),E=k.querySelector(".cp-input"),L=k.querySelector(".cp-clear"),S=document.getElementById("cp-listbox")`,
  `var x=k.querySelector(".cp-box"),E=k.querySelector(".cp-input"),L=k.querySelector(".cp-clear"),Close=k.querySelector(".cp-close"),S=document.getElementById("cp-listbox")`,
  'close button owner',
);

js = replaceOnce(
  js,
  `function ne(){k.classList.contains("is-open")?requestAnimationFrame(function(){E.focus()}):`,
  `function ne(){E.setAttribute("aria-expanded","true"),k.classList.contains("is-open")?requestAnimationFrame(function(){E.focus()}):`,
  'open aria-expanded',
);

js = replaceOnce(
  js,
  `function re(){k.classList.contains("is-open")&&(++M,`,
  `function re(){k.classList.contains("is-open")&&(E.setAttribute("aria-expanded","false"),E.removeAttribute("aria-activedescendant"),++M,`,
  'close aria state',
);

js = replaceOnce(
  js,
  `return'<button class="cp-item" data-idx="'+t+'" role="option" aria-selected="false" aria-label="'+F(e.title)+'">`,
  `return'<div class="cp-item" id="cp-option-'+t+'" data-idx="'+t+'" role="option" tabindex="-1" aria-selected="false" aria-label="'+F(e.title)+'">`,
  'stable option opening markup',
);

js = replaceOnce(
  js,
  `<span class="cp-item-arrow">'+a+"</span></button>"}(e,n++)`,
  `<span class="cp-item-arrow">'+a+"</span></div>"}(e,n++)`,
  'stable option closing markup',
);

js = replaceOnce(
  js,
  `function oe(e,t){if(j.length){`,
  `function oe(e,t){if(!j.length)return void E.removeAttribute("aria-activedescendant");{`,
  'empty active descendant guard',
);

js = replaceOnce(
  js,
  `r&&r.classList.toggle("is-active",n)}),!1!==t){`,
  `r&&r.classList.toggle("is-active",n)}),E.setAttribute("aria-activedescendant","cp-option-"+e),!1!==t){`,
  'active descendant synchronization',
);

js = replaceExactCount(
  js,
  `j=[],ce()`,
  `j=[],E.removeAttribute("aria-activedescendant"),ce()`,
  4,
  'empty result active descendant cleanup',
);

js = replaceOnce(
  js,
  `case"Tab":e.preventDefault();var i=(document.getElementById("command-palette")||k).querySelectorAll('input, button, [tabindex]:not([tabindex="-1"]), a[href], [role="option"]');if(!i.length)break;var n=Array.prototype.slice.call(i),r=n.indexOf(document.activeElement);n[e.shiftKey?r<=0?n.length-1:r-1:r>=n.length-1?0:r+1].focus()}}),document.addEventListener`,
  `}}),k.addEventListener("keydown",function(e){if("Tab"!==e.key||!k.classList.contains("is-open"))return;var t=Array.prototype.slice.call(k.querySelectorAll('input:not([disabled]),button:not([disabled]):not([role="option"]),a[href],[tabindex]:not([tabindex="-1"]):not([role="option"])')).filter(function(e){return e.getClientRects().length>0});if(!t.length)return;e.preventDefault();var i=t.indexOf(document.activeElement),n=e.shiftKey?i<=0?t.length-1:i-1:i<0||i>=t.length-1?0:i+1;t[n].focus()}),document.addEventListener`,
  'dialog-wide tab trap',
);

js = replaceOnce(
  js,
  `L.addEventListener("click",function(){E.value="",A="",L.style.display="none",clearTimeout(q),_=0,we(),E.focus()}),E.addEventListener("keydown"`,
  `L.addEventListener("click",function(){E.value="",A="",L.style.display="none",clearTimeout(q),_=0,we(),E.focus()}),Close.addEventListener("click",re),E.addEventListener("keydown"`,
  'close button listener',
);

assert.match(js, /role="combobox"/, 'combobox role missing');
assert.match(js, /aria-expanded="false"/, 'initial aria-expanded missing');
assert.match(js, /aria-activedescendant/, 'active descendant implementation missing');
assert.match(js, /id="cp-option-'\+t\+'"/, 'stable option ID missing');
assert.ok(!js.includes(`return'<button class="cp-item"`), 'mixed button/option markup survived');
assert.match(js, /Close\.addEventListener\("click",re\)/, 'close listener missing');
assert.match(js, /k\.addEventListener\("keydown",function\(e\)\{if\("Tab"!==e\.key/, 'dialog-wide tab trap missing');

fs.writeFileSync(JS_PATH, js);

let css = fs.readFileSync(CSS_PATH, 'utf8');
css = replaceOnce(css, `z-index:var(--z-modal,10000)`, `z-index:2147483000`, 'modal top-layer fallback');
css = replaceOnce(css, `.cp-clear{`, `.cp-clear,.cp-close{`, 'clear/close shared geometry');
css = replaceOnce(css, `.cp-clear:hover{`, `.cp-clear:hover,.cp-close:hover{`, 'clear/close hover');
css = replaceOnce(css, `.cp-clear:active{`, `.cp-clear:active,.cp-close:active{`, 'clear/close active');
css = replaceOnce(css, `min-height:32px`, `height:44px;min-height:44px;box-sizing:border-box`, 'scope chip exact touch target');
css = replaceOnce(
  css,
  `.gb-nav-search-icon{background:0 0;border:none;box-shadow:none;cursor:pointer;padding:2px;border-radius:0;`,
  `.gb-nav-search-icon{background:0 0;border:none;box-shadow:none;cursor:pointer;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;border-radius:12px;box-sizing:border-box;`,
  'navigation search hitbox',
);

css += `
/* SEARCH-P2-10/11/12 — canonical command-palette accessibility and modal contract. */
.cp-close{display:flex;align-items:center;justify-content:center}
.cp-scope-chip:focus-visible,
.cp-clear:focus-visible,
.cp-close:focus-visible,
.cp-history-clear:focus-visible,
.cp-sug-btn:focus-visible,
.cp-preview-btn:focus-visible,
.gb-nav-search-icon:focus-visible{
  outline:2px solid var(--cp-accent);
  outline-offset:2px;
  box-shadow:0 0 0 4px var(--cp-accent-soft);
}
`;

assert.ok(!css.includes('z-index:var(--z-modal,10000)'), 'weak modal z-index survived');
assert.ok(!css.includes('min-height:32px'), '32px scope chip survived');
assert.match(css, /\.cp-scope-chip\{[^}]*height:44px;min-height:44px;box-sizing:border-box/, 'exact 44px scope chip contract missing');
assert.match(css, /\.gb-nav-search-icon\{[^}]*width:44px;[^}]*height:44px;/, '44px navigation icon contract missing');
assert.match(css, /\.cp-scope-chip:focus-visible/, 'scope-chip focus-visible missing');
assert.match(css, /\.cp-preview-btn:focus-visible/, 'preview focus-visible missing');

fs.writeFileSync(CSS_PATH, css);

let contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
contract = replaceOnce(
  contract,
  `    await page.goto(\`http://127.0.0.1:\${port}/\`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(
      () => window.GBSearch && typeof window.GBSearch.open === 'function',
      null,
      { timeout: 30_000 },
    );

    await page.evaluate(() => {
      document.getElementById('search-modal-contract-trigger')?.remove();
      const trigger = document.createElement('button');
      trigger.id = 'search-modal-contract-trigger';
      trigger.className = 'gb-nav-search-icon';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Открыть поиск');
      trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-5-5"></path></svg>';
      trigger.addEventListener('click', () => window.GBSearch.open());
      document.body.appendChild(trigger);
      trigger.focus();
      trigger.click();
    });

    const modal = page.locator('.cp-backdrop.is-open');`,
  `    await page.goto(\`http://127.0.0.1:\${port}/\`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.evaluate(() => {
      document.getElementById('search-modal-contract-trigger')?.remove();
      const trigger = document.createElement('button');
      trigger.id = 'search-modal-contract-trigger';
      trigger.className = 'gb-nav-search-icon';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Открыть поиск');
      trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-5-5"></path></svg>';
      trigger.addEventListener('click', () => window.dispatchEvent(new CustomEvent('gb:openSearch')));
      document.body.appendChild(trigger);
      trigger.focus();
      trigger.click();
    });
    await page.waitForFunction(
      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),
      null,
      { timeout: 30_000 },
    );

    const modal = page.locator('.cp-backdrop.is-open');`,
  'lazy canonical search startup ordering',
);
assert.match(contract, /window\.dispatchEvent\(new CustomEvent\('gb:openSearch'\)\)/, 'canonical lazy-open event missing');
assert.match(contract, /window\.GBSearch\?\.__ready === true/, 'ready-state wait missing');
fs.writeFileSync(CONTRACT_PATH, contract);

execFileSync(process.execPath, [path.join(ROOT, 'scripts/cache-bust.js'), '--write'], {
  cwd: ROOT,
  stdio: 'inherit',
});
execFileSync(process.execPath, [path.join(ROOT, 'scripts/cache-bust.js')], {
  cwd: ROOT,
  stdio: 'inherit',
});

console.log('SEARCH-P2-10/11/12 reconciliation, browser startup and asset revisions applied');
