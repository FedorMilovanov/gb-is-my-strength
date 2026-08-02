/**
 * pastorSeriesConfig.ts — серия «Тёмная сторона кафедры» на общем reader engine.
 *
 * Part I gives a diagnostic framework. Part II applies the evidence contract to
 * documented cases and then shows faithful pathways under pressure. Every route
 * remains independently addressable, indexable and auditable.
 */
import { SERIES_CONFIGS, type SeriesConfig, defineSeriesConfig } from './seriesConfig';

export const PASTOR_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'pastor-series',
  seriesTitle: 'Тёмная сторона кафедры',
  seriesTitleFull: 'Тёмная сторона кафедры',
  railBackHref: '../../pastor-series/',
  quiz: [],
  breadcrumbParent: { label: 'Тёмная сторона кафедры', href: '../../pastor-series/' },
  items: [
    {
      id: 'antisovetov',
      mark: { kind: 'roman', value: 'I' },
      title: 'Часть I. 20 антисоветов пастору',
      shortTitle: 'Диагностика · 20 антисоветов',
      href: '/articles/20-antisovetov-pastoru/',
      readingTime: '67 мин',
    },
    {
      id: 'diotrophes',
      mark: { kind: 'roman', value: 'II' },
      title: 'Часть II. Диотрефы нашего времени',
      shortTitle: 'Механизмы власти и верные ответы',
      href: '/articles/diotrefy-nashego-vremeni/',
      readingTime: '35 мин',
    },
  ],
  pages: {
    antisovetov: {
      id: 'antisovetov',
      label: '20 антисоветов пастору',
      title: 'Часть I. 20 антисоветов пастору',
      mobileSection: 'Двустороннее зеркало',
      partLabel: 'Часть I · Содержание',
      readingProgressDoneMin: 0,
      readingProgressPartMin: 67,
      readingProgressTotalMin: 102,
      railNowTitle: '20 антисоветов пастору',
      railCover: '../../images/pastor-series/og-20-antisovetov-pastoru.webp',
      partDialogLabel: 'Часть I · 20 антисоветов пастору',
      partToc: [
        { href: '#two-way-mirror', label: 'Двустороннее зеркало', level: 2, current: true, summary: 'Статью можно злоупотребить с обеих сторон: и пастор, и прихожанин способны манипулировать Писанием.' },
        { href: '#roots', label: 'Откуда это берётся', level: 2, summary: 'Корень всех антисоветов — идолопоклонство перед служением.' },
        { href: '#section-1', label: 'I. Сердце и авторитет', level: 2 },
        { href: '#section-2', label: 'II. Команда и ближайшее окружение', level: 2 },
        { href: '#section-3', label: 'III. Инструменты контроля', level: 2 },
        { href: '#section-iv', label: 'IV. Отношения и внутренняя культура', level: 2 },
        { href: '#section-v', label: 'V. Сокрытие, прикрытие и финал', level: 2 },
        { href: '#itog', label: 'Итог', level: 2 },
        { href: '#antidot', label: 'Как не разрушиться: антидот', level: 2 },
        { href: '#zaklyuchenie', label: 'Заключение', level: 2 },
        { href: '#hope', label: 'Надежда', level: 2 },
        { href: '#faq', label: 'FAQ: как читать трезво', level: 2 },
        { href: '#sec-quiz', label: 'Проверь себя', level: 2 },
      ],
    },
    diotrophes: {
      id: 'diotrophes',
      label: 'Диотрефы нашего времени',
      title: 'Часть II. Диотрефы нашего времени',
      mobileSection: 'Механизмы власти',
      partLabel: 'Часть II · Содержание',
      readingProgressDoneMin: 67,
      readingProgressPartMin: 35,
      readingProgressTotalMin: 102,
      railNowTitle: 'Диотрефы нашего времени',
      railCover: '../../images/pastor-series/og-20-antisovetov-pastoru.webp',
      partDialogLabel: 'Часть II · Диотрефы нашего времени',
      partToc: [
        { href: '#short-summary', label: 'Коротко', level: 2, current: true },
        { href: '#interpretive-guardrails', label: 'Границы толкования', level: 2 },
        { href: '#biblical-profile', label: 'Диотреф в 3 Ин. 9–10', level: 2 },
        { href: '#authority-capture', label: 'Захват власти', level: 2 },
        { href: '#governance-procedure', label: 'Совет и процедура', level: 2 },
        { href: '#information-reputation', label: 'Информация и репутация', level: 2 },
        { href: '#retaliation-silencing', label: 'Возмездие и молчание', level: 2 },
        { href: '#sexual-spiritual-coercion', label: 'Духовное принуждение', level: 2 },
        { href: '#financial-dependency', label: 'Финансовая зависимость', level: 2 },
        { href: '#pastoral-conclusion', label: 'Пастырский вывод', level: 2 },
        { href: '#sources', label: 'Источники Wave 10', level: 2 },
        { href: '#quiz', label: 'Проверь различения', level: 2 },
        { href: '#faithful-witness-under-pressure', label: 'Верность под давлением', level: 2 },
        { href: '#fifteen-faithful-pathways', label: '15 реальных путей', level: 2 },
        { href: '#positive-board-comparator', label: 'Совет, который действует', level: 2 },
        { href: '#twenty-faithful-responses', label: '20 верных ответов', level: 2 },
        { href: '#faithful-decision-ladder', label: 'Лестница различения', level: 2 },
      ],
    },
  },
});

SERIES_CONFIGS[PASTOR_SERIES.seriesId] = PASTOR_SERIES;
