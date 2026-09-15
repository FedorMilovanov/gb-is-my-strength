/**
 * DetailPanel — slide-in sidebar showing full person info.
 *
 * Opens on node click. Shows: name (ru/he/alt), era/role/gender badges,
 * MT chronology, significance, disputed-node callout with BOTH apologetic
 * positions, and biblical reference.
 */

import { memo, useEffect, useRef } from 'react';
import type { Person, RuntimeGenealogyRelation } from './types';
import { getLineStyle, ERA_META, ROLE_LABELS } from './theme';

interface DetailPanelProps {
  person: Person | null;
  relations?: RuntimeGenealogyRelation[];
  persons?: Person[];
  onInspectRelation?: (relation: RuntimeGenealogyRelation) => void;
  onNavigatePerson?: (personId: string) => void;
  onClose: () => void;
}

function relationshipKindLabel(relation: RuntimeGenealogyRelation, currentId: string) {
  if (relation.kind === 'legal-parent') return currentId === relation.from
    ? 'Юридический родитель'
    : 'Юридический ребёнок';
  if (relation.kind === 'spouse') return 'Супруги';
  if (relation.role === 'mother') return currentId === relation.from ? 'Мать' : 'Ребёнок';
  if (relation.role === 'father') return currentId === relation.from ? 'Отец' : 'Ребёнок';
  return 'Родственная связь';
}

function relationshipEvidenceLabel(relation: RuntimeGenealogyRelation) {
  if (relation.evidence.refsStatus === 'relation-level-review-pending') return 'ссылки проверяются';
  if (relation.evidence.directScripture === true) return 'прямой текст';
  if (relation.evidence.directScripture === false) return 'интерпретация';
  return 'редакторская связь';
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function DetailPanelComponent({ person, relations = [], persons = [], onInspectRelation, onNavigatePerson, onClose }: DetailPanelProps) {
  const panel = useRef<HTMLElement | null>(null);
  useEffect(() => { if (person) panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }, [person?.id]);
  if (!person) return null;

  const ls = getLineStyle(person.lineage);
  const era = person.era ? ERA_META[person.era] : null;
  const chron = person.chronology?.mt;
  const roleLabel = person.role ? ROLE_LABELS[person.role] : undefined;
  const personById = new Map(persons.map(item => [item.id, item]));
  const personRelations = relations
    .filter(relation => relation.from === person.id || relation.to === person.id)
    .sort((a, b) =>
      compareText(a.kind, b.kind) ||
      compareText(a.role ?? '', b.role ?? '') ||
      compareText(a.from === person.id ? a.to : a.from, b.from === person.id ? b.to : b.from)
    );

  const familyGroups = [
    {
      id: 'parents',
      label: 'Родители',
      members: [
        person.father ? { id: person.father, relation: 'Отец' } : null,
        person.mother ? { id: person.mother, relation: 'Мать' } : null,
      ].filter((member): member is { id: string; relation: string } => Boolean(member)),
    },
    {
      id: 'spouses',
      label: 'Супруги',
      members: [...(person.spouse ?? [])]
        .sort(compareText)
        .map(id => ({ id, relation: 'Супруги' })),
    },
    {
      id: 'children',
      label: 'Дети',
      members: [...(person.children ?? [])]
        .sort(compareText)
        .map(id => ({
          id,
          relation: personById.get(id)?.gender === 'f' ? 'Дочь' : 'Сын',
        })),
    },
  ].map(group => ({
    ...group,
    members: group.members
      .map(member => ({ ...member, person: personById.get(member.id) }))
      .filter((member): member is { id: string; relation: string; person: Person } => Boolean(member.person)),
  })).filter(group => group.members.length > 0);

  return (
    <aside
      ref={panel}
      className="genealogy-details"
      data-genealogy-details
      role="complementary"
      aria-label={`Детали: ${person.name.ru}`}
      style={{
        zIndex: 50,
        background: 'var(--genealogy-detail-bg)',
        backdropFilter: 'blur(20px)',
        borderLeft: `1px solid ${ls.border}40`,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        overflowY: 'auto', padding: '20px 22px',
        fontFamily: '"Lora", Georgia, serif',
        animation: 'var(--genealogy-panel-animation, genealogy-fade-in .2s ease-out)',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Закрыть панель"
        style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'var(--genealogy-soft-surface)', border: `1px solid ${ls.border}30`,
          borderRadius: '8px', color: 'var(--genealogy-muted)', fontSize: '18px',
          cursor: 'pointer', width: '44px', height: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {/* Name */}
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--genealogy-text)', lineHeight: 1.2, paddingRight: '52px' }}>
        {person.name.ru}
      </div>
      {person.name.he && (
        <div style={{ fontSize: '18px', color: ls.border, direction: 'rtl', marginTop: '2px' }}>
          {person.name.he}
        </div>
      )}
      {person.name.altName && (
        <div style={{ color: 'var(--genealogy-muted)', fontSize: '13px', marginTop: '3px' }}>
          также: {person.name.altName}
        </div>
      )}

      {/* Badges */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
        {era && (
          <span style={{
            fontSize: '10px', padding: '3px 9px', borderRadius: '999px',
            background: `${era.color}25`, color: era.color, border: `1px solid ${era.color}40`,
          }}>{era.label}</span>
        )}
        {roleLabel && (
          <span style={{
            fontSize: '10px', padding: '3px 9px', borderRadius: '999px',
            background: `${ls.border}18`, color: 'var(--genealogy-text)', border: `1px solid ${ls.border}30`,
          }}>{roleLabel}</span>
        )}
        {person.gender === 'f' && (
          <span style={{
            fontSize: '10px', padding: '3px 9px', borderRadius: '999px',
            background: 'rgba(200,100,140,0.1)', color: '#d4889a', border: '1px solid rgba(200,100,140,0.2)',
          }}>Женщина</span>
        )}
      </div>

      {/* Chronology */}
      {chron && (
        <div style={{
          marginTop: '14px', padding: '12px 14px',
          background: 'rgba(212,168,87,0.05)', borderRadius: '10px',
          border: `1px solid ${ls.border}20`,
        }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--genealogy-muted)', marginBottom: '6px' }}>
            Хронология (MT)
          </div>
          {chron.ageAtSon != null && <div style={{ color: 'var(--genealogy-muted)', fontSize: '13px', marginBottom: '3px' }}>Сын родился в <b style={{ color: 'var(--genealogy-text)' }}>{chron.ageAtSon}</b> лет</div>}
          {chron.lifespan != null && <div style={{ color: 'var(--genealogy-muted)', fontSize: '13px', marginBottom: '3px' }}>Прожил <b style={{ color: 'var(--genealogy-text)' }}>{chron.lifespan}</b> лет</div>}
          {chron.birthAM != null && <div style={{ color: 'var(--genealogy-muted)', fontSize: '13px' }}>Рождение: <b style={{ color: 'var(--genealogy-text)' }}>AM {chron.birthAM}</b></div>}
          {chron.deathAM != null && <div style={{ color: 'var(--genealogy-muted)', fontSize: '13px' }}>Смерть: <b style={{ color: 'var(--genealogy-text)' }}>AM {chron.deathAM}</b></div>}
        </div>
      )}

      {/* Significance */}
      {person.significance && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--genealogy-muted)', marginBottom: '6px' }}>Значение</div>
          <p style={{ color: 'var(--genealogy-section-text)', fontSize: '13.5px', lineHeight: 1.55, margin: 0 }}>{person.significance}</p>
        </div>
      )}

      {/* Disputed callout */}
      {person.disputed && (
        <div style={{
          marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--genealogy-disputed-text)', marginBottom: '8px' }}>
            ⚠ Спорное место ({({ textual: 'текстология', genealogical: 'родственные связи', theological: 'толкование' })[person.disputed.level]})
          </div>
          {person.disputed.positions.map((pos, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={{ color: 'var(--genealogy-section-text)', fontSize: '12.5px', lineHeight: 1.4 }}>• {pos.view}</div>
              <div style={{ color: 'var(--genealogy-muted)', fontSize: '10.5px', marginTop: '1px' }}>{pos.proponents}</div>
            </div>
          ))}
        </div>
      )}

      {familyGroups.length > 0 && (
        <section className="genealogy-family" aria-labelledby="genealogy-family-title">
          <div id="genealogy-family-title" className="genealogy-family__title">Семья</div>
          <div className="genealogy-family__groups">
            {familyGroups.map(group => (
              <div key={group.id} className="genealogy-family__group">
                <div className="genealogy-family__group-label">{group.label}</div>
                <div className="genealogy-family__list">
                  {group.members.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      className="genealogy-family-person"
                      onClick={() => onNavigatePerson?.(member.id)}
                      aria-label={`Открыть человека: ${member.person.name.ru} — ${member.relation}`}
                    >
                      <span>{member.person.name.ru}</span>
                      <small>{member.relation}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {personRelations.length > 0 && (
        <section className="genealogy-person-relations" aria-labelledby="genealogy-person-relations-title">
          <div id="genealogy-person-relations-title" className="genealogy-person-relations__title">Связи</div>
          <div className="genealogy-person-relations__list">
            {personRelations.map(relation => {
              const peerId = relation.from === person.id ? relation.to : relation.from;
              const peerName = personById.get(peerId)?.name.ru ?? peerId;
              return (
                <button
                  key={relation.id}
                  type="button"
                  className="genealogy-person-relation"
                  onClick={() => onInspectRelation?.(relation)}
                  aria-label={`Открыть основание связи: ${person.name.ru} — ${peerName}`}
                >
                  <span className="genealogy-person-relation__main">
                    <strong>{relationshipKindLabel(relation, person.id)}</strong>
                    <span>{peerName}</span>
                  </span>
                  <span className="genealogy-person-relation__status">
                    {relationshipEvidenceLabel(relation)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Biblical reference */}
      {person.ref && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--genealogy-muted)', marginBottom: '4px' }}>Писание</div>
          <div style={{ color: ls.border, fontSize: '13px', fontFamily: 'monospace' }}>{person.ref}</div>
        </div>
      )}
    </aside>
  );
}

export const DetailPanel = memo(DetailPanelComponent);
