/**
 * teenSeriesConfig.ts — reader config for the seven-part
 * «Подросток за кадром» / adult-child continuation series.
 *
 * IMPORTANT: A-D are first-class core reading steps. In the shared engine
 * mark.kind='letter' has satellite semantics and would remove them from the
 * normal rail/prev-next flow. Therefore A-D use core `label` marks.
 */
import { SERIES_CONFIGS, type SeriesConfig, type SeriesPartTocItem, defineSeriesConfig } from './seriesConfig';
import { teenSeriesMediaFor } from './teenSeriesMedia';

const TOTAL_MIN = 264;
const toc = (...items: SeriesPartTocItem[]): SeriesPartTocItem[] => items;

const teenDoubleLifeToc = toc(
  { href: '#ne-telefon', label: 'Не телефон начал эту историю', level: 2, current: true },
  { href: '#sladost', label: 'Почему грех хочется защищать', level: 2 },
  { href: '#infrastruktura', label: 'Инфраструктура тайной жизни', level: 2 },
  { href: '#safety', label: 'Граница: грех, вред и эксплуатация', level: 2 },
  { href: '#lozh', label: 'Тайна и управление правдой', level: 2 },
  { href: '#sovest', label: 'Как притупляется совесть', level: 2 },
  { href: '#diagnoz', label: 'Лицемер, павший или необращённый?', level: 2 },
  { href: '#svet-vyhod', label: 'Выйти на свет', level: 2 },
  { href: '#part2', label: 'Что дальше', level: 2 },
);

const teenParentsToc = toc(
  { href: '#ne-spasiteli-ne-zriteli', label: 'Родители не спасители — и не зрители', level: 2, current: true },
  { href: '#urovni-trebovaniy', label: 'Заповедь, мудрость и домашнее правило', level: 2 },
  { href: '#den-obnaruzheniya', label: 'День обнаружения: сначала различить', level: 2 },
  { href: '#poiman-ne-raven-pokayalsya', label: 'Пойман — не значит покаялся', level: 2 },
  { href: '#kak-vyglyadit-pokayanie', label: 'Как начинает выглядеть покаяние', level: 2 },
  { href: '#doverie-ne-pereklyuchatel', label: 'Доверие — не один переключатель', level: 2 },
  { href: '#ispravit-vred', label: 'Покаяние смотрит на причинённый вред', level: 2 },
  { href: '#roditeli-tozhe-na-svet', label: 'Родители тоже выходят на свет', level: 2 },
  { href: '#bog-daet-serdce', label: 'Бог даёт новое сердце', level: 2 },
  { href: '#part3', label: 'Что дальше', level: 2 },
);

const teenChurchToc = toc(
  { href: '#deti-ne-vne-zakona', label: 'Дети не вне нравственной ответственности', level: 2, current: true },
  { href: '#pesnya-i-zhizn', label: 'Когда уста и жизнь расходятся', level: 2 },
  { href: '#poklonenie-ne-pravo-na-hor', label: 'Поклонение и доверенная роль — не одно', level: 2 },
  { href: '#slovo-i-privilegii', label: 'Слышать Слово — не доступ ко всему', level: 2 },
  { href: '#uveshchevanie-ne-tolpa', label: 'Увещевание без коллективной травли', level: 2 },
  { href: '#bezopasnost-ne-distsiplina', label: 'Безопасность и церковная дисциплина', level: 2 },
  { href: '#proshchenie-i-dostup', label: 'Прощение, доверие и доступ', level: 2 },
  { href: '#svyatost-i-vosstanovlenie', label: 'Святость и восстановление', level: 2 },
  { href: '#ne-hor-i-ne-reputatsiya', label: 'Конечная цель', level: 2 },
  { href: '#chto-dalshe', label: 'Что дальше', level: 2 },
);

const adultChildLeftToc = toc(
  { href: '#sovershennoletie-menyaet-yurisdiktsiyu', label: 'Совершеннолетие меняет юрисдикцию', level: 2, current: true },
  { href: '#pervye-chasy-posle-uhoda', label: 'Первые часы после ухода', level: 2 },
  { href: '#luka15-o-chem-pritcha', label: 'Лука 15: о чём сама притча', level: 2 },
  { href: '#kontakt-bez-kontrolya', label: 'Контакт без контроля', level: 2 },
  { href: '#posledstviya-ne-proizvodstvo-stradaniya', label: 'Последствия без производства страдания', level: 2 },
  { href: '#nadezhda-ne-doverchivost', label: 'Надежда — не доверчивость', level: 2 },
  { href: '#dolgoe-ozhidanie', label: 'Когда ожидание становится долгим', level: 2 },
  { href: '#miloserdie-i-doverie', label: 'Милость и повторное доверение', level: 2 },
  { href: '#ne-stat-starshim-bratom', label: 'Не становиться старшим братом', level: 2 },
  { href: '#chto-zdes-namerenno-ne-resheno', label: 'Что здесь намеренно не решено', level: 2 },
);

const adultChildHomeToc = toc(
  { href: '#vzroslyy-v-dome-ne-gost-i-ne-rebenok', label: 'Взрослый дома: не гость и не ребёнок', level: 2, current: true },
  { href: '#chetyre-urovnya-trebovaniy', label: 'Четыре уровня требований', level: 2 },
  { href: '#otdelnoe-prozhivanie-ne-bibleyskaya-kara', label: 'Отдельное проживание — не кара', level: 2 },
  { href: '#pomoshch-ne-ravna-nalichnym', label: 'Помощь не равна наличным', level: 2 },
  { href: '#dengi-ne-pokupayut-vlast', label: 'Деньги не покупают тотальную власть', level: 2 },
  { href: '#poruchitelstvo-ne-obyazannost-lyubvi', label: 'Поручительство — не обязанность любви', level: 2 },
  { href: '#ne-sozdavayte-rok-bottom', label: 'Не создавайте «дно»', level: 2 },
  { href: '#tretie-litsa-i-alternativnyy-dom', label: 'Третьи лица и «альтернативный дом»', level: 2 },
  { href: '#prakticheskaya-matritsa', label: 'Матрица перед крупным решением', level: 2 },
  { href: '#pravovye-granitsy', label: 'Где статья останавливается', level: 2 },
  { href: '#evangelie-i-granitsy', label: 'Граница не спасает — Христос спасает', level: 2 },
);

const adultAuthorityToc = toc(
  { href: '#pyataya-zapoved-ne-istekaet', label: 'Пятая заповедь не истекает', level: 2, current: true },
  { href: '#pochitanie-i-poslushanie', label: 'Почитание и послушание', level: 2 },
  { href: '#vlast-po-otnosheniyu', label: 'Власть относится к конкретному отношению', level: 2 },
  { href: '#sovet-ne-veto', label: 'Совет, согласие и вето — не одно', level: 2 },
  { href: '#samostoyatelnost-dva-smysla', label: 'Два смысла самостоятельности', level: 2 },
  { href: '#roditeli-ne-imeyut-prava-na-tiraniyu', label: 'Пятая заповедь не оправдывает тиранию', level: 2 },
  { href: '#kak-reshat-spor', label: 'Как разбирать конкретный спор', level: 2 },
  { href: '#syn-i-doch-obshaya-osnova', label: 'Сын и дочь: общая основа', level: 2 },
  { href: '#cerkov-ne-zamena-seme', label: 'Церковь не заменяет семью', level: 2 },
  { href: '#novyy-dom-posle-braka', label: 'Брак создаёт новый дом', level: 2 },
  { href: '#gospel-center', label: 'Ни автономия, ни контроль не дают новое сердце', level: 2 },
);

const adultDaughterToc = toc(
  { href: '#korotko', label: 'Коротко', level: 2, current: true },
  { href: '#fatherhood-not-husband-headship', label: 'Отец — не муж своей дочери', level: 2 },
  { href: '#genesis-24', label: 'Бытие 24: участие семьи и ответ Ревекки', level: 2 },
  { href: '#first-corinthians-7', label: '1 Коринфянам 7:36–38', level: 2 },
  { href: '#1689-consent', label: '1689: способность дать согласие', level: 2 },
  { href: '#historical-practice-not-direct-statute', label: 'Историческая практика и Писание', level: 2 },
  { href: '#father-says-no', label: 'Если отец говорит «нет»', level: 2 },
  { href: '#mediation', label: 'Посредничество при серьёзном несогласии', level: 2 },
  { href: '#coercion-forced-marriage', label: 'Принуждение к браку', level: 2 },
  { href: '#church-role', label: 'Роль церкви', level: 2 },
  { href: '#civil-law', label: 'Гражданское право и границы статьи', level: 2 },
  { href: '#gospel-center', label: 'Христос остаётся Господом всех', level: 2 },
);

export const TEEN_DOUBLE_LIFE_SERIES: SeriesConfig = defineSeriesConfig({
  seriesId: 'teen-double-life',
  seriesTitle: 'Подросток за кадром',
  seriesTitleFull: 'Подросток за кадром: двойная жизнь, семья и взросление',
  railBackHref: '/podrostok-za-kadrom/',
  quiz: [],
  breadcrumbParent: { label: 'Подросток за кадром', href: '/podrostok-za-kadrom/' },
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
      railCover: teenSeriesMediaFor('teen-double-life').rail,
      partDialogLabel: 'Часть I · Двойная жизнь',
      partToc: teenDoubleLifeToc,
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
      railCover: teenSeriesMediaFor('teen-parents-after-disclosure').rail,
      partDialogLabel: 'Часть II · После разоблачения',
      partToc: teenParentsToc,
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
      railCover: teenSeriesMediaFor('teen-church-response').rail,
      partDialogLabel: 'Часть III · Церковь',
      partToc: teenChurchToc,
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
      railCover: teenSeriesMediaFor('adult-child-left-home').rail,
      partDialogLabel: 'A · Взрослый ребёнок ушёл',
      partToc: adultChildLeftToc,
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
      railCover: teenSeriesMediaFor('adult-child-home-money').rail,
      partDialogLabel: 'B · Дом и деньги',
      partToc: adultChildHomeToc,
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
      railCover: teenSeriesMediaFor('adult-child-authority').rail,
      partDialogLabel: 'C · Родительская власть',
      partToc: adultAuthorityToc,
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
      railCover: teenSeriesMediaFor('adult-daughter-marriage').rail,
      partDialogLabel: 'D · Дочь, отец и брак',
      partToc: adultDaughterToc,
    },
  },
});

SERIES_CONFIGS[TEEN_DOUBLE_LIFE_SERIES.seriesId] = TEEN_DOUBLE_LIFE_SERIES;
