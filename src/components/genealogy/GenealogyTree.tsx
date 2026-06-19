/**
 * GenealogyTree — interactive biblical genealogy from Adam to Christ.
 *
 * Premium parchment-themed React Flow tree with:
 * - Semantic zoom (3 levels: cosmic → key → all 156 persons)
 * - Golden messianic thread toggle (traces Christ → Adam)
 * - Detail panel with chronology, significance, disputed-node callouts
 * - Chronological Y-axis (birthAM positioning)
 * - Life bars proportional to lifespan (dramatic post-flood collapse)
 * - Fuzzy search, lineage filter, era legend
 *
 * Architecture:
 *   types.ts   — strict TypeScript types (Person, Era, Disputed, ...)
 *   theme.ts   — visual identity, lineage/era palettes, constants
 *   layout.ts  — dagre layout + golden-path tracing + AM positioning
 *   PersonNode.tsx — memoized custom node
 *   DetailPanel.tsx — memoized slide-in sidebar
 *   GenealogyTree.tsx — this orchestrator
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge, type NodeTypes, ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { Person, Era, LineageFilter, DetailLevel } from './types';
import { getLineStyle, KEY_ROLES, COSMIC_ANCHORS } from './theme';
import { buildLayout } from './layout';
import { PersonNode } from './PersonNode';
import { DetailPanel } from './DetailPanel';
import { TimelineAxis } from './TimelineAxis';
import { SplitView } from './SplitView';

const nodeTypes: NodeTypes = { person: PersonNode };

const LINEAGE_FILTERS: { id: LineageFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'messianic', label: 'Мессианская' },
  { id: 'cainite', label: 'Каинова' },
  { id: 'neutral', label: 'Прочие' },
];

interface GenealogyTreeProps {
  persons: Person[];
  eras?: Era[];
}

export default function GenealogyTree({ persons, eras }: GenealogyTreeProps) {
  // ── React Flow instance (for setCenter on search) ──
  const reactFlow = useReactFlow();

  // ── State ──
  const [search, setSearch] = useState('');
  const [showLineage, setShowLineage] = useState<LineageFilter>('all');
  const [showGolden, setShowGolden] = useState(true);
  const [selected, setSelected] = useState<Person | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ── Layout (memoized) ──
  const { nodes: laidNodes, edges: laidEdges, goldenPath } = useMemo(
    () => buildLayout(persons, { showGolden, showLineage }),
    [persons, showGolden, showLineage],
  );

  // ── AM range for timeline axis ──
  const { amMin, amMax } = useMemo(() => {
    const withAM = persons.filter(p => p.chronology?.mt?.birthAM != null);
    let mn = Infinity, mx = -Infinity;
    for (const p of withAM) {
      const am = p.chronology!.mt!.birthAM!;
      if (am < mn) mn = am;
      if (am > mx) mx = am;
    }
    return { amMin: isFinite(mn) ? mn : 0, amMax: isFinite(mx) ? mx : 4000 };
  }, [persons]);

  useEffect(() => {
    setNodes(laidNodes);
    setEdges(laidEdges);
  }, [laidNodes, laidEdges, setNodes, setEdges]);

  // ── Semantic zoom: hide/show nodes based on zoom level ──
  const detailLevel: DetailLevel = zoomLevel < 0.3 ? 0 : zoomLevel < 0.7 ? 1 : 2;

  useEffect(() => {
    if (detailLevel === 2) {
      setNodes(ns => ns.map(n => ({ ...n, hidden: false })));
      setEdges(es => es.map(e => ({ ...e, hidden: false })));
      return;
    }
    // Determine visible IDs at this detail level
    const visibleIds = new Set<string>();
    for (const p of persons) {
      const isGolden = goldenPath.has(p.id);
      const isKeyRole = p.role ? KEY_ROLES.has(p.role) : false;
      const isDisputed = Boolean(p.disputed);
      if (detailLevel === 0) {
        if (isGolden || p.role === 'messiah' || COSMIC_ANCHORS.has(p.id)) visibleIds.add(p.id);
      } else {
        if (isGolden || isKeyRole || isDisputed) visibleIds.add(p.id);
      }
    }
    setNodes(ns => ns.map(n => ({ ...n, hidden: !visibleIds.has(n.id) })));
    setEdges(es => es.map(e => ({ ...e, hidden: !(visibleIds.has(e.source) && visibleIds.has(e.target)) })));
  }, [detailLevel, persons, goldenPath, setNodes, setEdges]);

  // ── Search: highlight matched node ──
  useEffect(() => {
    if (!search.trim()) {
      setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, highlighted: false } })));
      return;
    }
    const q = search.toLowerCase().trim();
    const match = persons.find(p =>
      p.name.ru.toLowerCase().includes(q) ||
      (p.name.he?.includes(search.trim()) ?? false) ||
      (p.name.altName?.toLowerCase().includes(q) ?? false) ||
      p.id.toLowerCase().includes(q),
    );
    setNodes(ns => ns.map(n => ({
      ...n,
      data: { ...n.data, highlighted: n.id === match?.id },
    })));

    // Center viewport on the matched person
    if (match) {
      const matchNode = laidNodes.find(n => n.id === match.id);
      if (matchNode) {
        const x = matchNode.position.x + 86; // half NODE_W
        const y = matchNode.position.y + 36; // half NODE_H
        reactFlow.setCenter(x, y, { zoom: 1.2, duration: 600 });
      }
    }
  }, [search, persons, setNodes, laidNodes, reactFlow]);

  // ── Handlers ──
  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    const p = persons.find(pp => pp.id === node.id);
    if (p) setSelected(p);
  }, [persons]);

  const onClosePanel = useCallback(() => setSelected(null), []);

  const visibleCount = useMemo(() => nodes.filter(n => !n.hidden).length, [nodes]);

  const detailLabel = detailLevel === 0 ? 'Обзор' : detailLevel === 1 ? 'Ключевые' : 'Все детали';
  const detailHint = detailLevel === 0 ? 'приблизьте для деталей' : detailLevel === 1 ? 'ещё ближе — все имена' : `${visibleCount} из ${persons.length}`;

  return (
    <div
      style={{
        width: '100%', height: '100dvh', position: 'relative',
        background: 'radial-gradient(ellipse at 50% 0%, #1a1510 0%, #0d0a06 50%, #050402 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Parchment noise texture */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025, pointerEvents: 'none' }} aria-hidden="true">
        <filter id="parchment-noise">
          <feTurbulence baseFrequency="0.9" numOctaves="2" seed="42" />
          <feColorMatrix values="0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#parchment-noise)" />
      </svg>

      {/* Back to home */}
      <div style={{ position: 'absolute', top: '10px', left: '14px', zIndex: 11 }}>
        <a
          href="/"
          style={{
            color: 'rgba(200,184,154,0.5)', fontSize: '11px', textDecoration: 'none',
            padding: '8px 12px', background: 'rgba(13,10,6,0.8)', backdropFilter: 'blur(10px)',
            borderRadius: '999px', border: '1px solid rgba(212,168,87,0.15)',
            minHeight: '36px', display: 'flex', alignItems: 'center',
          }}
        >← Главная</a>
      </div>

      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Управление древом"
        style={{
          position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 11, display: 'flex', gap: '6px', alignItems: 'center',
          background: 'rgba(13,10,6,0.88)', backdropFilter: 'blur(14px)',
          borderRadius: '999px', padding: '6px 8px', border: '1px solid rgba(212,168,87,0.2)',
          maxWidth: 'calc(100vw - 28px)', flexWrap: 'wrap', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        <input
          type="text"
          placeholder="🔍 Поиск имени..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Поиск по имени"
          style={{
            background: 'transparent', border: 'none', color: '#e8d5b0',
            fontFamily: '"Lora", Georgia, serif', fontSize: '13px',
            outline: 'none', width: '150px', minHeight: '40px',
          }}
        />
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        {LINEAGE_FILTERS.map(l => (
          <button
            key={l.id}
            onClick={() => setShowLineage(l.id)}
            aria-pressed={showLineage === l.id}
            style={{
              background: showLineage === l.id ? 'rgba(212,168,87,0.2)' : 'transparent',
              border: showLineage === l.id ? '1px solid rgba(212,168,87,0.4)' : '1px solid transparent',
              borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px',
              color: showLineage === l.id ? '#d4a857' : 'rgba(200,184,154,0.5)',
              fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s',
            }}
          >{l.label}</button>
        ))}
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        <button
          onClick={() => setShowGolden(g => !g)}
          aria-pressed={showGolden}
          title="Золотая мессианская нить"
          style={{
            background: showGolden ? 'rgba(255,215,0,0.15)' : 'transparent',
            border: showGolden ? '1px solid rgba(255,215,0,0.4)' : '1px solid transparent',
            borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px',
            color: showGolden ? '#ffd700' : 'rgba(200,184,154,0.4)',
            fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s',
          }}
        >✦ Нить</button>
        <span style={{ color: 'rgba(200,184,154,0.3)', fontSize: '11px' }}>|</span>
        <button
          onClick={() => setShowSplit(true)}
          title="Сравнить родословия Матфея и Луки"
          style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,87,0.2)',
            borderRadius: '999px', padding: '9px 12px', cursor: 'pointer', minHeight: '40px',
            color: 'rgba(200,184,154,0.5)',
            fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s',
          }}
        >⇆ Мф/Лк</button>
      </div>

      {/* Era legend */}
      {eras && (
        <div
          style={{
            position: 'absolute', bottom: '12px', left: '14px', zIndex: 11,
            background: 'rgba(13,10,6,0.82)', backdropFilter: 'blur(10px)',
            borderRadius: '10px', padding: '10px 12px',
            border: '1px solid rgba(212,168,87,0.12)',
            display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '180px',
          }}
        >
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.35)', marginBottom: '2px' }}>Эпохи</div>
          {eras.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: e.color, flexShrink: 0 }} />
              <span style={{ color: 'rgba(200,184,154,0.55)', fontSize: '10.5px' }}>{e.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Semantic zoom indicator */}
      <div
        style={{
          position: 'absolute', bottom: '12px', right: '14px', zIndex: 11,
          background: 'rgba(13,10,6,0.82)', backdropFilter: 'blur(10px)',
          borderRadius: '10px', padding: '8px 12px',
          border: '1px solid rgba(212,168,87,0.12)',
          display: 'flex', flexDirection: 'column', gap: '2px',
          alignItems: 'center', pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(200,184,154,0.35)' }}>Уровень</div>
        <div style={{ color: detailLevel === 0 ? '#d4a857' : detailLevel === 1 ? '#e8c87a' : '#ffd700', fontSize: '12px', fontWeight: 700 }}>
          {detailLabel}
        </div>
        <div style={{ color: 'rgba(200,184,154,0.3)', fontSize: '8.5px' }}>{detailHint}</div>
      </div>

      {/* Timeline axis */}
      {eras && amMax > amMin && (
        <TimelineAxis eras={eras} amMin={amMin} amMax={amMax} height={4200} />
      )}

      {/* React Flow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        onViewportChange={(vp: { zoom: number }) => setZoomLevel(vp.zoom)}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.04}
        maxZoom={3}
        connectionLineType={ConnectionLineType.SmoothStep}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="rgba(212,168,87,0.05)" gap={36} size={1} />
        <Controls
          style={{ background: 'rgba(13,10,6,0.85)', borderColor: 'rgba(212,168,87,0.2)', borderRadius: '8px' }}
          showInteractive={false}
        />
        <MiniMap
          style={{ background: 'rgba(13,10,6,0.85)', border: '1px solid rgba(212,168,87,0.15)', borderRadius: '8px' }}
          nodeColor={(n: Node) => getLineStyle((n.data as Record<string, string>)?.lineage ?? 'neutral').fill}
          nodeStrokeWidth={3}
          maskColor="rgba(0,0,0,0.65)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Detail panel */}
      <DetailPanel person={selected} onClose={onClosePanel} />

      {/* Split view (Mt vs Lk) */}
      {showSplit && <SplitView persons={persons} onClose={() => setShowSplit(false)} />}

      {/* Scoped CSS (no global pollution) */}
      <style>{`
        @keyframes genealogy-pulse-gold {
          0%, 100% { box-shadow: 0 0 16px rgba(255,215,0,0.25); }
          50% { box-shadow: 0 0 32px rgba(255,215,0,0.55); }
        }
        @keyframes genealogy-slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .react-flow__attribution { display: none !important; }
        .react-flow__controls-button {
          width: 40px !important; height: 40px !important;
          min-width: 40px !important; min-height: 40px !important;
          color: #c8b89a !important;
        }
        .react-flow__controls-button:hover { background: rgba(212,168,87,0.12) !important; }
        .react-flow__controls-button svg { fill: #c8b89a !important; }
        .react-flow__minimap { border-radius: 8px !important; }
        .react-flow__edge-path { transition: stroke-width .15s; }
        .genealogy-node:hover {
          transform: scale(1.06) !important;
          z-index: 1000 !important;
          box-shadow: 0 0 28px rgba(212,168,87,0.35) !important;
          border-color: #ffd700 !important;
        }
        .genealogy-node {
          transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
        }
        @media (hover: none) {
          .genealogy-node:hover { transform: none !important; }
        }
      `}</style>
    </div>
  );
}
