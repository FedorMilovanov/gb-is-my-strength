export class SearchController {
  public open(btn?: HTMLElement) {
    if (typeof window !== 'undefined' && (window as any).CommandPalette) {
      (window as any).CommandPalette.open();
    }
  }

  public initListeners() {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-gbs2-search]')) {
        e.stopPropagation();
        this.open(target.closest('[data-gbs2-search]') as HTMLElement);
      }
      const fcBtn = target && target.closest('[data-fc-action="search"]');
      if (fcBtn) {
        this.open(fcBtn as HTMLElement);
      }
    }, true);
  }
}
