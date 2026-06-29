export class FontController {
  public change(dir: number) {
    if (typeof document === 'undefined') return;
    const body = document.body;
    let s = parseFloat(body.style.getPropertyValue('--gbs2-font-scale')) || 1;
    s = Math.min(Math.max(s + dir * 0.1, 0.8), 1.5);
    body.style.setProperty('--gbs2-font-scale', String(s));
    try { localStorage.setItem('gb:font:scale', String(s)); } catch (_) {}
  }
  
  public init() {
    if (typeof document === 'undefined') return;
    try {
      const s = localStorage.getItem('gb:font:scale');
      if (s) document.body.style.setProperty('--gbs2-font-scale', s);
    } catch (_) {}

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-gbs2-font="up"]') || target?.closest('[data-fc-action="font-up"]')) {
        this.change(1);
      }
      if (target && target.closest('[data-gbs2-font="down"]') || target?.closest('[data-fc-action="font-down"]')) {
        this.change(-1);
      }
    });
  }
}
