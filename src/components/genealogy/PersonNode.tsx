import { getLineStyle, ERA_META, NODE_W, NODE_H, MAX_LIFESPAN } from './theme';

export function PersonCardContent({ data }: { data: any }) {
  const ls = getLineStyle(data.lineage);
  const lifespan = data.chronology?.mt?.lifespan;
  const birthAM = data.chronology?.mt?.birthAM;
  const era = data.era ? ERA_META[data.era as keyof typeof ERA_META] : null;
  const lifeBarW = lifespan ? Math.min(100, (lifespan / MAX_LIFESPAN) * 100) : 0;
  const isMessiah = data.role === 'messiah';

  // Dimmed = not in focus lineage (when someone is selected)
  const dimmed = data.dimmed === true;
  // Focused = in the focus lineage (highlighted path)
  const focused = data.focused === true;

  const opacity = dimmed ? 0.25 : 1;
  const filter = dimmed ? 'grayscale(0.8)' : 'none';

  // Focused nodes get stronger border + glow
  const borderColor = data.golden ? '#d4a857' : (focused ? '#9fc1b3' : ls.border);
  const borderWidth = focused ? '2px' : '1.5px';
  const boxShadow = focused
    ? `0 0 10px ${data.golden ? 'rgba(212,168,87,0.2)' : 'rgba(159,193,179,0.15)'}`
    : data.golden
      ? 'var(--genealogy-node-shadow-gold)'
      : 'var(--genealogy-node-shadow)';

  return (
    <div
      className="genealogy-node"
      style={{
        background: `linear-gradient(135deg, ${ls.bg}, var(--genealogy-node-base))`,
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: '10px',
        padding: '7px 11px 8px',
        width: `${NODE_W}px`,
        height: `${NODE_H}px`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: '"Lora", Georgia, serif',
        cursor: 'pointer',
        boxShadow,
        backdropFilter: 'blur(3px)',
        position: 'relative',
        overflow: 'hidden',
        opacity,
        filter,
        transition: 'var(--genealogy-person-transition, opacity .3s ease, filter .3s ease, box-shadow .3s ease, border-color .3s ease, transform .15s ease)',
        transform: data.highlighted ? 'scale(1.08)' : 'scale(1)',
        zIndex: focused ? 100 : 1,
      }}
    >
      {era && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: era.color, opacity: 0.7 }} />
      )}
      {data.disputed && (
        <div
          style={{ position: 'absolute', top: '-7px', right: '-7px', background: '#c0392b', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
          title="Спорное место — нажмите для подробностей"
        >?</div>
      )}
      <div style={{
        color: isMessiah ? 'var(--genealogy-messiah-text)' : 'var(--genealogy-node-text)',
        fontSize: isMessiah ? '16px' : '14px',
        fontWeight: 700, lineHeight: 1.15,
        textShadow: isMessiah ? '0 0 8px var(--genealogy-messiah-glow)' : 'none',
      }}>
        {data.name}
      </div>
      {data.hebrew && (
        <div style={{ color: ls.border, fontSize: '11px', direction: 'rtl', marginTop: '1px', opacity: 0.8 }}>{data.hebrew}</div>
      )}
      {data.birthName && (
        <div style={{ color: 'var(--genealogy-muted)', fontSize: '9px', marginTop: '1px' }}>рожд. {data.birthName}</div>
      )}
      {lifespan != null && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ height: '3px', borderRadius: '2px', overflow: 'hidden', background: 'var(--genealogy-life-track)' }}>
            <div style={{
              height: '100%', width: `${lifeBarW}%`,
              background: data.golden
                ? 'linear-gradient(90deg, #d4a857, #e6cc91)'
                : `linear-gradient(90deg, ${ls.fill}aa, ${ls.fill}66)`,
              borderRadius: '2px',
            }} />
          </div>
          <div style={{ color: 'var(--genealogy-muted)', fontSize: '8.5px', marginTop: '2px' }}>
            {lifespan} лет{birthAM != null ? ` · AM ${birthAM}` : ''}
          </div>
        </div>
      )}
      {isMessiah && (
        <div style={{
          position: 'absolute', inset: '-5px', borderRadius: '14px',
          border: '2px solid var(--genealogy-messiah-ring)', boxShadow: '0 0 28px var(--genealogy-messiah-glow)',
          pointerEvents: 'none', animation: 'var(--genealogy-messiah-animation, genealogy-pulse-gold 2.5s ease-in-out infinite)',
        }} />
      )}
    </div>
  );
}

/** A screen-sized label at overview/branch scales, sharing the real world center. */
export function CompactPersonCard({ data, overview }: { data: any; overview: boolean }) {
  return (
    <div className="genealogy-node genealogy-compact-card" style={{
      width: 144, height: 44, boxSizing: 'border-box',
      borderColor: data.golden ? '#d4a857' : '#867762',
      opacity: data.dimmed ? 0.3 : 1,
    }}>
      <strong>{data.name}</strong>
      {overview && <span>Открыть ветвь</span>}
    </div>
  );
}
