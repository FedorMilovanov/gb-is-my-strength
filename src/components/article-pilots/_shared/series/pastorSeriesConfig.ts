/**
 * pastorSeriesConfig.ts — серия «Тёмная сторона кафедры» (pastor-series) на
 * общем series-движке (четвёртый инстанс: Гилл → Сердце → Баптисты → Пастыри).
 *
 * Это НЕ одиночная статья: «20 антисоветов пастору» — часть I написанной пока
 * в зародыше серии из 3 блоков (Диагностика / Распознавание / Здоровый
 * образец). Полный роадмап с 8 planned-заглушками живёт на хабе
 * /pastor-series/ (как у баптистов: хаб = роадмап, рельс = текущая часть).
 * Добавить часть → элемент в items + страница в pages + статья на движке.
 *
 * quiz: [] пока (CBM-черновик из ветки lane ждёт вычитки владельцем — вкладка
 * «Тест» движком скрыта до утверждения).
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
      readingProgressTotalMin: 67,
      railNowTitle: '20 антисоветов пастору',
      railCover: '../../images/pastor-series/og-20-antisovetov-pastoru.webp',
      partDialogLabel: 'Часть I · 20 антисоветов пастору',
      partToc: [
        { href: '#two-way-mirror', label: 'Двустороннее зеркало', level: 2, current: true, summary: 'Статью можно злоупотребить с обеих сторон: и пастор, и прихожанин способны манипулировать Писанием.' },
        { href: '#roots', label: 'Откуда это берётся', level: 2, summary: 'Корень всех антисоветов — идолопоклонство перед служением.' },
        { href: '#section-1', label: 'I. Сердце и авторитет', level: 2, summary: 'Антисоветы о внутреннем состоянии пастора и природе его власти.' },
        { href: '#section-2', label: 'II. Команда и ближайшее окружение', level: 2, summary: 'Как разрушается здоровая команда вокруг лидера.' },
        { href: '#section-3', label: 'III. Инструменты контроля', level: 2, summary: 'Духовные, финансовые и численные рычаги давления.' },
        { href: '#section-iv', label: 'IV. Отношения и внутренняя культура', level: 2, summary: 'Как формируется нездоровая культура общины.' },
        { href: '#section-v', label: 'V. Сокрытие, прикрытие и финал', level: 2, summary: 'Механики сокрытия и предсказуемый финал спирали распада.' },
        { href: '#itog', label: 'Итог', level: 2, summary: 'Сводка всех двадцати антисоветов по пяти разделам.' },
        { href: '#antidot', label: 'Как не разрушиться: антидот', level: 2, summary: 'Не админ-стратегия, а иная позиция; ключевой тест — реакция на несогласие.' },
        { href: '#zaklyuchenie', label: 'Заключение', level: 2 },
        { href: '#hope', label: 'Надежда', level: 2 },
        { href: '#faq', label: 'FAQ: как читать трезво', level: 2 },
        { href: '#sec-quiz', label: 'Проверь себя', level: 2 },
      ],
    },
  },
});

// Регистрируем инстанс в общем реестре движка.
SERIES_CONFIGS[PASTOR_SERIES.seriesId] = PASTOR_SERIES;
