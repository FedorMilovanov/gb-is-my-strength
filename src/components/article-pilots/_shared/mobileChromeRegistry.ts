/**
 * Mobile Chrome Registry — движок мобильной обвязки выбирается КОНФИГОМ,
 * не строкой URL в компонентах (план GILL_RESEARCH_3_ENGINES §11:
 * «Не определять engine по pathname.includes(...)»).
 *
 * mount:
 *  - 'static'   — обвязка уже собрана внутри Chrome-компонента раздела
 *                 (Гилл: GillSeriesChrome→GillSeriesMobileBar; Герменевтика:
 *                 HermenevtikaBody→HermenevtikaMobileBar). Запись фиксирует
 *                 движок/адаптер как контракт и не требует подключения.
 *  - 'registry' — страница подключает адаптер сама через mobileChromeFor():
 *                 первый потребитель — каталог /articles/ (пилот page-движка).
 *
 * Rollout: новые страницы добавляются записями сюда; после freeze профиль
 * маршрута в data/route-profiles/*.json зеркалит поле mobileChrome.
 */
import type { MobileChromeEngine } from './mobileChromeTypes';

export interface MobileChromeRegistryEntry {
  enabled: boolean;
  engine: MobileChromeEngine;
  adapter: 'gill' | 'hermenevtika' | 'default-page';
  mount: 'static' | 'registry';
  /** Для page-движка: фолбэк «Назад» при прямом заходе без истории. */
  backHref?: string;
}

export const MOBILE_CHROME_ROUTES: Record<string, MobileChromeRegistryEntry> = {
  // --- series (эталон: Гилл) — статически в GillSeriesChrome ---
  '/articles/dzhon-gill-istoricheskiy-kontekst/': { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-1-chelovek/':       { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-2-uchenyi/':        { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-3-nasledie/':       { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-chast-4-ekzeget/':        { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },
  '/articles/dzhon-gill-spravochnik/':            { enabled: true, engine: 'series', adapter: 'gill', mount: 'static' },

  // --- article (эталон: Герменевтика) — статически в HermenevtikaBody ---
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/':
    { enabled: true, engine: 'article', adapter: 'hermenevtika', mount: 'static' },

  // --- page: каталоги/лендинги — Back·Home·Глобальный Поиск сверху ---
  '/articles/':    { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/biografii/':   { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/hard-texts/':  { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  '/rodosloviye/': { enabled: true, engine: 'page', adapter: 'default-page', mount: 'registry', backHref: '/' },
  // /izbrannoe/ НЕ подключается: у него sticky-navbar (top:0, без автоскрытия) —
  // бар движка стекнулся бы поверх «двойной шапкой». Верхняя навигация там уже
  // постоянна, движок «page» не нужен.
};

/** Точное совпадение маршрута; null = у страницы нет мобильной обвязки движка. */
export function mobileChromeFor(route: string): MobileChromeRegistryEntry | null {
  return MOBILE_CHROME_ROUTES[route] ?? null;
}
