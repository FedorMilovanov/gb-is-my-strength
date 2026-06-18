import { useState, useMemo, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, type Node, type Edge, type NodeTypes, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';


// === Lineage colors ===
const LINEAGE_STYLES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  'messianic':        { bg: 'rgba(212,168,87,0.12)',  border: '#d4a857', text: '#f5e6c8', glow: 'rgba(212,168,87,0.4)' },
  'messianic-matthew':{ bg: 'rgba(184,134,61,0.12)',  border: '#b8863d', text: '#e8d5b0', glow: 'rgba(184,134,61,0.4)' },
  'messianic-luke':   { bg: 'rgba(180,145,90,0.12)',  border: '#b49158', text: '#e0d0b8', glow: 'rgba(180,145,90,0.4)' },
  'messianic-fulfillment': { bg: 'rgba(255,215,0,0.15)', border: '#ffd700', text: '#fff8e0', glow: 'rgba(255,215,0,0.6)' },
  'cainite':          { bg: 'rgba(140,60,60,0.10)',   border: '#8c3c3c', text: '#d4a0a0', glow: 'rgba(140,60,60,0.3)' },
  'rejected':         { bg: 'rgba(100,100,100,0.08)', border: '#646464', text: '#a0a0a0', glow: 'none' },
  'neutral':          { bg: 'rgba(140,120,90,0.08)',  border: '#8c785a', text: '#c8b89a', glow: 'none' },
};

function getLineStyle(lineage: string) {
  return LINEAGE_STYLES[lineage] || LINEAGE_STYLES['neutral'];
}

// === Dagre layout ===
function layoutTree(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 100, nodesep: 40, marginx: 50, marginy: 50 });

  const nodeW = 180, nodeH = 64;
  nodes.forEach(n => g.setNode(n.id, { width: nodeW, height: nodeH }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - nodeW / 2, y: pos.y - nodeH / 2 } };
  });
}

// === Custom Node Component ===
const PersonNode = ({ data }: { data: any }) => {
  const style = getLineStyle(data.lineage);
  const lifespan = data.chronology?.mt?.lifespan;
  const birthAM = data.chronology?.mt?.birthAM;
  const disputed = Boolean(data.disputed);

  return (
    <div
      style={{
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: '8px',
        padding: '6px 10px',
        minWidth: '160px',
        maxWidth: '200px',
        textAlign: 'center',
        fontFamily: '"Lora", Georgia, serif',
        cursor: 'pointer',
        transition: 'box-shadow .2s, transform .2s',
        boxShadow: data.highlighted ? `0 0 16px ${style.glow}` : '0 2px 8px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
        position: 'relative',
      }}
      className="genealogy-node"
    >
      {disputed && (
        <div style={{
          position: 'absolute', top: '-6px', right: '-6px',
          background: '#c44', color: '#fff', borderRadius: '50%',
          width: '14px', height: '14px', fontSize: '9px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold',
        }}>?</div>
      )}
      <div style={{ color: style.text, fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>
        {data.name}
      </div>
      {data.hebrew && (
        <div style={{ color: style.border, fontSize: '11px', direction: 'rtl', marginTop: '1px' }}>
          {data.hebrew}
        </div>
      )}
      {lifespan && (
        <div style={{ color: 'rgba(200,184,154,0.6)', fontSize: '9px', marginTop: '2px' }}>
          {lifespan} лет{birthAM ? ` · AM ${birthAM}` : ''}
        </div>
      )}
      {data.role === 'messiah' && (
        <div style={{
          position: 'absolute', inset: '-4px',
          borderRadius: '12px', border: '2px solid #ffd700',
          boxShadow: '0 0 24px rgba(255,215,0,0.5)',
          pointerEvents: 'none', animation: 'pulse-gold 2s ease-in-out infinite',
        }} />
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = { person: PersonNode };

// === Main Component ===
export default function GenealogyTree({ persons }: { persons: any[] }) {
  const [search, setSearch] = useState('');
  const [showLineage, setShowLineage] = useState<string>('all');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<Node['data']>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const highlightIdRef = useRef<string | null>(null);
  const [_, forceUpdate] = useState(0);

  // Build graph
  const { initialNodes, initialEdges } = useMemo(() => {
    const filtered = showLineage === 'all'
      ? persons
      : showLineage === 'messianic'
        ? persons.filter(p => p.lineage.startsWith('messianic'))
        : persons.filter(p => p.lineage === showLineage);

    const personIds = new Set(filtered.map(p => p.id));

    const ns: Node[] = filtered.map(p => ({
      id: p.id,
      type: 'person',
      position: { x: 0, y: 0 },
      data: {
        name: p.name.ru,
        hebrew: p.name.he,
        lineage: p.lineage,
        chronology: p.chronology,
        disputed: p.disputed,
        role: p.role,
        significance: p.significance,
      },
    }));

    const es: Edge[] = [];
    filtered.forEach(p => {
      if (p.father && personIds.has(p.father)) {
        const fStyle = getLineStyle(p.lineage);
        es.push({
          id: `${p.father}-${p.id}`,
          source: p.father, target: p.id,
          type: 'smoothstep',
          style: {
            stroke: fStyle.border,
            strokeWidth: p.lineage.startsWith('messianic') ? 2.5 : 1.5,
            opacity: p.lineage.startsWith('messianic') ? 0.8 : 0.4,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: fStyle.border, width: 12 },
        });
      }
    });

    const laidOut = layoutTree(ns, es, 'TB');
    return { initialNodes: laidOut, initialEdges: es };
  }, [persons, showLineage]);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Highlight on search
  useEffect(() => {
    if (!search.trim()) { highlightIdRef.current = null; forceUpdate(v => v + 1); return; }
    const q = search.toLowerCase().trim();
    const match = persons.find(p =>
      p.name.ru.toLowerCase().includes(q) ||
      (p.name.he && p.name.he.includes(search.trim())) ||
      p.id.toLowerCase().includes(q)
    );
    if (match) {
      setHighlightId(match.id);
      function setHighlightId(id: string) {
        highlightIdRef.current = id;
        setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, highlighted: n.id === id } })));
      }
    }
  }, [search, persons, setNodes]);

  const lineages = ['all', 'messianic', 'cainite', 'neutral'];

  return (
    <div style={{
      width: '100%', height: '100dvh', position: 'relative',
      background: 'radial-gradient(ellipse at 50% 0%, #1a1510 0%, #0d0a06 50%, #050402 100%)',
      overflow: 'hidden',
    }}>
      {/* Parchment texture overlay */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.03, pointerEvents: 'none' }}>
        <defs>
          <filter id="parchment-noise">
            <feTurbulence baseFrequency="0.9" numOctaves="2" seed="42" />
            <feColorMatrix values="0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.5 0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#parchment-noise)" />
      </svg>

      {/* Control panel */}
      <div style={{
        position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: '8px', alignItems: 'center',
        background: 'rgba(13,10,6,0.85)', backdropFilter: 'blur(12px)',
        borderRadius: '999px', padding: '8px 16px', border: '1px solid rgba(212,168,87,0.2)',
        maxWidth: 'calc(100vw - 24px)', flexWrap: 'wrap', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <input
          type="text"
          placeholder="Поиск имени..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'transparent', border: 'none', color: '#e8d5b0',
            fontFamily: '"Lora", Georgia, serif', fontSize: '13px',
            outline: 'none', width: '180px', minHeight: '44px',
          }}
        />
        <span style={{ color: 'rgba(200,184,154,0.4)', fontSize: '12px' }}>|</span>
        {lineages.map(l => (
          <button
            key={l}
            onClick={() => setShowLineage(l)}
            style={{
              background: showLineage === l ? 'rgba(212,168,87,0.2)' : 'transparent',
              border: showLineage === l ? '1px solid rgba(212,168,87,0.4)' : '1px solid transparent',
              borderRadius: '999px', padding: '10px 14px', cursor: 'pointer', minHeight: '44px',
              color: showLineage === l ? '#d4a857' : 'rgba(200,184,154,0.5)',
              fontFamily: 'inherit', fontSize: '11px', transition: 'all .2s',
            }}
          >
            {l === 'all' ? 'Все' : l === 'messianic' ? 'Мессианская' : l === 'cainite' ? 'Каинова' : 'Прочие'}
          </button>
        ))}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background color="rgba(212,168,87,0.06)" gap={32} size={1} />
        <Controls
          style={{
            background: 'rgba(13,10,6,0.85)', borderColor: 'rgba(212,168,87,0.2)',
            borderRadius: '8px',
          }}
          showInteractive={false}
        />
        <MiniMap
          style={{
            background: 'rgba(13,10,6,0.85)', border: '1px solid rgba(212,168,87,0.15)',
            borderRadius: '8px',
          }}
          nodeColor={(n: any) => getLineStyle((n.data as any)?.lineage || 'neutral').border}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 16px rgba(255,215,0,0.3); }
          50% { box-shadow: 0 0 32px rgba(255,215,0,0.6); }
        }
        .react-flow__attribution { display: none !important; }
        .react-flow__controls-button { width: 44px !important; height: 44px !important; min-width: 44px !important; min-height: 44px !important; }
        .react-flow__controls { overflow: hidden; }
        .genealogy-node:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 0 24px rgba(212,168,87,0.3) !important;
          z-index: 1000 !important;
        }
      `}</style>
    </div>
  );
}
