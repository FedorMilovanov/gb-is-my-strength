/**
 * PersonNode — the React Flow custom node for a biblical person.
 *
 * Renders a premium parchment card with: era top-stripe, name (ru + hebrew),
 * optional birth/alt name, a life-bar proportional to lifespan (max = Methuselah
 * 969 years), AM-year, disputed-node marker, and messiah gold-pulse ring.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { PersonNodeData } from './types';
import { getLineStyle, ERA_META, NODE_W, MAX_LIFESPAN } from './theme';

function PersonNodeComponent({ data }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const ls = getLineStyle(d.lineage);
  const lifespan = d.chronology?.mt?.lifespan;
  const birthAM = d.chronology?.mt?.birthAM;
  const era = d.era ? ERA_META[d.era] : null;
  const lifeBarW = lifespan ? Math.min(100, (lifespan / MAX_LIFESPAN) * 100) : 0;
  const isMessiah = d.role === 'messiah';

  return (
    <div
      className="genealogy-node"
      style={{
        background: `linear-gradient(135deg, ${ls.bg}, rgba(13,10,6,0.6))`,
        border: `1.5px solid ${d.golden ? '#ffd700' : ls.border}`,
        borderRadius: '10px',
        padding: '7px 11px 8px',
        width: `${NODE_W - 4}px`,
        textAlign: 'center',
        fontFamily: '"Lora", Georgia, serif',
        cursor: 'pointer',
        transition: 'box-shadow .2s, border-color .2s',
        boxShadow: d.golden
          ? `0 0 14px ${ls.glow}, 0 2px 8px rgba(0,0,0,0.4)`
          : '0 2px 10px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(3px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Era top-stripe */}
      {era && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: era.color, opacity: 0.7,
          }}
        />
      )}

      {/* Disputed marker */}
      {d.disputed && (
        <div
          style={{
            position: 'absolute', top: '-7px', right: '-7px',
            background: '#c0392b', color: '#fff', borderRadius: '50%',
            width: '16px', height: '16px', fontSize: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
          title="Спорное место — нажмите для подробностей"
          aria-label="Спорное место"
        >?</div>
      )}

      {/* Name */}
      <div
        style={{
          color: isMessiah ? '#ffd700' : ls.text,
          fontSize: isMessiah ? '15px' : '13px',
          fontWeight: 700, lineHeight: 1.15,
          textShadow: isMessiah ? '0 0 8px rgba(255,215,0,0.4)' : 'none',
        }}
      >
        {d.name}
      </div>

      {/* Hebrew */}
      {d.hebrew && (
        <div style={{ color: ls.border, fontSize: '11px', direction: 'rtl', marginTop: '1px', opacity: 0.8 }}>
          {d.hebrew}
        </div>
      )}

      {/* Birth name */}
      {d.birthName && (
        <div style={{ color: 'rgba(200,184,154,0.45)', fontSize: '9px', marginTop: '1px' }}>
          рожд. {d.birthName}
        </div>
      )}

      {/* Life bar */}
      {lifespan != null && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ height: '3px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            <div
              style={{
                height: '100%', width: `${lifeBarW}%`,
                background: d.golden
                  ? 'linear-gradient(90deg, #ffd700, #ffe87a)'
                  : `linear-gradient(90deg, ${ls.fill}aa, ${ls.fill}66)`,
                borderRadius: '2px',
              }}
            />
          </div>
          <div style={{ color: 'rgba(200,184,154,0.5)', fontSize: '8.5px', marginTop: '2px' }}>
            {lifespan} лет{birthAM != null ? ` · AM ${birthAM}` : ''}
          </div>
        </div>
      )}

      {/* Messiah glow ring */}
      {isMessiah && (
        <div
          style={{
            position: 'absolute', inset: '-5px',
            borderRadius: '14px', border: '2px solid rgba(255,215,0,0.6)',
            boxShadow: '0 0 28px rgba(255,215,0,0.5)',
            pointerEvents: 'none', animation: 'genealogy-pulse-gold 2.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
