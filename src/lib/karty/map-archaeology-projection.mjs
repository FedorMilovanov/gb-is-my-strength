const ACCEPTED_STATUSES = new Set(['accepted-context', 'primary-identification']);
const POSITIVE_EVIDENCE_USES = new Set(['high', 'supporting']);
const INTERPRETATION_USES = new Set(['interpretation']);
const NEGATIVE_EVIDENCE_USES = new Set(['negative']);
const unique = (values) => [...new Set((values || []).filter(Boolean))];

export const READER_CLAIM_COPY_RU = Object.freeze({
  'assyrian-kingdoms-context': Object.freeze({
    statement: 'Ассирийские царские анналы, Лахишские рельефы и стела Меши образуют независимый эпиграфический и визуальный контекст эпохи царств.',
    limitations: 'Царские надписи отражают тенденциозную точку зрения древних правителей; спорные чтения должны прямо обозначаться как дискуссионные.',
  }),
  'avraam-chronology-yec': Object.freeze({
    statement: 'Проект помещает жизнь Авраама около 2166 г. до Р. Х. в рамках классической библейской хронологии (Ашшер / YEC), сохраняя при этом принятые в науке археологические периодизации в описании находок.',
    limitations: 'Это богословско-хронологическая рамка проекта, а не независимо установленная по раскопкам абсолютная дата жизни Авраама.',
  }),
  'babylonian-exile-context': Object.freeze({
    statement: 'Вавилонские хроники, хозяйственные таблички и отчёты раскопок в Иерусалиме дают первоисточниковый исторический контекст нововавилонских завоеваний и плена.',
    limitations: 'Атрибуция находок и переводы следуют музейным каталогам; сами по себе они не реконструируют каждое отдельное событие книг Царств, Паралипоменон и Иеремии.',
  }),
  'beersheba-regional-context': Object.freeze({
    statement: 'Котловина Вирсавии сохраняет многовековую историю поселений и водопользования, однако главные монументальные сооружения Тель-Беэр-Шевы относятся к более позднему времени, чем эпоха патриархов.',
    limitations: 'Телль железного века нельзя выдавать за раскопанный город или личный колодец Авраама.',
  }),
  'bethel-beitin-candidate': Object.freeze({
    statement: 'Бейтин остаётся на карте основным кандидатом для отождествления с древним Вефилем при явном сохранении альтернативных научных гипотез.',
    limitations: 'Статус кандидата требует пополнения корпуса первичных отчётов о раскопках, прежде чем говорить об общепринятой идентификации.',
  }),
  'dead-sea-scrolls-context': Object.freeze({
    statement: 'Цифровые собрания Управления древностей Израиля и Музея Израиля дают выверенный доступ к рукописям, контексту находок и музейным метаданным свитков Мёртвого моря.',
    limitations: 'Музейная публикация рукописей сама по себе не закрывает споров об авторстве, природе общины, палеографической датировке и реконструкции лакун.',
  }),
  'early-church-context': Object.freeze({
    statement: 'Музейные собрания, полевые исследования в Иерусалиме и многолетние раскопки Эфеса раскрывают материальную среду иудейского и греко-римского мира ранней Церкви.',
    limitations: 'Полевые и музейные данные подтверждают историческую среду эпохи; суждения о конкретных апостольских событиях требуют текстологического и локального анализа.',
  }),
  'euphrates-corridor-context': Object.freeze({
    statement: 'Ур, Мари, Кархемиш и Харран образуют археологически засвидетельствованные узловые центры Евфратского пути на карте.',
    limitations: 'Точная линия перехода между этими узлами остаётся исторической реконструкцией маршрута, а не буквально прослеженной археологами дорогой Авраама.',
  }),
  'exodus-route-context': Object.freeze({
    statement: 'Египетские письменные памятники, материалы приграничных укреплений Синая и раскопки Вади-Тумилат задают историко-географическую рамку для оценки предлагаемых маршрутов Исхода.',
    limitations: 'Эти материалы сами по себе не доказывают библейское событие Исхода независимо от Писания и не устанавливают каждую стоянку пути.',
  }),
  'gath-philistine-context': Object.freeze({
    statement: 'Телль-эс-Сафи (Геф) представляет крупный раскопанный филистимский городской центр, значимый для исторической географии эпохи Судей.',
    limitations: 'Археологический контекст города не является прямой верификацией каждого отдельного повествовательного эпизода, связанного с Гефом.',
  }),
  'hebron-tell-rumeida': Object.freeze({
    statement: 'Телль-Румейда сохраняет древний городской холм, связываемый с Хевроном, а более поздний монументальный комплекс отмечает традиционное место пещеры Махпела.',
    limitations: 'Многовековая традиция вокруг Махпелы не тождественна прямому археологическому вскрытию погребений патриархов.',
  }),
  'jericho-archaeology-disputed': Object.freeze({
    statement: 'Телль-эс-Султан надёжно отождествляется с древним Иерихоном, тогда как соотношение слоёв разрушения, абсолютной хронологии и библейского завоевания остаётся предметом научных споров.',
    limitations: 'Датировка слоёв разрушения остаётся дискуссионной; карта фиксирует данные раскопок и конвенциональную хронологию, не выдавая одну из реконструкций за окончательно решённый синхронизм.',
  }),
  'jerusalem-first-temple-context': Object.freeze({
    statement: 'Раскопки на участке Гивати и ассирийские источники документируют историю Иерусалима и Иудеи в эпоху Первого Храма и столкновений с империями.',
    limitations: 'Отдельные строительные фазы требуют датировки по первичным отчётам и не могут приписываться конкретным библейским лицам без прямых свидетельств.',
  }),
  'jesus-ministry-context': Object.freeze({
    statement: 'Материалы раскопок и музейных коллекций из Капернаума, Магдалы, Силоама и Иерусалима воссоздают материальную географию земного служения Иисуса Христа.',
    limitations: 'Материально-исторический контекст мест не равнозначен археологическому удостоверению каждого отдельного евангельского чуда или речения.',
  }),
  'maccabean-context': Object.freeze({
    statement: 'Иерусалимские памятники, стела Гелиодора и современные раскопки освещают эпоху Маккавеев, тогда как предлагаемые локализации Фамнафы и гробниц Маккавеев сохраняют статус кандидатов.',
    limitations: 'Отождествления Фамнафы и Хорват ха-Гарди остаются рабочими гипотезами и не должны подаваться категоричнее, чем позволяют отчёты раскопок.',
  }),
  'mari-amorite-context': Object.freeze({
    statement: 'Дворец, клинописные архивы и раскопки Мари раскрывают городскую, административную и племенную среду начала II тысячелетия до Р. Х., важную для сравнительного изучения эпохи патриархов.',
    limitations: 'Сравнительно-исторический контекст Мари не является доказательством того, что Авраам лично посещал этот город.',
  }),
  'no-personal-abraham-artefact': Object.freeze({
    statement: 'Ни один из учтённых в реестре источников не фиксирует личного предмета, дома, жертвенника или надписи, непосредственно принадлежавших Аврааму.',
    limitations: 'Карта вправе показывать историческую среду эпохи и ландшафт, но не вымышленные «прямые археологические доказательства» биографии патриарха.',
  }),
  'persian-return-context': Object.freeze({
    statement: 'Цилиндр Кира и арамейские папирусы Элефантины освещают имперскую политику Ахеменидов и общинную жизнь иудеев в эпоху возвращения из плена.',
    limitations: 'Цилиндр Кира не упоминает Иудею напрямую, а документы Элефантины отражают жизнь особой общины диаспоры в Египте.',
  }),
  'qeiyafa-davidic-context': Object.freeze({
    statement: 'Хирбет-Кейафа свидетельствует об укреплённом поселении раннего железного века в Шефеле, значимом для дискуссий о масштабе и устройстве раннего Иудейского царства.',
    limitations: 'Политическая принадлежность памятника и его прямая связь с царём Давидом остаются предметом научной дискуссии; стела Меши относится к более позднему периоду истории царств.',
  }),
  'shechem-tell-balata': Object.freeze({
    statement: 'Телль-Балата служит на карте основной археологической локализацией древнего Сихема.',
    limitations: 'Дубрава Море и жертвенник Авраама не являются точечно зафиксированными археологическими объектами.',
  }),
  'sodom-southern-basin-candidate': Object.freeze({
    statement: 'Баб-эд-Дра и Нумейра рассматриваются в консервативном / YEC-слое карты как южнокотловинные кандидаты для городов Сиддимской долины.',
    limitations: 'Статус кандидата не означает доказанного отождествления; более сильные формулировки недопустимы без опоры на первичные отчёты раскопок.',
  }),
  'tall-el-hammam-airburst-rejected': Object.freeze({
    statement: 'Отозванная статья о «космическом воздушном взрыве» над Телль-эль-Хаммамом не принимается в качестве положительного аргумента при датировке разрушения или отождествлении Содома.',
    limitations: 'Сам памятник может обсуждаться в рамках полевой археологии, однако отозванный вывод о воздушном взрыве нельзя подавать как установленный научный факт.',
  }),
  'ur-ancient-city-context': Object.freeze({
    statement: 'Телль-эль-Мукайяр надёжно отождествляется с древним Уром и задаёт месопотамский городской контекст на карте.',
    limitations: 'Раскопки Ура раскрывают облик древнего города, но не выделяют личного дома или предмета, принадлежавшего Аврааму.',
  }),
});

export function buildMapArchaeologyProjection(mapId, registry, provenance) {
  if (!mapId || typeof mapId !== 'string') throw new Error('mapId is required');
  if (!registry || !Array.isArray(registry.sources) || !Array.isArray(registry.claims)) {
    throw new Error('invalid archaeology source registry');
  }
  if (!provenance || !provenance.records || typeof provenance.records !== 'object') {
    throw new Error('invalid archaeology provenance registry');
  }

  const sources = new Map(registry.sources.map((source) => [source.id, source]));
  const sourceMeta = {};
  const byPlace = {};
  const mapCards = [];
  const categories = (registry.runtimeCategories || []).filter((category) =>
    Array.isArray(category.mapScopes) && category.mapScopes.includes(mapId));
  const categoryClaimIds = new Set(categories.flatMap((category) => category.claimIds || []));

  function exposeSource(id) {
    if (sourceMeta[id]) return sourceMeta[id];
    const source = sources.get(id);
    const record = provenance.records[id];
    if (!source || !record) throw new Error(`missing source/provenance pair: ${id}`);
    sourceMeta[id] = Object.freeze({
      id,
      title: source.title,
      organization: source.organization,
      url: record.canonicalUrl || source.url || '',
      year: record.publicationYear,
      accessedAt: record.accessedAt || source.accessedAt || source.verifiedAt || null,
      status: source.status,
      verification: source.verification,
      evidenceUse: record.evidenceUse,
      perspective: record.perspective,
      workType: record.workType,
      review: record.review,
    });
    return sourceMeta[id];
  }

  const claims = registry.claims.filter((claim) => claim.map === mapId || categoryClaimIds.has(claim.id));
  for (const claim of claims) {
    const evidenceIds = unique(claim.evidenceSources);
    const interpretationIds = unique(claim.interpretationSources);
    const accepted = ACCEPTED_STATUSES.has(claim.status);

    const governedEvidence = evidenceIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      if (!source || !record) return false;
      if (source.status === 'retracted') return !accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse);
      if (source.status !== 'active' || source.verification !== 'verified') return false;
      return POSITIVE_EVIDENCE_USES.has(record.evidenceUse)
        || (!accepted && NEGATIVE_EVIDENCE_USES.has(record.evidenceUse));
    });

    const governedInterpretation = interpretationIds.filter((id) => {
      const source = sources.get(id);
      const record = provenance.records[id];
      return Boolean(source && record && source.status === 'active' && INTERPRETATION_USES.has(record.evidenceUse));
    });

    if (accepted && governedEvidence.length === 0) continue;
    if (claim.status === 'candidate' && governedEvidence.length === 0) continue;
    if (claim.status === 'project-interpretation' && governedInterpretation.length === 0) continue;

    unique([...governedEvidence, ...governedInterpretation]).forEach(exposeSource);
    const localized = READER_CLAIM_COPY_RU[claim.id] || null;
    const card = Object.freeze({
      claimId: claim.id,
      category: claim.category || null,
      status: claim.status,
      statement: localized?.statement || claim.statement,
      limitations: localized ? localized.limitations : (claim.limitations || ''),
      topics: Object.freeze(unique(claim.topics)),
      evidenceSourceIds: Object.freeze(governedEvidence),
      interpretationSourceIds: Object.freeze(governedInterpretation),
    });

    const places = unique(claim.places);
    if (places.length === 0) mapCards.push(card);
    for (const placeId of places) {
      if (!byPlace[placeId]) byPlace[placeId] = [];
      byPlace[placeId].push(card);
    }
  }

  for (const placeId of Object.keys(byPlace)) Object.freeze(byPlace[placeId]);
  return Object.freeze({
    schemaVersion: '1.1.0',
    mapId,
    runtimeCategoryIds: Object.freeze(categories.map((category) => category.id)),
    allowedTabs: Object.freeze(['arch', 'sci']),
    mapCards: Object.freeze(mapCards),
    byPlace: Object.freeze(byPlace),
    sourceMeta: Object.freeze(sourceMeta),
  });
}
