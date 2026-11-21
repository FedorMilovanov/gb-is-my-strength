/** /articles/ only. Native links/history own navigation; this remembers identity, never coordinates. */
export const CATALOG_RESUME_KEY = 'gb:articles:resume';
const linkSelector = 'a[data-catalog-route], a[data-catalog-series]';

type Resume = { version: 1; url: string; href: string };
type State = Record<string, unknown>;

/** Keep the complete authority URL in the ID: no slug registry or lossy sanitizing. */
export function catalogItemId(href: string): string {
  return `catalog-item:${href}`;
}
export function catalogReturnHref(href: string): string {
  return `/articles/#${encodeURIComponent(catalogItemId(href))}`;
}
type Publication = { status?: string; publicationStatus?: string; publicationGate?: string };
export function catalogReturnItem<T extends Publication & { type?: string; url: string }>(
  route: string, items: readonly T[], routes: Record<string, Publication | undefined>,
): T | undefined {
  const item = items.find((entry) => entry.type === 'article' && entry.url === route);
  const owner = routes[route];
  const held = (entry?: Publication) => [entry?.status, entry?.publicationStatus, entry?.publicationGate].includes('PUBLICATION_HOLD');
  return item && owner?.status === 'production-dist' && !held(owner) && !held(item) ? item : undefined;
}
function record(value: unknown): value is State {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
export function catalogResume(state: unknown, url: string): Resume | null {
  if (!record(state)) return null;
  const saved = state[CATALOG_RESUME_KEY];
  return record(saved) && saved.version === 1 && saved.url === url && typeof saved.href === 'string'
    ? saved as Resume : null;
}
export function isCatalogActivation(event: MouseEvent, link: HTMLAnchorElement, origin: string): boolean {
  return event.isTrusted && !event.defaultPrevented && event.button === 0
    && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
    && !link.hasAttribute('download') && (!link.target || link.target === '_self')
    && link.origin === origin
    && (link.dataset.catalogRoute ?? link.dataset.catalogSeries) === link.getAttribute('href');
}

export function installCatalogNavigation(catalog: HTMLElement, view: Window = window): () => void {
  if (catalog.dataset.catalogNavigation === 'bound') return () => {};
  catalog.dataset.catalogNavigation = 'bound';
  let departure: { event: MouseEvent; link: HTMLAnchorElement } | null = null;
  const document = catalog.ownerDocument;
  function activation(event: MouseEvent) {
    const target = event.target as Element | null;
    const link = target?.closest?.<HTMLAnchorElement>(linkSelector);
    departure = link && catalog.contains(link) && isCatalogActivation(event, link, view.location.origin)
      ? { event, link } : null;
  }
  function pagehide() {
    const selected = departure;
    departure = null;
    // At departure the entire activation has completed: a later preventDefault
    // must not leave a false selection. pagehide is BFCache-compatible.
    if (!selected || !isCatalogActivation(selected.event, selected.link, view.location.origin)) return;
    const current: unknown = view.history.state;
    if (current !== null && !record(current)) return; // Do not replace another owner's primitive state.
    const saved: Resume = { version: 1, url: view.location.href, href: selected.link.getAttribute('href')! };
    try { view.history.replaceState({ ...current as State | null, [CATALOG_RESUME_KEY]: saved }, ''); }
    catch { /* Storage/security/clone restrictions leave the native route usable. */ }
  }
  function fragmentTarget(): HTMLElement | null {
    try {
      const target = document.getElementById(decodeURIComponent(view.location.hash.slice(1)));
      return target && catalog.contains(target) ? target : null;
    } catch { return null; }
  }
  function focus(target: HTMLElement) {
    const active = document.activeElement;
    // Never take focus away from a control the reader has already reached.
    if (active !== target && active !== document.body && active !== document.documentElement && active !== fragmentTarget()) return;
    if (active !== target) target.focus({ preventScroll: true, focusVisible: true });
  }
  function traversal() {
    const saved = catalogResume(view.history.state, view.location.href);
    if (!saved) return;
    const link = [...catalog.querySelectorAll<HTMLAnchorElement>(linkSelector)]
      .find((item) => item.getAttribute('href') === saved.href
        && (item.dataset.catalogRoute ?? item.dataset.catalogSeries) === saved.href);
    if (link) focus(link); // Focusing the original native anchor makes the FIRST Tab its DOM successor.
  }
  function pageshow(event: PageTransitionEvent) {
    const navigation = view.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (event.persisted || navigation?.type === 'back_forward') traversal();
    else {
      // Preserve a real fragment's sequential focus start on direct/reload
      // entries too; its existing heading tabindex or native anchor owns focus.
      const target = fragmentTarget();
      if (target?.matches(`${linkSelector}, [tabindex="-1"]`)) focus(target);
    }
  }
  view.addEventListener('click', activation, true);
  view.addEventListener('pagehide', pagehide);
  view.addEventListener('pageshow', pageshow);
  view.addEventListener('popstate', traversal);
  return () => {
    view.removeEventListener('click', activation, true);
    view.removeEventListener('pagehide', pagehide);
    view.removeEventListener('pageshow', pageshow);
    view.removeEventListener('popstate', traversal);
    delete catalog.dataset.catalogNavigation;
  };
}
