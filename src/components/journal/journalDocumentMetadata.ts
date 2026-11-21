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
  const parsed = Date.parse(value);
  const invalidCalendar = parts && (Number(parts[2]) < 1 || Number(parts[2]) > 12 || Number(parts[3]) < 1 || Number(parts[3]) > new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate());
  if (!parts || invalidCalendar || !Number.isFinite(parsed)) {
    throw new Error(`JournalDocumentHead: ${name} must be an explicit valid ISO timestamp with timezone`);
  }
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
