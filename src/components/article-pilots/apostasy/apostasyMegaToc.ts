export interface ApostasyMegaTocItem {
  href: string;
  label: string;
  level: 2 | 3;
}

/**
 * Оглавление читательского рельса для статьи
 * «Отступление от веры: Иуда, Евреям 6 и предупреждения всей Библии».
 *
 * Список зеркалит якоря <h2 id>/<h3 id> внутри самого MDX
 * (`src/content/articles/otstuplenie-ot-very-iuda-evreyam-6.mdx`):
 * порядок и href сняты с собранного текста, поэтому рельс не может
 * разъехаться с внутритекстовой структурой.
 */
export const APOSTASY_MEGA_TOC: ApostasyMegaTocItem[] = [
  { href: '#slovar', label: "Что Библия называет отступлением", level: 2 },
  { href: '#pustynya', label: "Пустыня: главный библейский образ привилегии без веры", level: 2 },
  { href: '#vethiy-zavet', label: "Отступление в Ветхом Завете: завет нарушается сердцем", level: 2 },
  { href: '#pochvy', label: "Иисус: можно веровать «до времени»", level: 2 },
  { href: '#lozhnye-ispovedniki', label: "Ложное исповедание может быть очень убедительным", level: 2 },
  { href: '#iuda', label: "Иуда: апостол по служению, неверующий в сердце", level: 2 },
  { href: '#iuda-pokayanie', label: "Раскаяние Иуды и печаль, производящая смерть", level: 2 },
  { href: '#petr', label: "Пётр: тяжёлое падение не равно окончательному отступлению", level: 2 },
  { href: '#simon', label: "Симон волхв: «уверовал» и крестился, но сердце осталось неправым", level: 2 },
  { href: '#evreyam', label: "Послание к Евреям: предупреждения — позвоночник проповеди", level: 2 },
  { href: '#evreyam-6', label: "Евреям 6:4–6: насколько далеко можно зайти", level: 2 },
  { href: '#evreyam-6-otpadshie', label: "Что означает «отпадших»", level: 3 },
  { href: '#evreyam-6-vzglyady', label: "Почему верующие толкователи расходятся", level: 3 },
  { href: '#evreyam-10', label: "Евреям 10:26–39: не «любой сознательный грех», а отвержение единственной жертвы", level: 2 },
  { href: '#evreyam-12', label: "Евреям 12: горький корень, Исав и отказ слышать", level: 2 },
  { href: '#pavlovy-predosterezheniya', label: "Павел: «стой верою» — не пустая формула", level: 2 },
  { href: '#galatam', label: "«Отпали от благодати» в Галатам 5", level: 2 },
  { href: '#2-petra', label: "2 Петра 2: убежавшие от скверн возвращаются в грязь", level: 2 },
  { href: '#1-ioanna', label: "1 Иоанна 2:19: уход обнаруживает то, что прежде было скрыто", level: 2 },
  { href: '#ioanna-15', label: "Иоанна 15: ветви «во Мне» и необходимость пребывать", level: 2 },
  { href: '#otkrovenie', label: "Откровение: стойкость церкви и стойкость побеждающего", level: 2 },
  { href: '#kategoriya', label: "Семь библейских категорий, которые нельзя смешивать", level: 2 },
  { href: '#sohranenie', label: "Сохранение святых: Бог хранит через веру", level: 2 },
  { href: '#predosterezheniya-sredstvo', label: "Почему настоящие угрозы совместимы с неизменным Божьим замыслом", level: 2 },
  { href: '#uverennost', label: "Уверенность без самонадеянности", level: 2 },
  { href: '#strah', label: "Что сказать человеку, который боится: «А вдруг я уже отпал?»", level: 2 },
  { href: '#itog', label: "Итог: отступление раскрывает корень, а предупреждение хранит бодрствующих", level: 2 },
  { href: '#karta-tekstov', label: "Карта Писания по теме", level: 2 },
  { href: '#istochniki', label: "Источники и сверка", level: 2 },
];
