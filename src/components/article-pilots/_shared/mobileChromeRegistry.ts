/**
 * Mobile Chrome Registry — движок мобильной обвязки выбирается КОНФИГОМ,
 * не строкой URL в компонентах (план GILL_RESEARCH_3_ENGINES §11:
 * «Не определять engine по pathname.includes(...)»).
 *
 * mount:
 *  - 'static'   — обвязка уже собрана внутри Chrome-компонента раздела
 *                 (Гилл: SeriesReaderChrome→GillSeriesMobileBar; Герменевтика:
 *                 HermenevtikaBody→HermenevtikaMobileBar). Запись фиксирует
 *                 движок/адаптер как контракт и не требует подключения.
 *  - 'registry' — страница подключает адаптер сама через mobileChromeFor().
 *                 Каталоги используют default-page; книжный landing может
 *                 использовать тот же лёгкий shell с engine='series'.
 *
 * Rollout: новые страницы добавляются записями сюда; после freeze профиль
 * маршрута в data/route-profiles/*.json зеркалит поле mobileChrome.
 */
import type { MobileChromeEngine } from './mobileChromeTypes';

export interface MobileChromeRegistryEntry {
  enabled: boolean;
  engine: MobileChromeEngine;
  adapter: 'gill' | 'hermenevtika' | 'default-page' | 'series-landing';
  mount: 'static' | 'registry';
  /** Для landing/page-движка: фолбэк «Назад» при прямом заходе без истории. */
  backHref?: string;
}

export const MOBILE_CHROME_ROUTES: Record<string, MobileChromeRegistryEntry> = {
  // --- series (эталон: Гилл) — статически в SeriesReaderChrome ---
  '/articles/dzhon-gill-istoricheskiy-kontekst/': { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-1-chelovek/':       { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-2-uchenyi/':        { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-3-nasledie/':       { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-4-ekzeget/':        { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-spravochnik/':            { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },

  // --- article (эталон: Герменевтика) — статически в HermenevtikaBody ---
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/':
    { enabled: true, engine: 'article', adapter: 'hermenevtika', mount: 'static' },

  // --- series landing: книжная полка без reader-progress ---
  '/hard-texts/': { enabled: true, engine: 'series', adapter: 'series-landing', mount: 'registry', backHref: '/' },

  // --- page: каталоги/лендинги — Back·Home·Глобальный Поиск сверху ---
  '/articles/':    { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/biografii/':   { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/rodosloviye/': { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/karty/':       { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/konfessii/':   { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  // НЕ подключены (сознательно):
  // - /izbrannoe/ — sticky-navbar (top:0, без автоскрытия): бар движка стекнулся
  //   бы «двойной шапкой»; верхняя навигация там уже постоянна.
  // - /map/ — полноэкранный интерактивный граф, страница почти не скроллится
  //   (~110px): scroll-reveal-модель бара не срабатывает, а свой back-линк
  //   «← НА ГЛАВНУЮ» в контенте уже покрывает навигацию.
};

/** Точное совпадение маршрута; null = у страницы нет мобильной обвязки движка. */
export function mobileChromeFor(route: string): MobileChromeRegistryEntry | null {
  return MOBILE_CHROME_ROUTES[route] ?? null;
}
