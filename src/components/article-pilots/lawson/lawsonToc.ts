export interface LawsonTocItem {
  href: string;
  label: string;
  level: 2 | 3;
}

/**
 * Оглавление читательского рельса для статьи о Стивене Лоусоне.
 *
 * Список зеркалит блок «Содержание» внутри самой статьи
 * (`#lawson-toc-heading`), поэтому рельс и внутритекстовое оглавление не могут
 * разъехаться: оба перечисляют одни и те же якоря в одном порядке.
 */
export const LAWSON_TOC: LawsonTocItem[] = [
  { href: '#ramka', label: 'Что установлено — и где нужно остановиться', level: 2 },
  { href: '#long-arc', label: 'Почему здесь важен длинный путь доверия', level: 2 },
  { href: '#statements', label: 'Что именно заявили церковь и служение', level: 2 },
  { href: '#discovery', label: 'Как это было обнаружено: две версии одного события', level: 2 },
  { href: '#macarthur', label: 'МакАртур: здравое богословие и нравственная квалификация', level: 2 },
  { href: '#self-deception', label: 'Лоусон сам учил о самообмане и совести', level: 2 },
  { href: '#six-roots', label: 'Шесть причин книги и прежний язык Лоусона', level: 2 },
  { href: '#autobiography', label: 'Автобиография — источник, но не собственная проверка', level: 2 },
  { href: '#repentance', label: 'Покаяние и реальная подотчётность после 2024 года', level: 2 },
  { href: '#accountability', label: 'Подотчётность, которую можно проверить', level: 2 },
  { href: '#book', label: 'Что меняет Mercy in the Wilderness', level: 2 },
  { href: '#authorship', label: 'Спор об авторстве книги и что он показал', level: 2 },
  { href: '#wilderness', label: 'Проблема метафоры «пустыни»', level: 2 },
  { href: '#economics', label: 'Экономика книги: цена, тираж и «долгая игра»', level: 2 },
  { href: '#platform', label: 'Прощение, должность, доверие и публичный голос', level: 2 },
  { href: '#gatekeeping', label: 'Почему вопрос внешнего суждения остаётся', level: 2 },
  { href: '#catalog', label: 'Что осталось в публичном доступе', level: 2 },
  { href: '#old-sermons', label: 'Что делать с прежними проповедями Лоусона', level: 2 },
  { href: '#comment', label: 'Октябрь 2026: комментарий, который был отредактирован', level: 2 },
  { href: '#objections', label: 'Сильнейшие возражения против этой статьи', level: 2 },
  { href: '#pastoral', label: 'Почему эта история касается не только Лоусона', level: 2 },
  { href: '#verdict', label: 'Вывод: что теперь должно говорить громче слов', level: 2 },
  { href: '#glossary', label: 'Краткий словарь', level: 2 },
  { href: '#sources', label: 'Источники', level: 2 },
];
