/**
 * Mobile Chrome Platform — общий контракт трёх движков.
 *
 * (Пакет GILL_RESEARCH_3_ENGINES, документ 03.) Один общий каркас
 * (MobileChromeShell) и три тонких профиля-адаптера:
 *   - series  — серия (эталон: Gill): dual progress, Series+Part TOC, marks, Learning;
 *   - article — одиночная статья (эталон: Hermenevtika): single progress, Article TOC;
 *   - page    — обычные страницы/каталоги/карты: primary action = глобальный поиск.
 *
 * Каркас не знает ничего про Gill, Hermenevtika, Pagefind, TTS, BookmarkEngine
 * или quiz — только структура, safe-area, landmarks и sheet-скелет. Состав
 * слотов, тип прогресса, тип TOC и брендинг задаёт адаптер.
 *
 * Никакого mega-component с двадцатью boolean-флагами: shell + адаптеры
 * сохраняют единый каркас и отдельную семантику каждого движка.
 */
export type MobileChromeEngine = 'series' | 'article' | 'page';

/** Главное верхнее действие движка. */
export type MobileChromePrimary =
  | { kind: 'learning'; label: string; controlsId: string }
  | { kind: 'search'; label: string }
  | { kind: 'custom'; label: string };

/** Прогресс чтения: серия читает две полосы, статья — одну, страница — ни одной. */
export type MobileChromeProgress =
  | { kind: 'dual'; articleLabel: string; seriesLabel: string }
  | { kind: 'single'; articleLabel: string }
  | { kind: 'none' };

/** Навигация по содержимому. */
export type MobileChromeToc =
  | { kind: 'series-and-part'; seriesOverlayId: string; partOverlayId: string }
  | { kind: 'article'; overlayId: string }
  | { kind: 'sections'; overlayId: string }
  | { kind: 'none' };

/** Тип нижнего листа (sheet). */
export type MobileSheetKind = 'toc' | 'learning' | 'settings' | 'search' | 'actions';

/**
 * Полный контракт мобильного каркаса конкретного движка. Адаптер собирает
 * этот объект и раскладывает слоты shell'а согласно ему.
 */
export interface MobileChromeContract {
  engine: MobileChromeEngine;
  /** id корневого узла каркаса (уникален на странице). */
  id: string;
  primary: MobileChromePrimary;
  progress: MobileChromeProgress;
  toc: MobileChromeToc;
  /** Есть ли TTS-воспроизведение (Play + inline speed rail). */
  playback: boolean;
  /** Есть ли кнопка «сохранить». */
  save: boolean;
  /** Есть ли лист настроек чтения (тема/размер/интервал/ширина). */
  readerSettings: boolean;
}
