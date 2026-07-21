#!/usr/bin/env python3
from pathlib import Path

path = Path('js/site-utils.js')
text = path.read_text(encoding='utf-8')


def once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)


once('  var savedScrollY = 0;\n', '  var savedScrollY = 0;\n  var savedLockStyles = null;\n', 'saved style state')
once(
    '  function hasOpenOverlay() {\n    return Boolean(\n',
    "  function hasOpenOverlay() {\n    if (window.OverlayRuntime && typeof window.OverlayRuntime.hasLiveLayers === 'function' && window.OverlayRuntime.hasLiveLayers()) return true;\n    return Boolean(\n",
    'live overlay check',
)
start = text.index('  function applyLock() {')
end = text.index('  function ensureLockState() {', start)
region = '''  function readStyle(style, property, camelName) {
    if (!style) return '';
    if (typeof style.getPropertyValue === 'function') return style.getPropertyValue(property) || '';
    return style[camelName] || '';
  }

  function writeStyle(style, property, camelName, value) {
    if (!style) return;
    if (value) {
      if (typeof style.setProperty === 'function') style.setProperty(property, value);
      else style[camelName] = value;
    } else if (typeof style.removeProperty === 'function') style.removeProperty(property);
    else style[camelName] = '';
  }

  function captureLockStyles() {
    var body = document.body;
    var html = document.documentElement;
    return {
      body: {
        overflow: readStyle(body.style, 'overflow', 'overflow'),
        overscrollBehavior: readStyle(body.style, 'overscroll-behavior', 'overscrollBehavior'),
        position: readStyle(body.style, 'position', 'position'),
        top: readStyle(body.style, 'top', 'top'),
        left: readStyle(body.style, 'left', 'left'),
        right: readStyle(body.style, 'right', 'right'),
        width: readStyle(body.style, 'width', 'width'),
        paddingRight: readStyle(body.style, 'padding-right', 'paddingRight'),
        noScroll: body.classList.contains('no-scroll'),
        nagornayaLock: body.classList.contains('ng-toc-lock')
      },
      html: {
        scrollLockTop: readStyle(html.style, '--scroll-lock-top', '--scroll-lock-top'),
        dataScrollLocked: html.getAttribute('data-scroll-locked'),
        controlPanelLock: html.classList.contains('cp-scroll-lock')
      }
    };
  }

  function restoreLockStyles(snapshot) {
    snapshot = snapshot || { body: {}, html: {} };
    var body = document.body;
    var html = document.documentElement;
    writeStyle(body.style, 'overflow', 'overflow', snapshot.body.overflow || '');
    writeStyle(body.style, 'overscroll-behavior', 'overscrollBehavior', snapshot.body.overscrollBehavior || '');
    writeStyle(body.style, 'position', 'position', snapshot.body.position || '');
    writeStyle(body.style, 'top', 'top', snapshot.body.top || '');
    writeStyle(body.style, 'left', 'left', snapshot.body.left || '');
    writeStyle(body.style, 'right', 'right', snapshot.body.right || '');
    writeStyle(body.style, 'width', 'width', snapshot.body.width || '');
    writeStyle(body.style, 'padding-right', 'paddingRight', snapshot.body.paddingRight || '');
    body.classList.toggle('no-scroll', Boolean(snapshot.body.noScroll));
    body.classList.toggle('ng-toc-lock', Boolean(snapshot.body.nagornayaLock));
    html.classList.toggle('cp-scroll-lock', Boolean(snapshot.html.controlPanelLock));
    if (snapshot.html.dataScrollLocked === null || snapshot.html.dataScrollLocked === undefined) html.removeAttribute('data-scroll-locked');
    else html.setAttribute('data-scroll-locked', snapshot.html.dataScrollLocked);
    writeStyle(html.style, '--scroll-lock-top', '--scroll-lock-top', snapshot.html.scrollLockTop || '');
  }

  function applyLock() {
    if (!effectiveLocked() || restoring || lockStylesApplied()) return;
    restoring = true;
    try {
      var body = document.body;
      if (!savedLockStyles) savedLockStyles = captureLockStyles();
      if (body.style.position !== 'fixed') savedScrollY = readLockedScrollY();
      var scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.documentElement.style.setProperty('--scroll-lock-top', '-' + savedScrollY + 'px');
      document.documentElement.setAttribute('data-scroll-locked', '1');
      document.documentElement.classList.remove('cp-scroll-lock');
      body.classList.remove('no-scroll', 'ng-toc-lock');
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      body.style.position = 'fixed';
      body.style.top = '-' + savedScrollY + 'px';
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.paddingRight = scrollbar ? scrollbar + 'px' : '';
    } finally { restoring = false; }
  }

  function releaseLock() {
    if (effectiveLocked() || restoring) return;
    restoring = true;
    try {
      var top = parseFloat(document.body.style.top || '');
      var restoreY = Number.isFinite(top) && top < 0 ? -top : savedScrollY;
      restoreLockStyles(savedLockStyles);
      savedLockStyles = null;
      var oldBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, restoreY || 0);
      document.documentElement.style.scrollBehavior = oldBehavior;
    } finally { restoring = false; }
  }

'''
text = text[:start] + region + text[end:]
path.write_text(text, encoding='utf-8')
print('exact scroll style patch applied')
