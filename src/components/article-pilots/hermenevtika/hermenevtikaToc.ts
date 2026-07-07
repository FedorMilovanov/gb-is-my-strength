export interface HermenevtikaTocItem {
  href: string;
  label: string;
  level: 2 | 3;
}

// Mirrors the article's own H2/H3 structure (ids already present in
// HermenevtikaBody.astro). Meta/utility sections (summary card, quiz,
// accuracy-report, related-articles) are intentionally left out — this is a
// content outline, not every heading on the page.
export const HERMENEVTIKA_TOC: HermenevtikaTocItem[] = [
  { href: '#sec-definitions', label: 'Герменевтические определения', level: 2 },
  { href: '#sec-explanation', label: 'Объяснение христоцентричной герменевтики', level: 2 },
  { href: '#sec-what-is', label: 'Что такое христоцентричная герменевтика?', level: 3 },
  { href: '#sec-how-achieves', label: 'Как она достигает своих целей', level: 3 },
  { href: '#sec-why', label: 'Почему она стремится к такому толкованию', level: 3 },
  { href: '#sec-assessment', label: 'Оценка христоцентричной герменевтики', level: 3 },
  { href: '#sec-consequences', label: 'Последствия христоцентричной герменевтики', level: 3 },
  { href: '#sec-sufficiency', label: 'Достаточность грамматико-исторической герменевтики', level: 3 },
  { href: '#sec-conclusion', label: 'Заключение', level: 3 },
  { href: '#spravka', label: 'Часто задаваемые вопросы', level: 2 },
];
