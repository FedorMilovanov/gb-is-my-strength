export class ThemeController {
  private readonly THEME_KEY = 'theme';

  public isDark(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }

  public toggle(): void {
    this.setTheme(!this.isDark());
  }

  public setTheme(dark: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(this.THEME_KEY, dark ? 'dark' : 'light');
    } catch (_) {}
    this.syncButtons();
  }

  public syncButtons(): void {
    if (typeof document === 'undefined') return;
    const dark = this.isDark();
    document.querySelectorAll('.gb-theme-toggle, [data-fc-action="theme"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    });
  }

  public initListeners(): void {
    if (typeof document === 'undefined') return;
    // Delegate GBS2 legacy theme buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-gbs2-theme]')) {
        e.stopPropagation();
        this.toggle();
      }
    }, true);
  }
}
