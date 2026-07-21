#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/runtime-integrity-test.js')
text = path.read_text(encoding='utf-8')

def once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

once(
    "  removeProperty(key) {\n    this.map.delete(key);\n    this[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = '';\n  }",
    "  getPropertyValue(key) { return this.map.get(key) || this[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] || ''; }\n  removeProperty(key) {\n    this.map.delete(key);\n    this[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = '';\n  }",
    'Style getter',
)
once(
    "  contains(value) { return this.values.has(value); }\n}",
    "  contains(value) { return this.values.has(value); }\n  toggle(value, force) { const on = force === undefined ? !this.contains(value) : Boolean(force); on ? this.add(value) : this.remove(value); return on; }\n}",
    'ClassList toggle',
)
once(
    "    this.attrs = {};\n    this.inert = false;\n",
    "    this.attrs = {};\n    this.inert = false;\n    this.isConnected = true;\n    this.disabled = false;\n    this.offsetParent = {};\n    this.focusables = [];\n    this.focusCount = 0;\n",
    'Element state',
)
once(
    "  setAttribute(key, value) { this.attrs[key] = String(value); }\n  removeAttribute(key) { delete this.attrs[key]; }\n  getAttribute(key) { return this.attrs[key] ?? null; }\n}",
    "  setAttribute(key, value) { this.attrs[key] = String(value); if (key === 'inert') this.inert = true; }\n  removeAttribute(key) { delete this.attrs[key]; if (key === 'inert') this.inert = false; }\n  hasAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key); }\n  getAttribute(key) { return this.attrs[key] ?? null; }\n  querySelector() { return this.focusables[0] || null; }\n  querySelectorAll() { return this.focusables.slice(); }\n  focus() { this.focusCount += 1; document.activeElement = this; }\n}",
    'Element behavior',
)
once(
    "const document = {\n  readyState: 'complete',\n  body,\n  documentElement: html,\n  querySelector() { return null; },\n  getElementById(id) { return id === 'gb-hl-backdrop' ? dialog : null; },\n  addEventListener() {},\n};",
    "const documentListeners = new Map();\nconst document = {\n  readyState: 'complete', body, documentElement: html, activeElement: body,\n  querySelector() { return null; }, querySelectorAll() { return []; },\n  getElementById(id) { return id === 'gb-hl-backdrop' ? dialog : null; },\n  addEventListener(type, fn) { if (!documentListeners.has(type)) documentListeners.set(type, []); documentListeners.get(type).push(fn); },\n  dispatchEvent(event) { for (const fn of documentListeners.get(event.type) || []) fn(event); return true; },\n};",
    'document event harness',
)
once(
    "const window = {\n  SiteUtils: {},",
    "const windowListeners = new Map();\nclass CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }\nconst window = {\n  SiteUtils: {},",
    'window harness prelude',
)
once(
    "  addEventListener() {},\n  scrollTo(x, y) { this.scrollY = y; },\n};",
    "  CustomEvent,\n  addEventListener(type, fn) { if (!windowListeners.has(type)) windowListeners.set(type, []); windowListeners.get(type).push(fn); },\n  dispatch(type) { for (const fn of windowListeners.get(type) || []) fn({ type }); },\n  scrollTo(x, y) { this.scrollY = y; },\n};",
    'window events',
)
once(
    "  MutationObserver,\n  URL,\n  Set,",
    "  MutationObserver,\n  CustomEvent,\n  URL,\n  Set,\n  Map,\n  Boolean,",
    'context globals',
)
once(
    "  clearInterval() {},\n});",
    "  clearInterval() {},\n  setTimeout: (fn) => { fn(); return 1; },\n  clearTimeout() {},\n});",
    'timer globals',
)
path.write_text(text, encoding='utf-8')
print('runtime-integrity harness extended for OverlayRuntime')
