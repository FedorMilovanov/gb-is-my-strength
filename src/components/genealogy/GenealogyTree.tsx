import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  type Node, type Edge, type NodeTypes, MarkerType, ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';

// ── Lineage visual identity ──
const LINEAGE_STYLES: Record<string, { bg: string; border: string; text: string; glow: string; fill: string }> = {
  'messianic':             { bg: 'rgba(212,168,87,0.14)',  border: '#d4a857', text: '#f5e6c8', glow: 'rgba(212,168,87,0.45)', fill: '#d4a857' },
  'messianic-matthew':     { bg: 'rgba(184,134,61,0.12)',  border: '#c8923d', text: '#e8d5b0', glow: 'rgba(184,134,61,0.4)',  fill: '#c8923d' },
  'messianic-luke':        { bg: 'rgba(180,145,90,0.12)',  border: '#b8965a', text: '#e0d0b8', glow: 'rgba(180,145,90,0.4)',  fill: '#b8965a' },
  'messianic-fulfillment': { bg: 'rgba(255,215,0,0.18)',   border: '#ffd700', text: '#fff8e0', glow: 'rgba(255,215,0,0.65)', fill: '#ffd700' },
  'cainite':               { bg: 'rgba(150,60,60,0.10)',   border: '#9a4040', text: '#d4a0a0', glow: 'rgba(150,60,60,0.3)',  fill: '#9a4040' },
  'rejected':              { bg: 'rgba(100,100,100,0.06)', border: '#5a5a5a', text: '#999',    glow: 'none',                   fill: '#5a5a5a' },
  'neutral':               { bg: 'rgba(140,120,90,0.07)',  border: '#7a6a4e', text: '#b8a888', glow: 'none',                   fill: '#7a6a4e' },
};
const getLine = (l: string) => LINEAGE_STYLES[l] || LINEAGE_STYLES['neutral'];

const ERA_META: Record<string, { label: string; color: string }> = {
  creation:       { label: 'Сотворение',            color: '#8B6914' },
  antediluvian:   { label: 'Допотопный мир',        color: '#A0734A' },
  flood:          { label: 'Потоп',                 color: '#5A7A8C' },
  postdiluvian:   { label: 'Послепотопный мир',     color: '#6B8E4E' },
  patriarchs:     { label: 'Патриархи',             color: '#C4A04A' },
  kings:          { label: 'Царства',               color: '#B8743A' },
  exile:          { label: 'Плен и восстановление', color: '#8C6A4A' },
  incarnation:    { label: 'Воплощение',            color: '#D4A857' },
};

const NODE_W = 172;
const NODE_H = 72;

// ── Layout ──
function buildLayout(persons: any[], opts: { showGolden: boolean; showLineage: string }) {
  const filtered = opts.showLineage === 'all' ? persons
    : opts.showLineage === 'messianic' ? persons.filter(p => p.lineage.startsWith('messianic'))
    : persons.filter(p => p.lineage === opts.showLineage);
  const ids = new Set(filtered.map(p => p.id));

  const goldenPath = new Set<string>();
  const christ = persons.find(p => p.role === 'messiah');
  if (christ) {
    let cur: any = christ;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      goldenPath.add(cur.id); guard.add(cur.id);
      if (cur.id === 'jesus' && cur.mother) cur = persons.find(p => p.id === cur.mother);
      else cur = cur.father ? persons.find(p => p.id === cur.father) : null;
    }
  }

  const hasAM = filtered.filter(p => p.chronology?.mt?.birthAM != null);
  let amMin = Infinity, amMax = -Infinity;
  hasAM.forEach(p => { const am = p.chronology.mt.birthAM; if (am < amMin) amMin = am; if (am > amMax) amMax = am; });
  const amRange = Math.max(1, amMax - amMin);
  const Y_SPAN = 4200;
  const yForAM = (am: number | undefined) => am != null ? ((am - amMin) / amRange) * Y_SPAN : undefined;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 90, nodesep: 36, marginx: 60, marginy: 80 });
  filtered.forEach(p => { g.setNode(p.id, { width: NODE_W, height: NODE_H + (p.chronology?.mt?.lifespan ? 14 : 0) }); });
  filtered.forEach(p => { const parent = p.father && ids.has(p.father) ? p.father : (p.mother && ids.has(p.mother) ? p.mother : null); if (parent) g.setEdge(parent, p.id); });
  dagre.layout(g);

  const nodes: Node[] = filtered.map(p => {
    const pos = g.node(p.id);
    const yAM = yForAM(p.chronology?.mt?.birthAM);
    return { id: p.id, type: 'person', position: { x: pos.x - NODE_W / 2, y: yAM ?? (pos.y - NODE_H / 2) },
      data: { name: p.name.ru, hebrew: p.name.he, birthName: p.name.birthName, altName: p.name.altName, lineage: p.lineage, chronology: p.chronology, disputed: p.disputed, role: p.role, significance: p.significance, ref: p.ref, era: p.era, gender: p.gender, golden: opts.showGolden && goldenPath.has(p.id) } };
  });

  const edges: Edge[] = [];
  filtered.forEach(p => {
    const parentId = p.father && ids.has(p.father) ? p.father : (p.mother && ids.has(p.mother) ? p.mother : null);
    if (!parentId) return;
    const isGoldenEdge = opts.showGolden && goldenPath.has(p.id) && goldenPath.has(parentId);
    const ls = getLine(p.lineage);
    edges.push({ id: `${parentId}->${p.id}`, source: parentId, target: p.id, type: 'smoothstep', animated: isGoldenEdge,
      style: { stroke: isGoldenEdge ? '#ffd700' : ls.border, strokeWidth: isGoldenEdge ? 3.5 : p.lineage.startsWith('messianic') ? 2.2 : 1.4, opacity: isGoldenEdge ? 0.95 : p.lineage.startsWith('messianic') ? 0.7 : 0.35 },
      markerEnd: { type: MarkerType.ArrowClosed, color: isGoldenEdge ? '#ffd700' : ls.border, width: 14 } });
  });
  return { nodes, edges, goldenPath };
}

// ── Person Node ──
const PersonNode = ({ data }: { data: any }) => {
  const ls = getLine(data.lineage);
  const lifespan: number | undefined = data.chronology?.mt?.lifespan;
  const birthAM: number | undefined = data.chronology?.mt?.birthAM;
  const era = ERA_META[data.era] || null;
  const lifeBarW = lifespan ? Math.min(100, (lifespan / 969) * 100) : 0;
  const isMessiah = data.role === 'messiah';
  return (
    <div className="genealogy-node" style={{ background: `linear-gradient(135deg, ${ls.bg}, rgba(13,10,6,0.6))`, border: `1.5px solid ${data.golden ? '#ffd700' : ls.border}`, borderRadius: '10px', padding: '7px 11px 8px', width: `${NODE_W - 4}px`, textAlign: 'center', fontFamily: '"Lora", Georgia, serif', cursor: 'pointer', transition: 'box-shadow .2s, border-color .2s', boxShadow: data.golden ? `0 0 14px ${ls.glow}, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 10px rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)', position: 'relative', overflow: 'hidden' }}>
      {era && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: era.color, opacity: 0.7 }} />}
      {data.disputed && <div style={{ position: 'absolute', top: '-7px', right: '-7px', background: '#c0392b', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)' }} title="Спорное место">?</div>}
      <div style={{ color: isMessiah ? '#ffd700' : ls.text, fontSize: isMessiah ? '15px' : '13px', fontWeight: 700, lineHeight: 1.15, textShadow: isMessiah ? '0 0 8px rgba(255,215,0,0.4)' : 'none' }}>{data.name}</div>
      {data.hebrew && <div style={{ color: ls.border, fontSize: '11px', direction: 'rtl', marginTop: '1px', opacity: 0.8 }}>{data.hebrew}</div>}
      {data.birthName && <div style={{ color: 'rgba(200,184,154,0.45)', fontSize: '9px', marginTop: '1px' }}>рожд. {data.birthName}</div>}
      {lifespan != null && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ height: '3px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ height: '100%', width: `${lifeBarW}%`, background: data.golden ? 'linear-gradient(90deg, #ffd700, #ffe87a)' : `linear-gradient(90deg, ${ls.fill}aa, ${ls.fill}66)`, borderRadius: '2px' }} />
          </div>
          <div style={{ color: 'rgba(200,184,154,0.5)', fontSize: '8.5px', marginTop: '2px' }}>{lifespan} лет{birthAM != null ? ` · AM ${birthAM}` : ''}</div>
        </div>
      )}
      {isMessiah && <div style={{ position: 'absolute', inset: '-5px', borderRadius: '14px', border: '2px solid rgba(255,215,0,0.6)', boxShadow: '0 0 28px rgba(255,215,0,0.5)', pointerEvents: 'none', animation: 'pulse-gold 2.5s ease-in-out infinite' }} />}
    </div>
  );
};
const nodeTypes: NodeTypes = { person: PersonNode };

// ── Detail Panel ──
function DetailPanel({ person, onClose }: { person: any; onClose: () => void }) {
  if (!person) return null;
  const ls = getLine(person.lineage);
  const era = ERA_META[person.era] || null;
  const chron = person.chronology?.mt;
  const roleLabels: Record<string,string> = { patriarch: 'Патриарх', matriarch: 'Праматерь', king: 'Царь', prince: 'Князь', priest: 'Священник', prophet: 'Пророк', governor: 'Правитель', messiah: 'Мессия', 'foster-father': 'Приёмный отец', person: 'Личность' };
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(380px, 100vw)', zIndex: 50, background: 'linear-gradient(180deg, rgba(20,16,10,0.97), rgba(10,8,5,0.98))', backdropFilter: 'blur(20px)', borderLeft: `1px solid ${ls.border}40`, boxShadow: '-8px 0 40px rgba(0,0,0,0.5)', overflowY: 'auto', padding: '20px 22px', fontFamily: '"Lora", Georgia, serif', animation: 'slide-in-right .25s ease-out' }}>
      <button onClick={onClose} aria-label="Закрыть" style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${ls.border}30`, borderRadius: '8px', color: '#c8b89a', fontSize: '18px', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      <div style={{ fontSize: '22px', fontWeight: 700, color: ls.text, lineHeight: 1.2, paddingRight: '32px' }}>{person.name.ru}</div>
      {person.name.he && <div style={{ fontSize: '18px', color: ls.border, direction: 'rtl', marginTop: '2px' }}>{person.name.he}</div>}
      {person.name.altName && <div style={{ color: 'rgba(200,184,154,0.5)', fontSize: '13px', marginTop: '3px' }}>также: {person.name.altName}</div>}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
        {era && <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '999px', background: `${era.color}25`, color: era.color, border: `1px solid ${era.color}40` }}>{era.label}</span>}
        <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '999px', background: `${ls.border}18`, color: ls.text, border: `1px solid ${ls.border}30` }}>{roleLabels[person.role] || person.role}</span>
        {person.gender === 'f' && <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '999px', background: 'rgba(200,100,140,0.1)', color: '#d4889a', border: '1px solid rgba(200,100,140,0.2)' }}>жена/мать</span>}
      </div>
      {chron && (
        <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(212,168,87,0.05)', borderRadius: '10px', border: `1px solid ${ls.border}20` }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.4)', marginBottom: '6px' }}>Хронология (MT)</div>
          {chron.ageAtSon != null && <div style={{ color: '#c8b89a', fontSize: '13px', marginBottom: '3px' }}>Сын родился в <b style={{color: ls.text}}>{chron.ageAtSon}</b> лет</div>}
          {chron.lifespan != null && <div style={{ color: '#c8b89a', fontSize: '13px', marginBottom: '3px' }}>Прожил <b style={{color: ls.text}}>{chron.lifespan}</b> лет</div>}
          {chron.birthAM != null && <div style={{ color: '#c8b89a', fontSize: '13px' }}>Рождение: <b style={{color: ls.text}}>AM {chron.birthAM}</b></div>}
          {chron.deathAM != null && <div style={{ color: '#c8b89a', fontSize: '13px' }}>Смерть: <b style={{color: ls.text}}>AM {chron.deathAM}</b></div>}
        </div>
      )}
      {person.significance && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.4)', marginBottom: '6px' }}>Значение</div>
          <p style={{ color: '#d8c8a8', fontSize: '13.5px', lineHeight: 1.55, margin: 0 }}>{person.significance}</p>
        </div>
      )}
      {person.disputed && (
        <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#e87060', marginBottom: '8px' }}>⚠ Спорное место ({person.disputed.level})</div>
          {person.disputed.positions.map((pos: any, i: number) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={{ color: '#d8c8a8', fontSize: '12.5px', lineHeight: 1.4 }}>• {pos.view}</div>
              <div style={{ color: 'rgba(200,184,154,0.45)', fontSize: '10.5px', marginTop: '1px' }}>{pos.proponents}</div>
            </div>
          ))}
        </div>
      )}
      {person.ref && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.4)', marginBottom: '4px' }}>Писание</div>
          <div style={{ color: ls.border, fontSize: '13px', fontFamily: 'monospace' }}>{person.ref}</div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function GenealogyTree({ persons, eras }: { persons: any[]; eras?: any[] }) {
  const [search, setSearch] = useState('');
  const [showLineage, setShowLineage] = useState('all');
  const [showGolden, setShowGolden] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<Node['data']>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { nodes: laidNodes, edges: laidEdges, goldenPath } = useMemo(() => buildLayout(persons, { showGolden, showLineage }), [persons, showGolden, showLineage]);
  useEffect(() => { setNodes(laidNodes); setEdges(laidEdges); }, [laidNodes, laidEdges, setNodes, setEdges]);

  // ── Semantic zoom: 3 levels ──
  const detailLevel = zoomLevel < 0.3 ? 0 : zoomLevel < 0.7 ? 1 : 2;
  const KEY_ROLES = new Set(['patriarch', 'king', 'messiah', 'prophet', 'matriarch', 'priest', 'governor', 'foster-father']);
  useEffect(() => {
    if (detailLevel === 2) { setNodes(ns => ns.map(n => ({ ...n, hidden: false }))); setEdges(es => es.map(e => ({ ...e, hidden: false }))); return; }
    const visibleIds = new Set<string>();
    persons.forEach(p => {
      const isGolden = goldenPath.has(p.id);
      const isKeyRole = KEY_ROLES.has(p.role);
      const isDisputed = Boolean(p.disputed);
      if (detailLevel === 0) { if (isGolden || p.role === 'messiah' || ['adam','noah','abram','david'].includes(p.id)) visibleIds.add(p.id); }
      else { if (isGolden || isKeyRole || isDisputed) visibleIds.add(p.id); }
    });
    setNodes(ns => ns.map(n => ({ ...n, hidden: !visibleIds.has(n.id) })));
    setEdges(es => es.map(e => ({ ...e, hidden: !(visibleIds.has(e.source) && visibleIds.has(e.target)) })));
  }, [detailLevel, persons, goldenPath, setNodes, setEdges]);

  // ── search ──
  useEffect(() => {
    if (!search.trim()) { setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, highlighted: false } }))); return; }
    const q = search.toLowerCase().trim();
    const match = persons.find(p => p.name.ru.toLowerCase().includes(q) || (p.name.he && p.name.he.includes(search.trim())) || (p.name.altName && p.name.altName.toLowerCase().includes(q)) || p.id.toLowerCase().includes(q));
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, highlighted: n.id === match?.id } })));
  }, [search, persons, setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => { const p = persons.find(pp => pp.id === node.id); if (p) setSelected(p); }, [persons]);
  const lineages = [{ id: 'all', label: 'Все' }, { id: 'messianic', label: 'Мессианская' }, { id: 'cainite', label: 'Каинова' }, { id: 'neutral', label: 'Прочие' }];

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', background: 'radial-gradient(ellipse at 50% 0%, #1a1510 0%, #0d0a06 50%, #050402 100%)', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025, pointerEvents: 'none' }}>
        <filter id="parchment-noise"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="42" /><feColorMatrix values="0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.5 0" /></filter>
        <rect width="100%" height="100%" filter="url(#parchment-noise)" />
      </svg>

      <div style={{ position: 'absolute', top: '10px', left: '14px', zIndex: 11 }}>
        <a href="/" style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px', textDecoration: 'none', padding: '8px 12px', background: 'rgba(13,10,6,0.8)', backdropFilter: 'blur(10px)', borderRadius: '999px', border: '1px solid rgba(212,168,87,0.15)', minHeight: '36px', display: 'flex', alignItems: 'center' }}>← Главная</a>
      </div>

      <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 11, display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(13,10,6,0.88)', backdropFilter: 'blur(14px)', borderRadius: '999px', padding: '6px 8px', border: '1px solid rgba(212,168,87,0.2)', maxWidth: 'calc(100vw - 28px)', flexWrap: 'wrap', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
        <input type="text" placeholder="🔍 Поиск имени..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#e8d5b0', fontFamily: '"Lora", Georgia, serif', fontSize: '13px', outline: 'none', width: '150px', minHeight: '40px' }} />
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        {lineages.map(l => <button key={l.id} onClick={() => setShowLineage(l.id)} style={{ background: showLineage === l.id ? 'rgba(212,168,87,0.2)' : 'transparent', border: showLineage === l.id ? '1px solid rgba(212,168,87,0.4)' : '1px solid transparent', borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px', color: showLineage === l.id ? '#d4a857' : 'rgba(200,184,154,0.5)', fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s' }}>{l.label}</button>)}
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        <button onClick={() => setShowGolden(g => !g)} title="Золотая мессианская нить" style={{ background: showGolden ? 'rgba(255,215,0,0.15)' : 'transparent', border: showGolden ? '1px solid rgba(255,215,0,0.4)' : '1px solid transparent', borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px', color: showGolden ? '#ffd700' : 'rgba(200,184,154,0.4)', fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s' }}>✦ Нить</button>
      </div>

      {eras && (
        <div style={{ position: 'absolute', bottom: '12px', left: '14px', zIndex: 11, background: 'rgba(13,10,6,0.82)', backdropFilter: 'blur(10px)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(212,168,87,0.12)', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '180px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.35)', marginBottom: '2px' }}>Эпохи</div>
          {eras.map((e: any) => <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: e.color, flexShrink: 0 }} /><span style={{ color: 'rgba(200,184,154,0.55)', fontSize: '10.5px' }}>{e.name}</span></div>)}
        </div>
      )}

      {/* Semantic zoom indicator */}
      <div style={{ position: 'absolute', bottom: '12px', right: '14px', zIndex: 11, background: 'rgba(13,10,6,0.82)', backdropFilter: 'blur(10px)', borderRadius: '10px', padding: '8px 12px', border: '1px solid rgba(212,168,87,0.12)', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.35)' }}>Уровень</div>
        <div style={{ color: detailLevel === 0 ? '#d4a857' : detailLevel === 1 ? '#e8c87a' : '#ffd700', fontSize: '12px', fontWeight: 700 }}>{detailLevel === 0 ? 'Обзор' : detailLevel === 1 ? 'Ключевые' : 'Все детали'}</div>
        <div style={{ color: 'rgba(200,184,154,0.3)', fontSize: '8.5px' }}>{detailLevel === 0 ? 'приблизьте для деталей' : detailLevel === 1 ? 'ещё ближе — все имена' : `${nodes.filter(n => !n.hidden).length} из ${persons.length}`}</div>
      </div>

      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} nodeTypes={nodeTypes} onViewportChange={(viewport: { zoom: number }) => setZoomLevel(viewport.zoom)} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.04} maxZoom={3} connectionLineType={ConnectionLineType.SmoothStep} proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }}>
        <Background color="rgba(212,168,87,0.05)" gap={36} size={1} />
        <Controls style={{ background: 'rgba(13,10,6,0.85)', borderColor: 'rgba(212,168,87,0.2)', borderRadius: '8px' }} showInteractive={false} />
        <MiniMap style={{ background: 'rgba(13,10,6,0.85)', border: '1px solid rgba(212,168,87,0.15)', borderRadius: '8px' }} nodeColor={(n: any) => getLine((n.data as any)?.lineage || 'neutral').fill} nodeStrokeWidth={3} maskColor="rgba(0,0,0,0.65)" pannable zoomable />
      </ReactFlow>

      <DetailPanel person={selected} onClose={() => setSelected(null)} />

      <style>{`
        @keyframes pulse-gold { 0%,100% { box-shadow: 0 0 16px rgba(255,215,0,0.25); } 50% { box-shadow: 0 0 32px rgba(255,215,0,0.55); } }
        @keyframes slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .react-flow__attribution { display: none !important; }
        .react-flow__controls-button { width: 40px !important; height: 40px !important; min-width: 40px !important; min-height: 40px !important; color: #c8b89a !important; }
        .react-flow__controls-button:hover { background: rgba(212,168,87,0.12) !important; }
        .react-flow__controls-button svg { fill: #c8b89a !important; }
        .react-flow__minimap { border-radius: 8px !important; }
        .react-flow__edge-path { transition: stroke-width .15s; }
        .genealogy-node:hover { transform: scale(1.06) !important; z-index: 1000 !important; box-shadow: 0 0 28px rgba(212,168,87,0.35) !important; border-color: #ffd700 !important; }
        .genealogy-node { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        @media (hover: none) { .genealogy-node:hover { transform: none !important; } }
      `}</style>
    </div>
  );
}
