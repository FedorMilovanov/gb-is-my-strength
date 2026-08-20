export const SITE_SECTION_LINKS = [
  { id: 'publications', href: '/#publikacii', label: 'Публикации' },
  { id: 'refutations', href: '/#razbor', label: 'Разбор заблуждений' },
  { id: 'biografii', href: '/biografii/', label: 'Биографии' },
  { id: 'articles', href: '/articles/', label: 'Все статьи' },
  { id: 'app', href: '/app/', label: 'Приложение' },
  { id: 'about', href: '/about/', label: 'О проекте' },
] as const;

export type SiteSectionId = (typeof SITE_SECTION_LINKS)[number]['id'];
