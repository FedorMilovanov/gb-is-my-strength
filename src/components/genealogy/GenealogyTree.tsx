import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, ConnectionLineType, type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Person, Era, LineageFilter, DetailLevel } from './types';
import { getLineStyle, KEY_ROLES, COSMIC_ANCHORS, ERA_META, NODE_W, MAX_LIFESPAN } from './theme';
import { buildLayout } from './layout';
import { PersonCardContent } from './PersonNode';
import { DetailPanel } from './DetailPanel';
import { TimelineAxis } from './TimelineAxis';
import { SplitView } from './SplitView';

const LINEAGE_FILTERS = [
  { id: 'all' as LineageFilter, label: 'Все' },
  { id: 'messianic' as LineageFilter, label: 'Мессианская' },
  { id: 'cainite' as LineageFilter, label: 'Каинова' },
  { id: 'neutral' as LineageFilter, label: 'Прочие' },
];

export default function GenealogyTree({ persons, eras }: { persons: Person[]; eras?: Era[] }) {
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [search, setSearch] = useState('');
  const [showLineage, setShowLineage] = useState<LineageFilter>('all');
  const [showGolden, setShowGolden] = useState(true);
  const [selected, setSelected] = useState<Person | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tourIndex, setTourIndex] = useState(-1);

  const { nodes: laidNodes, edges: laidEdges, goldenPath } = useMemo(
    () => buildLayout(persons, { showGolden, showLineage }), [persons, showGolden, showLineage],
  );

  const { amMin, amMax } = useMemo(() => {
    const withAM = persons.filter(p => p.chronology?.mt?.birthAM != null);
    let mn = Infinity, mx = -Infinity;
    for (const p of withAM) { const am = p.chronology!.mt!.birthAM!; if (am < mn) mn = am; if (am > mx) mx = am; }
    return { amMin: isFinite(mn) ? mn : 0, amMax: isFinite(mx) ? mx : 4000 };
  }, [persons]);

  const detailLevel: DetailLevel = zoomLevel < 0.3 ? 0 : zoomLevel < 0.7 ? 1 : 2;
  const visibleNodeIds = useMemo(() => {
    if (detailLevel === 2) return null;
    const ids = new Set<string>();
    for (const p of persons) {
      const isGolden = goldenPath.has(p.id);
      const isKeyRole = p.role ? KEY_ROLES.has(p.role) : false;
      const isDisputed = Boolean(p.disputed);
      if (detailLevel === 0) { if (isGolden || p.role === 'messiah' || COSMIC_ANCHORS.has(p.id)) ids.add(p.id); }
      else { if (isGolden || isKeyRole || isDisputed) ids.add(p.id); }
    }
    return ids;
  }, [detailLevel, persons, goldenPath]);

  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase().trim();
    return persons.find(p => p.name.ru.toLowerCase().includes(q) || (p.name.he?.includes(search.trim()) ?? false) || (p.name.altName?.toLowerCase().includes(q) ?? false) || p.id.toLowerCase().includes(q)) ?? null;
  }, [search, persons]);

  useEffect(() => {
    if (!searchMatch || !rfInstance.current) return;
    const n = laidNodes.find(n => n.id === searchMatch.id);
    if (n) rfInstance.current.setCenter(n.position.x + 86, n.position.y + 36, { zoom: 1.2, duration: 600 });
  }, [searchMatch, laidNodes]);

  // Compute final nodes — use default type, pass content via data.label
  const displayNodes: Node[] = useMemo(() => {
    return laidNodes.map(n => {
      const d = n.data as any;
      const isHighlighted = n.id === searchMatch?.id || n.id === activeId;
      return {
        ...n,
        type: undefined, // use React Flow default node
        hidden: visibleNodeIds ? !visibleNodeIds.has(n.id) : false,
        data: { ...d, label: <PersonCardContent data={{ ...d, highlighted: isHighlighted }} /> },
      };
    });
  }, [laidNodes, visibleNodeIds, searchMatch, activeId]);

  const displayEdges: Edge[] = useMemo(() => {
    if (!visibleNodeIds) return laidEdges;
    return laidEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [laidEdges, visibleNodeIds]);

  const focusPerson = useCallback((id: string, zoom?: number) => {
    const n = laidNodes.find(n => n.id === id);
    if (n && rfInstance.current) rfInstance.current.setCenter(n.position.x + 86, n.position.y + 36, { zoom: zoom ?? 1.2, duration: 500 });
    setActiveId(id);
  }, [laidNodes]);

  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    setActiveId(node.id);
    const p = persons.find(pp => pp.id === node.id);
    if (p) setSelected(p);
  }, [persons]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showSplit || !activeId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const person = persons.find(p => p.id === activeId);
      if (!person) return;
      const byId = new Map(persons.map(p => [p.id, p]));
      switch (e.key) {
        case 'ArrowUp': { const pid = person.father ?? person.mother; if (pid && byId.has(pid)) { e.preventDefault(); focusPerson(pid); } break; }
        case 'ArrowDown': { const ch = person.children?.filter(c => byId.has(c)); if (ch?.length) { e.preventDefault(); focusPerson(ch[0]); } break; }
        case 'ArrowLeft': case 'ArrowRight': {
          const pid = person.father ?? person.mother; if (!pid) break;
          const parent = byId.get(pid);
          const sibs = parent?.children?.filter(c => c !== activeId && byId.has(c)) ?? [];
          if (!sibs.length) break; e.preventDefault();
          const idx = parent?.children?.indexOf(activeId) ?? 0;
          const target = sibs[Math.min(e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : Math.min(sibs.length, idx + 1), sibs.length - 1)];
          if (target) focusPerson(target);
          break;
        }
        case 'Enter': case ' ': { e.preventDefault(); const p = persons.find(pp => pp.id === activeId); if (p) setSelected(p); break; }
        case 'Escape': setActiveId(null); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeId, persons, showSplit, focusPerson]);

  const goldenArray = useMemo(() => {
    const arr: string[] = [];
    const byId = new Map(persons.map(p => [p.id, p]));
    let cur = byId.get('jesus');
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) { arr.push(cur.id); guard.add(cur.id); if (cur.id === 'jesus' && cur.mother) cur = byId.get(cur.mother); else cur = cur.father ? byId.get(cur.father) : undefined; }
    return arr.reverse();
  }, [persons]);

  const tourActive = tourIndex >= 0;
  const tourPerson = tourActive ? persons.find(p => p.id === goldenArray[tourIndex]) : null;
  const startTour = useCallback(() => { setTourIndex(0); if (goldenArray[0]) focusPerson(goldenArray[0], 1.0); }, [goldenArray, focusPerson]);
  const tourNext = useCallback(() => setTourIndex(i => { const n = Math.min(i + 1, goldenArray.length - 1); if (goldenArray[n]) focusPerson(goldenArray[n], 1.0); return n; }), [goldenArray, focusPerson]);
  const tourPrev = useCallback(() => setTourIndex(i => { const n = Math.max(i - 1, 0); if (goldenArray[n]) focusPerson(goldenArray[n], 1.0); return n; }), [goldenArray, focusPerson]);
  const visibleCount = displayNodes.filter(n => !n.hidden).length;
  const detailLabel = detailLevel === 0 ? 'Обзор' : detailLevel === 1 ? 'Ключевые' : 'Все детали';
  const detailHint = detailLevel === 0 ? 'приблизьте для деталей' : detailLevel === 1 ? 'ещё ближе — все имена' : `${visibleCount} из ${persons.length}`;

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', background: 'radial-gradient(ellipse at 50% 0%, #1a1510 0%, #0d0a06 50%, #050402 100%)', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025, pointerEvents: 'none' }} aria-hidden="true">
        <filter id="parchment-noise"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="42" /><feColorMatrix values="0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.5 0" /></filter>
        <rect width="100%" height="100%" filter="url(#parchment-noise)" />
      </svg>
      <div style={{ position: 'absolute', top: '10px', left: '14px', zIndex: 11 }}>
        <a href="/" style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px', textDecoration: 'none', padding: '8px 12px', background: 'rgba(13,10,6,0.8)', backdropFilter: 'blur(10px)', borderRadius: '999px', border: '1px solid rgba(212,168,87,0.15)', minHeight: '36px', display: 'flex', alignItems: 'center' }}>← Главная</a>
      </div>
      <div role="toolbar" aria-label="Управление древом" style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 11, display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(13,10,6,0.88)', backdropFilter: 'blur(14px)', borderRadius: '999px', padding: '6px 8px', border: '1px solid rgba(212,168,87,0.2)', maxWidth: 'calc(100vw - 28px)', flexWrap: 'wrap', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
        <input type="text" placeholder="🔍 Поиск имени..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Поиск по имени" style={{ background: 'transparent', border: 'none', color: '#e8d5b0', fontFamily: '"Lora", Georgia, serif', fontSize: '13px', outline: 'none', width: '150px', minHeight: '40px' }} />
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        {LINEAGE_FILTERS.map(l => <button key={l.id} onClick={() => setShowLineage(l.id)} aria-pressed={showLineage === l.id} style={{ background: showLineage === l.id ? 'rgba(212,168,87,0.2)' : 'transparent', border: showLineage === l.id ? '1px solid rgba(212,168,87,0.4)' : '1px solid transparent', borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px', color: showLineage === l.id ? '#d4a857' : 'rgba(200,184,154,0.5)', fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s' }}>{l.label}</button>)}
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        <button onClick={() => setShowGolden(g => !g)} aria-pressed={showGolden} title="Золотая мессианская нить" style={{ background: showGolden ? 'rgba(255,215,0,0.15)' : 'transparent', border: showGolden ? '1px solid rgba(255,215,0,0.4)' : '1px solid transparent', borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px', color: showGolden ? '#ffd700' : 'rgba(200,184,154,0.4)', fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s' }}>✦ Нить</button>
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        <button onClick={() => setShowSplit(true)} title="Сравнить Мф/Лк" style={{ background: 'transparent', border: '1px solid rgba(212,168,87,0.2)', borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px', color: 'rgba(200,184,154,0.5)', fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s' }}>⇆ Мф/Лк</button>
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        <button onClick={startTour} title="Тур" style={{ background: 'transparent', border: '1px solid rgba(212,168,87,0.2)', borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px', color: 'rgba(200,184,154,0.5)', fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s' }}>🎬 Тур</button>
      </div>
      {eras && <div style={{ position: 'absolute', bottom: '12px', left: '14px', zIndex: 11, background: 'rgba(13,10,6,0.82)', backdropFilter: 'blur(10px)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(212,168,87,0.12)', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '180px' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.35)', marginBottom: '2px' }}>Эпохи</div>{eras.map(e => <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: e.color, flexShrink: 0 }} /><span style={{ color: 'rgba(200,184,154,0.55)', fontSize: '10.5px' }}>{e.name}</span></div>)}</div>}
      <div style={{ position: 'absolute', bottom: '12px', right: '14px', zIndex: 11, background: 'rgba(13,10,6,0.82)', backdropFilter: 'blur(10px)', borderRadius: '10px', padding: '8px 12px', border: '1px solid rgba(212,168,87,0.12)', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', pointerEvents: 'none' }}><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.35)' }}>Уровень</div><div style={{ color: detailLevel === 0 ? '#d4a857' : detailLevel === 1 ? '#e8c87a' : '#ffd700', fontSize: '12px', fontWeight: 700 }}>{detailLabel}</div><div style={{ color: 'rgba(200,184,154,0.3)', fontSize: '8.5px' }}>{detailHint}</div></div>
      {eras && amMax > amMin && <TimelineAxis eras={eras} amMin={amMin} amMax={amMax} height={4200} />}
      <ReactFlow nodes={displayNodes} edges={displayEdges} onNodeClick={onNodeClick} onInit={(inst) => { rfInstance.current = inst; }} onViewportChange={(vp: { zoom: number }) => setZoomLevel(vp.zoom)} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.04} maxZoom={3} nodesDraggable={false} nodesConnectable={false} connectionLineType={ConnectionLineType.SmoothStep} proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }}>
        <Background color="rgba(212,168,87,0.05)" gap={36} size={1} />
        <Controls style={{ background: 'rgba(13,10,6,0.85)', borderColor: 'rgba(212,168,87,0.2)', borderRadius: '8px' }} showInteractive={false} />
        <MiniMap style={{ background: 'rgba(13,10,6,0.85)', border: '1px solid rgba(212,168,87,0.15)', borderRadius: '8px' }} nodeColor={(n: Node) => getLineStyle((n.data as Record<string, string>)?.lineage ?? 'neutral').fill} nodeStrokeWidth={3} maskColor="rgba(0,0,0,0.65)" pannable zoomable />
      </ReactFlow>
      <DetailPanel person={selected} onClose={() => setSelected(null)} />
      {showSplit && <SplitView persons={persons} onClose={() => setShowSplit(false)} />}
      {tourActive && tourPerson && (
        <div style={{ position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(13,10,6,0.92)', backdropFilter: 'blur(16px)', borderRadius: '12px', padding: '10px 16px', border: '1px solid rgba(255,215,0,0.25)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)', maxWidth: 'calc(100vw - 40px)' }}>
          <button onClick={tourPrev} disabled={tourIndex === 0} aria-label="Предыдущий" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,168,87,0.2)', borderRadius: '8px', color: tourIndex === 0 ? 'rgba(100,100,100,0.3)' : '#c8b89a', fontSize: '14px', cursor: tourIndex === 0 ? 'default' : 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ textAlign: 'center', minWidth: '120px' }}><div style={{ color: '#ffd700', fontSize: '14px', fontWeight: 700 }}>{tourPerson.name.ru}</div>{tourPerson.chronology?.mt?.birthAM != null && <div style={{ color: 'rgba(200,184,154,0.4)', fontSize: '9px' }}>AM {tourPerson.chronology.mt.birthAM} · шаг {tourIndex + 1} из {goldenArray.length}</div>}</div>
          <button onClick={tourNext} disabled={tourIndex >= goldenArray.length - 1} aria-label="Следующий" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,168,87,0.2)', borderRadius: '8px', color: tourIndex >= goldenArray.length - 1 ? 'rgba(100,100,100,0.3)' : '#c8b89a', fontSize: '14px', cursor: tourIndex >= goldenArray.length - 1 ? 'default' : 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
          <button onClick={() => { setTourIndex(-1); setSelected(tourPerson); }} style={{ background: 'transparent', border: 'none', color: 'rgba(200,184,154,0.5)', fontSize: '10px', cursor: 'pointer', fontFamily: 'inherit' }}>Подробнее</button>
          <button onClick={() => setTourIndex(-1)} aria-label="Закрыть тур" style={{ background: 'transparent', border: 'none', color: 'rgba(200,184,154,0.4)', fontSize: '16px', cursor: 'pointer' }}>×</button>
        </div>
      )}
      <style>{`
        @keyframes genealogy-pulse-gold { 0%,100% { box-shadow: 0 0 16px rgba(255,215,0,0.25); } 50% { box-shadow: 0 0 32px rgba(255,215,0,0.55); } }
        .react-flow__attribution { display: none !important; }
        .react-flow__node { padding: 0 !important; border: none !important; background: transparent !important; }
        .react-flow__node-default { padding: 0 !important; border: none !important; background: transparent !important; }
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
