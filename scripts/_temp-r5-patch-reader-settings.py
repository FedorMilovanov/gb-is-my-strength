#!/usr/bin/env python3
from pathlib import Path

path = Path('src/components/article-pilots/_shared/ReaderSettings.astro')
text = path.read_text(encoding='utf-8')
start = text.index('    const open = () => {')
end = text.index('\n\n    function setPressed', start)
replacement = '''    const OVERLAY_OWNER = 'reader-settings';
    const overlayRuntime = () => (window as any).OverlayRuntime || null;
    const fallbackUtils = () => (window as any).SiteUtils || null;

    const close = (reason = 'programmatic', restoreFocus = true) => {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      const runtime = overlayRuntime();
      if (runtime?.close) runtime.close(OVERLAY_OWNER, reason, { restoreFocus });
      else fallbackUtils()?.unlockScroll?.(OVERLAY_OWNER);
    };

    const open = () => {
      const runtime = overlayRuntime();
      const toc = document.getElementById('hmSheet');
      if (runtime?.isOpen?.('hermenevtika-toc')) runtime.requestClose('hermenevtika-toc', 'switch');
      else if (toc?.classList.contains('is-open')) {
        toc.classList.remove('is-open');
        toc.setAttribute('aria-hidden', 'true');
      }
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      if (runtime?.open) runtime.open(OVERLAY_OWNER, {
        element: sheet,
        opener: document.activeElement,
        onRequestClose: (closeReason: string) => close(closeReason, true),
        closeOnEscape: true,
        trapFocus: true
      });
      else fallbackUtils()?.lockScroll?.(OVERLAY_OWNER);
    };
    document.addEventListener('hm:open-settings', open);
    backdrop?.addEventListener('click', () => close('backdrop', true));
    closeBtn?.addEventListener('click', () => close('button', true));
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!overlayRuntime() && e.key === 'Escape' && sheet.classList.contains('is-open')) close('escape', true);
    });
'''
text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
print('ReaderSettings overlay migration applied')
