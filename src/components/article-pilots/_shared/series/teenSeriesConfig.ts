/**
 * teenSeriesConfig.ts — prepublication reader config for the seven-part
 * «Подросток за кадром» / adult-child continuation series.
 *
 * IMPORTANT: A-D are first-class core reading steps. In the shared engine
 * mark.kind='letter' has satellite semantics and would remove them from the
 * normal rail/prev-next flow. Therefore A-D use core `label` marks.
 *
 * This file is safe to exist before publication: it creates no route and is
 * not imported by a public page yet. Media paths are deliberately provisional
 * until the separate rights/provenance/OG release gate is closed.
 */
import { SERIES_CONFIGS, type SeriesConfig, defineSeriesConfig } from './seriesConfig';

const TOTAL_MIN = 264;
const PREPUBLICATION_RAIL_COVER = '../../icons/icon-512.png';
const startToc = [{ href: '#article-content', label: 'Начало статьи', level: 2, current: true }] as const;

export const TEEN_DOUBLE_LIFE_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'teen-double-life',
  seriesTitle: 'Подросток за кадром',
  seriesTitleFull: 'Подросток за кадром: двойная жизнь, семья и взросление',
  railBackHref: '../../podrostok-za-kadrom/',
  quiz: [],
  breadcrumbParent: { label: 'Подросток за кадром', href: '../../podrostok-za-kadrom/' },
  items: [
    {
      id: 'teen-double-life',
      mark: { kind: 'roman', value: 'I' },
      title: 'Часть I. Как рождается двойная жизнь',
      shortTitle: 'Двойная жизнь',
      href: '/articles/podrostok-za-kadrom-dvoynaya-zhizn/',
      readingTime: '32 мин',
    },
    {
      id: 'teen-parents-after-disclosure',
      mark: { kind: 'roman', value: 'II' },
      title: 'Часть II. Что делать родителям после разоблачения',
      shortTitle: 'После разоблачения',
      href: '/articles/podrostok-za-kadrom-roditelyam-posle-razoblacheniya/',
      readingTime: '43 мин',
    },
    {
      id: 'teen-church-response',
      mark: { kind: 'roman', value: 'III' },
      title: 'Часть III. Что должна делать церковь',
      shortTitle: 'Что делает церковь',
      href: '/articles/podrostok-za-kadrom-chto-delat-tserkvi/',
      readingTime: '39 мин',
    },
    {
      id: 'adult-child-left-home',
      mark: { kind: 'label', value: 'A' },
      title: 'A. Взрослый ребёнок ушёл: контакт, ожидание, покаяние и возвращение',
      shortTitle: 'Ушёл из дома',
      href: '/articles/vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie/',
      readingTime: '37 мин',
    },
    {
      id: 'adult-child-home-money',
      mark: { kind: 'label', value: 'B' },
      title: 'B. Взрослый ребёнок дома: правила, деньги, помощь и последствия',
      shortTitle: 'Дом и деньги',
      href: '/articles/vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya/',
      readingTime: '36 мин',
    },
    {
      id: 'adult-child-authority',
      mark: { kind: 'label', value: 'C' },
      title: 'C. Совершеннолетие и родительская власть: что меняется, что остаётся',
      shortTitle: 'Власть после 18',
      href: '/articles/sovershennoletie-roditelskaya-vlast-chto-menyaetsya/',
      readingTime: '35 мин',
    },
    {
      id: 'adult-daughter-marriage',
      mark: { kind: 'label', value: 'D' },
      title: 'D. Взрослая дочь, отец и брак: согласие и границы власти',
      shortTitle: 'Дочь и брак',
      href: '/articles/vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti/',
      readingTime: '42 мин',
    },
  ],
  pages: {
    'teen-double-life': {
      id: 'teen-double-life',
      label: 'Двойная жизнь',
      title: 'Часть I. Как рождается двойная жизнь',
      mobileSection: 'Двойная жизнь',
      partLabel: 'Часть I · Содержание',
      readingProgressDoneMin: 0,
      readingProgressPartMin: 32,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Как рождается двойная жизнь',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'Часть I · Двойная жизнь',
      partToc: [...startToc],
    },
    'teen-parents-after-disclosure': {
      id: 'teen-parents-after-disclosure',
      label: 'После разоблачения',
      title: 'Часть II. Что делать родителям после разоблачения',
      mobileSection: 'После разоблачения',
      partLabel: 'Часть II · Содержание',
      readingProgressDoneMin: 32,
      readingProgressPartMin: 43,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Что делать родителям после разоблачения',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'Часть II · После разоблачения',
      partToc: [...startToc],
    },
    'teen-church-response': {
      id: 'teen-church-response',
      label: 'Что делает церковь',
      title: 'Часть III. Что должна делать церковь',
      mobileSection: 'Что делает церковь',
      partLabel: 'Часть III · Содержание',
      readingProgressDoneMin: 75,
      readingProgressPartMin: 39,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Что должна делать церковь',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'Часть III · Церковь',
      partToc: [...startToc],
    },
    'adult-child-left-home': {
      id: 'adult-child-left-home',
      label: 'Ушёл из дома',
      title: 'A. Взрослый ребёнок ушёл',
      mobileSection: 'Ушёл из дома',
      partLabel: 'A · Содержание',
      readingProgressDoneMin: 114,
      readingProgressPartMin: 37,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Контакт, ожидание, покаяние и возвращение',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'A · Взрослый ребёнок ушёл',
      partToc: [...startToc],
    },
    'adult-child-home-money': {
      id: 'adult-child-home-money',
      label: 'Дом и деньги',
      title: 'B. Взрослый ребёнок дома',
      mobileSection: 'Дом и деньги',
      partLabel: 'B · Содержание',
      readingProgressDoneMin: 151,
      readingProgressPartMin: 36,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Правила, деньги, помощь и последствия',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'B · Дом и деньги',
      partToc: [...startToc],
    },
    'adult-child-authority': {
      id: 'adult-child-authority',
      label: 'Власть после 18',
      title: 'C. Совершеннолетие и родительская власть',
      mobileSection: 'Власть после 18',
      partLabel: 'C · Содержание',
      readingProgressDoneMin: 187,
      readingProgressPartMin: 35,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Что меняется, что остаётся',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'C · Родительская власть',
      partToc: [...startToc],
    },
    'adult-daughter-marriage': {
      id: 'adult-daughter-marriage',
      label: 'Дочь и брак',
      title: 'D. Взрослая дочь, отец и брак',
      mobileSection: 'Дочь и брак',
      partLabel: 'D · Содержание',
      readingProgressDoneMin: 222,
      readingProgressPartMin: 42,
      readingProgressTotalMin: TOTAL_MIN,
      railNowTitle: 'Согласие и границы власти',
      railCover: PREPUBLICATION_RAIL_COVER,
      partDialogLabel: 'D · Дочь, отец и брак',
      partToc: [...startToc],
    },
  },
});

SERIES_CONFIGS[TEEN_DOUBLE_LIFE_SERIES.seriesId] = TEEN_DOUBLE_LIFE_SERIES;
