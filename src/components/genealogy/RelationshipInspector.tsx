import { memo, useEffect, useMemo, useRef } from 'react';
import type { Person, RuntimeGenealogyRelation } from './types';

interface RelationshipInspectorProps {
  relation: RuntimeGenealogyRelation | null;
  persons: Person[];
  onClose: () => void;
}

const AUTHORITY_LABELS: Record<string, string> = {
  'curated-v1-explicit-field': 'Курированная родственная связь',
  'curated-v1-children-index': 'Курированный индекс потомков',
  'curated-v1-reciprocal-spouse': 'Взаимно подтверждённая супружеская связь',
  'explicit-qualified-textual-annotation': 'Редакционно квалифицированная текстовая связь',
};

const SEQUENCE_LABELS: Record<string, string> = {
  matthew: 'Матфей',
  luke: 'Лука',
};

function relationLabel(relation: RuntimeGenealogyRelation) {
  if (relation.kind === 'legal-parent') return 'Юридическая родительская связь';
  if (relation.kind === 'spouse') return 'Супружеская связь';
  if (relation.role === 'mother') return 'Мать → ребёнок';
  if (relation.role === 'father') return 'Отец → ребёнок';
  return 'Родственная связь';
}

function evidenceLabel(relation: RuntimeGenealogyRelation) {
  const evidence = relation.evidence;
  if (evidence.refsStatus === 'relation-level-review-pending') {
    return 'Ссылки к самой связи ещё не проверены';
  }
  if (evidence.directScripture === true) return 'Редакторски проверено · прямой текст';
  if (evidence.directScripture === false) return 'Редакторски проверено · интерпретация';
  return 'Редакторский статус связи';
}

function RelationshipInspectorComponent({ relation, persons, onClose }: RelationshipInspectorProps) {
  const closeButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (relation) closeButton.current?.focus({ preventScroll: true });
  }, [relation?.id]);

  const byId = useMemo(() => new Map(persons.map(person => [person.id, person])), [persons]);
  if (!relation) return null;

  const from = byId.get(relation.from);
  const to = byId.get(relation.to);
  const evidence = relation.evidence;
  const isInterpretive = evidence.assertion === 'editorial-harmonization' || evidence.directScripture === false;
  const isPending = evidence.refsStatus === 'relation-level-review-pending';

  return (
    <aside
      className="genealogy-relation-details"
      data-genealogy-relation-details
      role="complementary"
      aria-label={`Основание связи: ${from?.name.ru ?? relation.from} — ${to?.name.ru ?? relation.to}`}
    >
      <button
        ref={closeButton}
        type="button"
        className="genealogy-relation-close"
        onClick={onClose}
        aria-label="Закрыть сведения о связи"
      >×</button>

      <p className="genealogy-relation-eyebrow">Почему проведена эта линия?</p>
      <h3>{from?.name.ru ?? relation.from} → {to?.name.ru ?? relation.to}</h3>
      <p className="genealogy-relation-kind">{relationLabel(relation)}</p>

      <div className="genealogy-relation-badges">
        <span data-relation-status={isPending ? 'pending' : isInterpretive ? 'interpretive' : 'reviewed'}>
          {evidenceLabel(relation)}
        </span>
        {evidence.confidence && <span>Уверенность: {evidence.confidence}</span>}
      </div>

      <section>
        <h4>Основание модели</h4>
        <p>{AUTHORITY_LABELS[relation.authority] ?? relation.authority}</p>
        {isPending && (
          <p className="genealogy-relation-caution">
            Эта связь входит в курированную схему, но конкретные стихи к самому ребру ещё не прошли relation-level редакционную проверку.
          </p>
        )}
        {evidence.assertion === 'editorial-harmonization' && (
          <p className="genealogy-relation-warning">
            Это гармонизационная реконструкция проекта, а не прямое утверждение библейского текста.
          </p>
        )}
        {relation.kind === 'legal-parent' && evidence.biology === 'non-biological' && (
          <p className="genealogy-relation-caution">
            Связь квалифицирована как юридическая / небиологическая.
          </p>
        )}
      </section>

      {evidence.refs.length > 0 && (
        <section>
          <h4>Проверенные ссылки</h4>
          <ul>
            {evidence.refs.map(ref => <li key={ref}>{ref}</li>)}
          </ul>
        </section>
      )}

      {relation.textualAssertions.length > 0 && (
        <section>
          <h4>Рядом в тексте родословия</h4>
          <ul>
            {relation.textualAssertions.map(assertion => (
              <li key={assertion.id}>
                <strong>{SEQUENCE_LABELS[assertion.sequenceId] ?? assertion.sequenceId}</strong>
                {' · '}
                {assertion.fromRef === assertion.toRef
                  ? assertion.fromRef
                  : `${assertion.fromRef ?? '—'} → ${assertion.toRef ?? '—'}`}
              </li>
            ))}
          </ul>
          <p className="genealogy-relation-footnote">
            Текстовое соседство само по себе не превращается в биологическое или юридическое родство.
          </p>
        </section>
      )}

      {relation.note && (
        <section>
          <h4>Редакционная пометка</h4>
          <p>{relation.note}</p>
        </section>
      )}
    </aside>
  );
}

export const RelationshipInspector = memo(RelationshipInspectorComponent);
