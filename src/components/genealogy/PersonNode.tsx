import { getLineStyle, ERA_META, NODE_W, MAX_LIFESPAN } from './theme';

export function PersonCardContent({ data }: { data: any }) {
  const ls = getLineStyle(data.lineage);
  const lifespan = data.chronology?.mt?.lifespan;
  const birthAM = data.chronology?.mt?.birthAM;
  const era = data.era ? ERA_META[data.era as keyof typeof ERA_META] : null;
  const lifeBarW = lifespan ? Math.min(100, (lifespan / MAX_LIFESPAN) * 100) : 0;
  const isMessiah = data.role === 'messiah';
  return (
    <div className="genealogy-node" style={{ background: `linear-gradient(135deg, ${ls.bg}, rgba(13,10,6,0.6))`, border: `1.5px solid ${data.golden ? '#ffd700' : ls.border}`, borderRadius: '10px', padding: '7px 11px 8px', width: `${NODE_W - 4}px`, textAlign: 'center', fontFamily: '"Lora", Georgia, serif', cursor: 'pointer', boxShadow: data.golden ? `0 0 14px ${ls.glow}, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 10px rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)', position: 'relative', overflow: 'hidden' }}>
      {era && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: era.color, opacity: 0.7 }} />}
      {data.disputed && <div style={{ position: 'absolute', top: '-7px', right: '-7px', background: '#c0392b', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }} title="Спорное место">?</div>}
      <div style={{ color: isMessiah ? '#ffd700' : ls.text, fontSize: isMessiah ? '15px' : '13px', fontWeight: 700, lineHeight: 1.15, textShadow: isMessiah ? '0 0 8px rgba(255,215,0,0.4)' : 'none' }}>{data.name}</div>
      {data.hebrew && <div style={{ color: ls.border, fontSize: '11px', direction: 'rtl', marginTop: '1px', opacity: 0.8 }}>{data.hebrew}</div>}
      {data.birthName && <div style={{ color: 'rgba(200,184,154,0.45)', fontSize: '9px', marginTop: '1px' }}>рожд. {data.birthName}</div>}
      {lifespan != null && (<div style={{ marginTop: '4px' }}><div style={{ height: '3px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}><div style={{ height: '100%', width: `${lifeBarW}%`, background: data.golden ? 'linear-gradient(90deg, #ffd700, #ffe87a)' : `linear-gradient(90deg, ${ls.fill}aa, ${ls.fill}66)`, borderRadius: '2px' }} /></div><div style={{ color: 'rgba(200,184,154,0.5)', fontSize: '8.5px', marginTop: '2px' }}>{lifespan} лет{birthAM != null ? ` · AM ${birthAM}` : ''}</div></div>)}
      {isMessiah && <div style={{ position: 'absolute', inset: '-5px', borderRadius: '14px', border: '2px solid rgba(255,215,0,0.6)', boxShadow: '0 0 28px rgba(255,215,0,0.5)', pointerEvents: 'none', animation: 'genealogy-pulse-gold 2.5s ease-in-out infinite' }} />}
    </div>
  );
}
