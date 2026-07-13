import type { ReaderRailTocItem } from '../_shared/ReaderRail.astro';

/** Оглавление статьи «Код да Винчи» для читательского рельса (ReaderRail).
 *  Секции — H2 статьи в порядке документа. */
export const KOD_DA_VINCHI_TOC: ReaderRailTocItem[] = [
  { href: '#sec-intro', label: 'Введение', level: 2 },
  { href: '#sec-phenomenon', label: 'Как родился мировой феномен', level: 2 },
  { href: '#sec-dates', label: 'Ключевые даты', level: 2 },
  { href: '#sec-errors', label: 'Ключевые исторические ошибки романа', level: 2 },
  { href: '#sec-lie1', label: 'Ложь №1: Иисус был женат', level: 2 },
  { href: '#sec-feminine', label: 'Миф о «подавленном женском начале»', level: 2 },
  { href: '#sec-lie2', label: 'Ложь №2: Константин создал Библию', level: 2 },
  { href: '#sec-canon', label: 'Как формировался канон', level: 2 },
  { href: '#sec-qumran', label: 'Кумран и Наг-Хаммади', level: 2 },
  { href: '#sec-lie3', label: 'Ложь №3: Гностические евангелия древнее', level: 2 },
  { href: '#sec-lie4', label: 'Ложь №4: Безбрачие «неиудейское»', level: 2 },
  { href: '#sec-lie5', label: 'Ложь №5: Мария на «Тайной вечере»', level: 2 },
  { href: '#sec-lie6', label: 'Ложь №6: Приорат Сиона', level: 2 },
  { href: '#sec-gnostic', label: 'Гностические «евангелия»', level: 2 },
  { href: '#sec-church', label: 'Ересь обличалась с самого начала', level: 2 },
  { href: '#sec-why', label: 'Почему роман убедителен', level: 2 },
  { href: '#sec-quiz', label: 'Проверь себя', level: 2 },
  { href: '#sec-faq', label: 'Часто задаваемые вопросы', level: 2 },
  { href: '#sec-conclusion', label: 'Итог', level: 2 },
];
