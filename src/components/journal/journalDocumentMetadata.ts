/** Route-owned head inputs only. No defaults, dates, assets or publication authority. */
export interface JournalDocumentMetadata {
  kind: 'CollectionPage' | 'Article';
  publishedAt: string;
  modifiedAt: string;
  socialImage: string;
  socialImageAlt: string;
}

function timestamp(value: string, name: string): number {
  const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  const invalid = () => new Error(`JournalDocumentHead: ${name} must be an explicit valid ISO timestamp with timezone`);
  if (!parts) throw invalid();
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  // Date.parse normalizes 24:00 to tomorrow. Check the authored calendar and
  // clock before parsing; Date.UTC also remaps years 00–99 into 1900–1999.
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) throw invalid();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw invalid();
  return parsed;
}

export function assertJournalDocumentMetadata(metadata: JournalDocumentMetadata): void {
  if (!metadata || !['Article', 'CollectionPage'].includes(metadata.kind)) {
    throw new Error('JournalDocumentHead: kind must be an explicit route-owned Article or CollectionPage');
  }
  const published = timestamp(metadata.publishedAt, 'publishedAt');
  const modified = timestamp(metadata.modifiedAt, 'modifiedAt');
  if (modified < published) throw new Error('JournalDocumentHead: modifiedAt must not precede publishedAt');
  for (const name of ['socialImage', 'socialImageAlt'] as const) {
    if (typeof metadata[name] !== 'string' || !metadata[name].trim()) {
      throw new Error(`JournalDocumentHead: ${name} must be an explicit non-empty route-owned value`);
    }
  }
}

/** Only admitted public Journal routes have a breadcrumb trail. */
export function journalBreadcrumbItems(canonical: string) {
  const home = 'https://gospod-bog.ru/';
  const journal = home + 'journal/';
  const dossier = journal + 'dossiers/g3/';
  const history = dossier + 'history/';
  const trail = [['Главная', home], ['Журнал', journal]];
  if (canonical === dossier || canonical === history) trail.push(['Досье G3', dossier]);
  if (canonical === history) trail.push(['История G3 (2011–2024)', history]);
  if (canonical !== journal && canonical !== dossier && canonical !== history) {
    throw new Error('JournalDocumentHead: unregistered breadcrumb canonical');
  }
  return trail.map(([name, item], index) => ({ '@type': 'ListItem', position: index + 1, name, item }));
}
