/**
 * DetailPanel — slide-in sidebar showing full person info.
 *
 * Opens on node click. Shows: name (ru/he/alt), era/role/gender badges,
 * MT chronology, significance, disputed-node callout with BOTH apologetic
 * positions, and biblical reference.
 */

import { memo } from 'react';
import type { Person } from './types';
import { getLineStyle, ERA_META, ROLE_LABELS } from './theme';

interface DetailPanelProps {
  person: Person | null;
  onClose: () => void;
}

function DetailPanelComponent({ person, onClose }: DetailPanelProps) {
  if (!person) return null;

  const ls = getLineStyle(person.lineage);
  const era = person.era ? ERA_META[person.era] : null;
  const chron = person.chronology?.mt;
  const roleLabel = person.role ? ROLE_LABELS[person.role] : undefined;

  return (
    <aside
      role="complementary"
      aria-label={`Детали: ${person.name.ru}`}
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 'min(380px, 100vw)', zIndex: 50,
        background: 'linear-gradient(180deg, rgba(20,16,10,0.97), rgba(10,8,5,0.98))',
        backdropFilter: 'blur(20px)',
        borderLeft: `1px solid ${ls.border}40`,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        overflowY: 'auto', padding: '20px 22px',
        fontFamily: '"Lora", Georgia, serif',
        animation: 'genealogy-slide-in-right .25s ease-out',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Закрыть панель"
        style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${ls.border}30`,
          borderRadius: '8px', color: '#c8b89a', fontSize: '18px',
          cursor: 'pointer', width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {/* Name */}
      <div style={{ fontSize: '22px', fontWeight: 700, color: ls.text, lineHeight: 1.2, paddingRight: '32px' }}>
        {person.name.ru}
      </div>
      {person.name.he && (
        <div style={{ fontSize: '18px', color: ls.border, direction: 'rtl', marginTop: '2px' }}>
          {person.name.he}
        </div>
      )}
      {person.name.altName && (
        <div style={{ color: 'rgba(200,184,154,0.5)', fontSize: '13px', marginTop: '3px' }}>
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
            background: `${ls.border}18`, color: ls.text, border: `1px solid ${ls.border}30`,
          }}>{roleLabel}</span>
        )}
        {person.gender === 'f' && (
          <span style={{
            fontSize: '10px', padding: '3px 9px', borderRadius: '999px',
            background: 'rgba(200,100,140,0.1)', color: '#d4889a', border: '1px solid rgba(200,100,140,0.2)',
          }}>жена/мать</span>
        )}
      </div>

      {/* Chronology */}
      {chron && (
        <div style={{
          marginTop: '14px', padding: '12px 14px',
          background: 'rgba(212,168,87,0.05)', borderRadius: '10px',
          border: `1px solid ${ls.border}20`,
        }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.4)', marginBottom: '6px' }}>
            Хронология (MT)
          </div>
          {chron.ageAtSon != null && <div style={{ color: '#c8b89a', fontSize: '13px', marginBottom: '3px' }}>Сын родился в <b style={{ color: ls.text }}>{chron.ageAtSon}</b> лет</div>}
          {chron.lifespan != null && <div style={{ color: '#c8b89a', fontSize: '13px', marginBottom: '3px' }}>Прожил <b style={{ color: ls.text }}>{chron.lifespan}</b> лет</div>}
          {chron.birthAM != null && <div style={{ color: '#c8b89a', fontSize: '13px' }}>Рождение: <b style={{ color: ls.text }}>AM {chron.birthAM}</b></div>}
          {chron.deathAM != null && <div style={{ color: '#c8b89a', fontSize: '13px' }}>Смерть: <b style={{ color: ls.text }}>AM {chron.deathAM}</b></div>}
        </div>
      )}

      {/* Significance */}
      {person.significance && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.4)', marginBottom: '6px' }}>Значение</div>
          <p style={{ color: '#d8c8a8', fontSize: '13.5px', lineHeight: 1.55, margin: 0 }}>{person.significance}</p>
        </div>
      )}

      {/* Disputed callout */}
      {person.disputed && (
        <div style={{
          marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#e87060', marginBottom: '8px' }}>
            ⚠ Спорное место ({person.disputed.level})
          </div>
          {person.disputed.positions.map((pos, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={{ color: '#d8c8a8', fontSize: '12.5px', lineHeight: 1.4 }}>• {pos.view}</div>
              <div style={{ color: 'rgba(200,184,154,0.45)', fontSize: '10.5px', marginTop: '1px' }}>{pos.proponents}</div>
            </div>
          ))}
        </div>
      )}

      {/* Biblical reference */}
      {person.ref && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.4)', marginBottom: '4px' }}>Писание</div>
          <div style={{ color: ls.border, fontSize: '13px', fontFamily: 'monospace' }}>{person.ref}</div>
        </div>
      )}
    </aside>
  );
}

export const DetailPanel = memo(DetailPanelComponent);
