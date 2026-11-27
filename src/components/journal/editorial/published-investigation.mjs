/** Project an already admitted article collection entry; not publication authorization. */
export function projectPublishedInvestigation(data) {
  if (!data || data.section !== 'articles' || data.draft !== false || data.noindex !== false || data.canonicalOverride !== undefined ||
    typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) ||
    ![data.h1,data.description,data.ogImage,data.ogImageAlt].every(x=>typeof x==='string'&&x.trim()) ||
    !(data.publishedAt instanceof Date) || !Number.isFinite(data.publishedAt.getTime()) ||
    !Number.isSafeInteger(data.readingTime) || data.readingTime<1) throw new Error('Published canonical investigation metadata required');
  if (data.updatedAt !== undefined && (!(data.updatedAt instanceof Date) ||
    !Number.isFinite(data.updatedAt.getTime()) || data.updatedAt < data.publishedAt)) throw new Error('Invalid investigation update timestamp');
  const dateLabel = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'});
  const publishedLabel = dateLabel.format(data.publishedAt);
  const updatedLabel = data.updatedAt === undefined ? undefined : dateLabel.format(data.updatedAt);
  // A date-only card does not invent a separate editorial date for same-day updates.
  const update = updatedLabel !== undefined && updatedLabel !== publishedLabel
    ? { updatedAt:data.updatedAt.toISOString(), updatedLabel } : {};
  return {
    title:data.h1, href:'/articles/'+data.slug+'/', deck:data.description,
    publishedAt:data.publishedAt.toISOString(),
    publishedLabel, ...update,
    readingLabel:data.readingTime+' мин чтения',
    image:{src:data.ogImage,alt:data.ogImageAlt},
  };
}
