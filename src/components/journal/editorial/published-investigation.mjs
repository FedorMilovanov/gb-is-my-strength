/** Project an already admitted article collection entry; not publication authorization. */
export function projectPublishedInvestigation(data) {
  if (!data || data.section !== 'articles' || data.draft !== false || data.noindex !== false || data.canonicalOverride !== undefined ||
    typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) ||
    ![data.h1,data.description,data.ogImage,data.ogImageAlt].every(x=>typeof x==='string'&&x.trim()) ||
    !(data.publishedAt instanceof Date) || !Number.isFinite(data.publishedAt.getTime()) ||
    !Number.isSafeInteger(data.readingTime) || data.readingTime<1) throw new Error('Published canonical investigation metadata required');
  return {
    title:data.h1, href:'/articles/'+data.slug+'/', deck:data.description,
    publishedAt:data.publishedAt.toISOString(),
    publishedLabel:new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'}).format(data.publishedAt),
    readingLabel:data.readingTime+' мин чтения',
    image:{src:data.ogImage,alt:data.ogImageAlt},
  };
}
