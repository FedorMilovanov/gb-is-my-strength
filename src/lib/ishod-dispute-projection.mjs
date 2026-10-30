/**
 * Ishod dispute projection parser — единственный вход печатной/no-JS проекции
 * для rich-блока `place.dispute` маршрута Исхода.
 *
 * Зачем (GBS-ISHOD-STATIC-PROJECTION-RICH-BLOCK-FLATTENING): проектор раньше
 * превращал каждый тег в пробел и складывал весь dispute в один `<p>`, стирая
 * границы title / позиций / confidence / note. Парсер принимает только
 * явно-разрешённый authored subset и отдаёт типизированные блоки; каждый блок
 * проецируется отдельным семантическим элементом. Raw-инъекция route HTML
 * запрещена: любой незнакомый тег/класс/структура — отказ (fail-closed),
 * вызывающий скрывает поле через существующий withholding-механизм.
 *
 * Грамматика (строгая, по фактическим данным karty/ishod/route.json и
 * pihahiroth-authority.json):
 *
 *   dispute-block := <div class="dispute-block"> title pos+ note? </div>
 *   title := <div class="dispute-title"> текст </div>            (ровно один, первым)
 *   pos   := <div class="dispute-pos cons|alt">                  (≥1, далее)
 *            <b>метка</b>[ ':' деталь ][ <span class="conf-hi|med|lo">…</span>]
 *            </div>
 *   note  := <div class="dispute-note"> текст </div>             (0..1, последним)
 *
 * Любой другой тег, класс, вложенность или порядок — DisputeProjectionError.
 * Payload без единого `<div` считается inline-прозой и проецируется одним
 * абзацем (границ блоков нет — терять нечего).
 */

const NAMED_ENTITIES = new Map(Object.entries({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…',
}));

export class DisputeProjectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DisputeProjectionError';
  }
}

export function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const raw = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES.get(entity.toLowerCase()) ?? full;
  });
}

/** Текст без тегов — вызывать только после whitelist-валидации. */
function textOf(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const BLOCK_OPEN = '<div class="dispute-block">';
const CHILD_RE = /<div class="(dispute-title|dispute-pos cons|dispute-pos alt|dispute-note)">([\s\S]*?)<\/div>/g;
const CONF_SPAN_RE = /<span class="conf-(?:hi|med|lo)">([\s\S]*?)<\/span>$/;
const LABEL_RE = /^<b>([\s\S]*?)<\/b>/;

/** Inline-содержимое одного блока: валидирует whitelist и вынимает метку/confidence. */
function parseChild(kind, content) {
  let rest = content;
  let label = '';
  let confidence = '';

  if (kind.startsWith('dispute-pos')) {
    const labelMatch = rest.match(LABEL_RE);
    if (!labelMatch) throw new DisputeProjectionError(`${kind}: missing leading <b> label`);
    label = textOf(labelMatch[1]);
    if (!label) throw new DisputeProjectionError(`${kind}: empty label`);
    rest = rest.slice(labelMatch[0].length);
    const trimmedRest = rest.trimEnd();
    const confMatch = trimmedRest.match(CONF_SPAN_RE);
    if (confMatch) {
      confidence = textOf(confMatch[1]);
      rest = trimmedRest.slice(0, trimmedRest.length - confMatch[0].length);
    }
    rest = rest.replace(/^\s*:\s*/, '');
  } else {
    // title/note: разрешён только целый inline-набор b/i/em/strong.
    const stripped = rest.replace(/<\/?(?:b|i|em|strong)>/g, '');
    if (stripped.includes('<')) throw new DisputeProjectionError(`${kind}: tag outside the safe subset`);
    const text = textOf(rest);
    if (!text) throw new DisputeProjectionError(`${kind}: empty text`);
    return { text };
  }

  // Остаток (деталь позиции) обязан быть чистым текстом.
  if (rest.includes('<')) throw new DisputeProjectionError(`${kind}: tag outside the safe subset`);
  const detail = textOf(rest);
  return { label, detail, confidence };
}

/**
 * Разбирает payload dispute на типизированные блоки.
 * @returns {{mode:'structured', title:string, positions:Array<{kind:'cons'|'alt', label:string, detail:string, confidence:string}>, note:string}
 *         | {mode:'inline', text:string}}
 * @throws {DisputeProjectionError} — любой небезопасный/неизвестный markup.
 */
export function parseDisputeProjection(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new DisputeProjectionError('empty dispute payload');

  if (!raw.includes('<div')) {
    // Inline-проза без границ блоков: whitelist b/i/em/strong/span-conf.
    const probe = raw
      .replace(/<b>|<\/b>|<i>|<\/i>|<em>|<\/em>|<strong>|<\/strong>|<span class="conf-(?:hi|med|lo)">|<\/span>/g, '');
    if (probe.includes('<')) throw new DisputeProjectionError('inline dispute: tag outside the safe subset');
    const text = textOf(raw);
    if (!text) throw new DisputeProjectionError('inline dispute: empty after parsing');
    return { mode: 'inline', text };
  }

  if (!raw.startsWith(BLOCK_OPEN) || !raw.endsWith('</div>')) {
    throw new DisputeProjectionError('structured dispute must be a single dispute-block root');
  }
  const body = raw.slice(BLOCK_OPEN.length, raw.length - '</div>'.length);

  const children = [];
  let cursor = 0;
  CHILD_RE.lastIndex = 0;
  let match;
  while ((match = CHILD_RE.exec(body)) !== null) {
    if (body.slice(cursor, match.index).trim() !== '') {
      throw new DisputeProjectionError('content outside recognised dispute children');
    }
    children.push({ kind: match[1], content: match[2] });
    cursor = match.index + match[0].length;
  }
  if (children.length === 0) throw new DisputeProjectionError('dispute-block has no children');
  if (body.slice(cursor).trim() !== '') throw new DisputeProjectionError('trailing content inside dispute-block');

  const [first, ...restChildren] = children;
  if (first.kind !== 'dispute-title') throw new DisputeProjectionError('dispute-title must come first');
  const noteMatches = restChildren.filter((c) => c.kind === 'dispute-note');
  if (noteMatches.length > 1) throw new DisputeProjectionError('at most one dispute-note allowed');
  const positionsRaw = restChildren.filter((c) => c.kind.startsWith('dispute-pos'));
  if (positionsRaw.length === 0) throw new DisputeProjectionError('dispute needs at least one dispute-pos');
  if (noteMatches.length === 1 && restChildren[restChildren.length - 1].kind !== 'dispute-note') {
    throw new DisputeProjectionError('dispute-note must come last');
  }
  for (let i = 0; i < restChildren.length - noteMatches.length; i += 1) {
    if (!restChildren[i].kind.startsWith('dispute-pos')) {
      throw new DisputeProjectionError('only dispute-pos children may follow the title');
    }
  }

  const titleBlock = parseChild('dispute-title', first.content);
  const title = titleBlock.text;
  if (!title) throw new DisputeProjectionError('dispute-title is empty');

  const positions = positionsRaw.map((child) => {
    const parsed = parseChild(child.kind, child.content);
    return {
      kind: child.kind.endsWith('alt') ? 'alt' : 'cons',
      label: parsed.label,
      detail: parsed.detail ?? '',
      confidence: parsed.confidence ?? '',
    };
  });

  const note = noteMatches.length === 1 ? parseChild('dispute-note', noteMatches[0].content).text : '';
  return { mode: 'structured', title, positions, note };
}

/** Не-бросающая обёртка: null = отказ (небезопасно/неизвестно — не печатать). */
export function tryParseDisputeProjection(value) {
  try {
    return parseDisputeProjection(value);
  } catch {
    return null;
  }
}

/**
 * Смежные артефакты старого flatten-проектора: каждый встречается только когда
 * confidence-метка соседствует со словом соседнего блока в ОДНОМ тексте.
 * Используется контракт-аудитом как negative-матрица.
 */
export const FLATTENING_ARTIFACTS = Object.freeze([
  'Средняя Поздняя',
  'Средняя Позиция',
  'Средняя Кочевая',
  'Средняя Кочевники',
]);
