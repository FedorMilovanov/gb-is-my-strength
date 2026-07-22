import registryData from '../../data/nagornaya/source-registry.json';

export type NagornayaClaimLayer =
  | 'textual-observation'
  | 'historical-reconstruction'
  | 'literary-model'
  | 'doctrinal-synthesis'
  | 'pastoral-application';

export type NagornayaClaimConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'confessional'
  | 'unsupported';

export interface NagornayaEvidenceItem {
  id: string;
  author?: string;
  title: string;
  publication?: string;
  exactObject?: string;
  pages?: string;
  note?: string;
}

export interface NagornayaClaimProjection {
  id: string;
  claim: string;
  layer: NagornayaClaimLayer;
  primaryEvidence: NagornayaEvidenceItem[];
  alternative: string;
  limits: string;
  seriesPosition: string;
  confidence: NagornayaClaimConfidence;
  changeCondition: string;
  attributionLevel: 'text' | 'author' | 'tradition' | 'institution' | 'series';
}

interface RegistrySource {
  id: string;
  author: string;
  title: string;
  publication: string;
  exactObject: string;
  pages: string;
  annotation?: string;
}

interface RegistryClaim {
  id: string;
  claim: string;
  layer: NagornayaClaimLayer;
  primaryEvidence: string[];
  alternative: string;
  seriesPosition: string;
  confidence: NagornayaClaimConfidence;
  changeCondition: string;
  attributionLevel: NagornayaClaimProjection['attributionLevel'];
}

interface RegistryShape {
  sources: RegistrySource[];
  claims: RegistryClaim[];
}

type ClaimPresentation = Pick<
  NagornayaClaimProjection,
  'claim' | 'alternative' | 'seriesPosition' | 'changeCondition'
>;

const registry = registryData as RegistryShape;

const claimPresentationRu: Record<string, ClaimPresentation> = {
  'green-ipsissima-vox-model': {
    claim:
      'Дональд Грин защищает ограниченное употребление модели ipsissima vox в рамках богодухновенности и обещанного апостолам напоминания в Ин 14:26.',
    alternative:
      'Более широкая модель ipsissima vox допускает свободнее передавать смысл слов Иисуса без близкого словесного соответствия.',
    seriesPosition:
      'Серия принимает более узкую модель Грина, но ясно отмечает: обе позиции являются литературно-богословскими моделями, а не непосредственными наблюдениями над текстом.',
    changeCondition:
      'Вывод следует пересмотреть, если точная статья или более сильное первичное свидетельство покажет, что аргумент Грина либо альтернативная модель представлены неточно.',
  },
  'thomas-jesus-seminar-critique': {
    claim:
      'Роберт Томас критикует Jesus Seminar и связанные с ним историко-критические реконструкции евангельской традиции.',
    alternative:
      'Историко-критические реконструкции могут придавать больший объяснительный вес традиции общины и редакционному развитию материала.',
    seriesPosition:
      'Серия цитирует критику конкретного автора — Роберта Томаса — и не использует её как автоматическое доказательство всех последующих доктринальных или институциональных выводов.',
    changeCondition:
      'Вывод следует пересмотреть, если точная статья не подтверждает заявленный масштаб критики Томаса.',
  },
};

const layerLimits: Record<NagornayaClaimLayer, string> = {
  'textual-observation':
    'Наблюдение описывает явные данные текста, но само по себе ещё не выбирает историческую или богословскую модель.',
  'historical-reconstruction':
    'Реконструкция объясняет доступные данные, но не превращается в непосредственно наблюдаемый факт только потому, что согласуется с ними.',
  'literary-model':
    'Литературная модель различает форму, смысл и авторское намерение; она не доказывает автоматически ни современную стенографичность, ни свободное изобретение содержания.',
  'doctrinal-synthesis':
    'Доктринальный вывод должен опираться на более широкий канонический аргумент и не приписываться учреждению без отдельного официального источника.',
  'pastoral-application':
    'Пастырское применение предупреждает и утешает, но не даёт внешнему наблюдателю всеведения о сердце и не заменяет окончательный суд Христа.',
};

export const nagornayaLayerLabels: Record<NagornayaClaimLayer, string> = {
  'textual-observation': 'Наблюдение текста',
  'historical-reconstruction': 'Историческая реконструкция',
  'literary-model': 'Литературная модель',
  'doctrinal-synthesis': 'Доктринальный синтез',
  'pastoral-application': 'Пастырское применение',
};

export const nagornayaConfidenceLabels: Record<NagornayaClaimConfidence, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Ограниченная',
  confessional: 'Конфессиональная позиция',
  unsupported: 'Не подтверждено',
};

export function getNagornayaClaimProjection(claimId: string): NagornayaClaimProjection {
  const claim = registry.claims.find((item) => item.id === claimId);
  if (!claim) {
    throw new Error(`Unknown Nagornaya claim: ${claimId}`);
  }

  const primaryEvidence = claim.primaryEvidence.map((sourceId) => {
    const source = registry.sources.find((item) => item.id === sourceId);
    if (!source) {
      throw new Error(`Claim ${claimId} references unknown source: ${sourceId}`);
    }

    return {
      id: source.id,
      author: source.author,
      title: source.title,
      publication: source.publication,
      exactObject: source.exactObject,
      pages: source.pages,
      note: source.annotation,
    } satisfies NagornayaEvidenceItem;
  });

  const presentation = claimPresentationRu[claim.id] ?? claim;
  const attributionBoundary =
    claim.attributionLevel === 'author'
      ? 'Публикация подтверждает аргумент названного автора, но не автоматически официальную позицию журнала, семинарии или всей традиции.'
      : '';

  return {
    id: claim.id,
    claim: presentation.claim,
    layer: claim.layer,
    primaryEvidence,
    alternative: presentation.alternative,
    limits: [layerLimits[claim.layer], attributionBoundary].filter(Boolean).join(' '),
    seriesPosition: presentation.seriesPosition,
    confidence: claim.confidence,
    changeCondition: presentation.changeCondition,
    attributionLevel: claim.attributionLevel,
  };
}
