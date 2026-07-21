#!/usr/bin/env python3
from pathlib import Path

path = Path('src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro')
text = path.read_text(encoding='utf-8')
start = text.index('    const openSheet = () => {')
end = text.index('\n\n    const rows =', start)
replacement = '''    const OVERLAY_OWNER = 'hermenevtika-toc';
    const overlayRuntime = () => (window as any).OverlayRuntime || null;
    const fallbackUtils = () => (window as any).SiteUtils || null;

    const closeSheet = (reason = 'programmatic', restoreFocus = true) => {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      const runtime = overlayRuntime();
      if (runtime?.close) runtime.close(OVERLAY_OWNER, reason, { restoreFocus });
      else fallbackUtils()?.unlockScroll?.(OVERLAY_OWNER);
    };

    const openSheet = (opener?: EventTarget | null) => {
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      const runtime = overlayRuntime();
      if (runtime?.open) runtime.open(OVERLAY_OWNER, {
        element: sheet,
        opener: opener instanceof Element ? opener : document.activeElement,
        onRequestClose: (closeReason: string) => closeSheet(closeReason, true),
        closeOnEscape: true,
        trapFocus: true
      });
      else fallbackUtils()?.lockScroll?.(OVERLAY_OWNER);
    };
    bottomBtn?.addEventListener('click', (event) => openSheet(event.currentTarget));
    sectionBtn?.addEventListener('click', (event) => openSheet(event.currentTarget));
    backdrop?.addEventListener('click', () => closeSheet('backdrop', true));
    closeBtn?.addEventListener('click', () => closeSheet('button', true));
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!overlayRuntime() && e.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet('escape', true);
    });
    sheet.querySelectorAll('.hmsheet-link').forEach((a) => a.addEventListener('click', () => closeSheet('navigate', false)));
'''
text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
print('Hermenevtika overlay migration applied')
