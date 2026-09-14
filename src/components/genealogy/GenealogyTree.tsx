import { Component, useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { ErrorInfo, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ReactFlow, Background, MiniMap, useNodesState,
  type Node, type Edge, ConnectionLineType, type ReactFlowInstance, type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Person, Era, LineageFilter } from './types';
import { getLineStyle, NODE_W, NODE_H } from './theme';
import { projectGenealogy, overviewIds, fitGenealogyView, centerOf, getDetailLevel, MIN_ZOOM, MAX_ZOOM, boxesOverlap } from './semanticGraph';
import './GenealogyTree.css';
import { buildLayout, computeFocusLineage } from './layout';
import { matchesLineage } from './focusGraph';
import { PersonCardContent, CompactPersonCard } from './PersonNode';
import { DetailPanel } from './DetailPanel';
import { SplitView } from './SplitView';

const LINEAGE_FILTERS = [
  { id: 'all' as LineageFilter, label: 'Все' },
  { id: 'messianic' as LineageFilter, label: 'Мессианская' },
  { id: 'cainite' as LineageFilter, label: 'Каинова' },
  { id: 'neutral' as LineageFilter, label: 'Прочие' },
];

type GenealogyTreeProps = { persons: Person[]; eras?: Era[] };
type GenealogyErrorBoundaryState = { hasError: boolean };

class GenealogyErrorBoundary extends Component<{ children: ReactNode }, GenealogyErrorBoundaryState> {
  state: GenealogyErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GenealogyErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[genealogy] interactive tree crashed', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section
        role="alert"
        aria-live="assertive"
        data-genealogy-fallback
        style={{
          minHeight: '650px',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          padding: '32px 20px',
          background: 'radial-gradient(ellipse at 50% 0%, #1a1510 0%, #0d0a06 50%, #050402 100%)',
          color: '#e8d5b0',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '560px' }}>
          <h2 style={{ margin: '0 0 12px', color: '#ffd700', fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
            Интерактивное древо временно не загрузилось
          </h2>
          <p style={{ margin: '0 0 20px', lineHeight: 1.65, color: 'rgba(232,213,176,0.82)' }}>
            Основной текст страницы сохранён. Можно повторно запустить только интерактивное древо без перезагрузки страницы.
          </p>
          <button
            type="button"
            onClick={this.retry}
            style={{
              minHeight: '44px',
              padding: '10px 18px',
              borderRadius: '999px',
              border: '1px solid rgba(255,215,0,0.45)',
              background: 'rgba(255,215,0,0.12)',
              color: '#ffd700',
              font: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Повторить загрузку древа
          </button>
        </div>
      </section>
    );
  }
}

function GenealogyTreeContent({ persons, eras }: GenealogyTreeProps) {
  const treeRoot = useRef<HTMLDivElement | null>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [search, setSearch] = useState('');
  const [showLineage, setShowLineage] = useState<LineageFilter>('all');
  const [showGolden, setShowGolden] = useState(true);
  const [selected, setSelected] = useState<Person | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const canvasRoot = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Viewport>({ x: 0, y: 0, zoom: 0.04 });
  const detailLevel = getDetailLevel(camera.zoom);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyboardTarget, setKeyboardTarget] = useState<{ id: string } | null>(null);
  const [tourIndex, setTourIndex] = useState(-1);

  // ── Layout (source of truth) ──
  const { nodes: laidNodes, edges: laidEdges, goldenPath, bounds } = useMemo(
    () => buildLayout(persons, { showGolden, showLineage }), [persons, showGolden, showLineage],
  );

  useEffect(() => {
    const node = canvasRoot.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    return () => { observer.disconnect(); motion.removeEventListener('change', updateMotion); };
  }, []);

  const fitOverview = useCallback(() => {
    const ids = overviewIds(laidNodes);
    if (!rfInstance.current || !canvasSize.width || !canvasSize.height) return;
    const viewport = fitGenealogyView(laidNodes.filter(n => ids.has(n.id)), canvasSize.width, canvasSize.height);
    setCamera(viewport);
    void rfInstance.current.setViewport(viewport, { duration: 0 });
  }, [laidNodes, canvasSize]);

  // A new filter gets its own overview. Golden styling never moves the camera.
  const lastFrame = useRef({ width: 0, height: 0, filter: '' });
  useEffect(() => {
    if (!canvasSize.width || !canvasSize.height) return;
    const before = lastFrame.current;
    if (!before.width || before.filter !== showLineage || getDetailLevel(rfInstance.current?.getZoom() ?? 0) === 0) {
      fitOverview();
    } else if (before.width !== canvasSize.width || before.height !== canvasSize.height) {
      const current = rfInstance.current?.getViewport();
      if (current) void rfInstance.current?.setViewport({ ...current,
        x: current.x + (canvasSize.width - before.width) / 2,
        y: current.y + (canvasSize.height - before.height) / 2,
      });
    }
    lastFrame.current = { ...canvasSize, filter: showLineage };
  }, [canvasSize, showLineage, fitOverview]);

  // ── Focus lineage: when activeId is set, compute ancestor+descendant set ──
  const focusLineageIds = useMemo(() => {
    if (!activeId) return null;
    return computeFocusLineage(persons, activeId);
  }, [activeId, persons]);

  // ── Search match ──
  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase().trim();
    return persons.find(p =>
      p.name.ru.toLowerCase().includes(q) ||
      (p.name.he?.includes(search.trim()) ?? false) ||
      (p.name.altName?.toLowerCase().includes(q) ?? false) ||
      p.id.toLowerCase().includes(q),
    ) ?? null;
  }, [search, persons]);

  useEffect(() => {
    if (!searchMatch || !rfInstance.current) return;
    const n = laidNodes.find(n => n.id === searchMatch.id);
    if (!n) { setShowLineage('all'); setActiveId(null); setSelected(null); return; }
    rfInstance.current.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, { zoom: 1.2, duration: reducedMotion ? 0 : 350 });
  }, [searchMatch, laidNodes, reducedMotion]);

  const projection = useMemo(() => projectGenealogy(laidNodes, laidEdges, camera.zoom,
    [activeId, searchMatch?.id].filter((id): id is string => Boolean(id)), goldenPath),
  [laidNodes, laidEdges, camera.zoom, activeId, searchMatch, goldenPath]);
  const visibleNodeIds = projection.visibleIds;

  // ── Compute display nodes with dimming/focus ──
  const displayNodes: Node[] = useMemo(() => {
    return laidNodes.map(n => {
      const d = n.data as any;
      const isHighlighted = n.id === searchMatch?.id;
      const isInFocus = focusLineageIds?.has(n.id) ?? false;
      const isDimmed = focusLineageIds ? !isInFocus : false;
      const semanticHidden = !visibleNodeIds.has(n.id);
      const center = centerOf(n);
      const cardData = { ...d, highlighted: isHighlighted, dimmed: isDimmed, focused: focusLineageIds ? isInFocus : false };
      const compact = projection.level !== 2;
      return {
        ...n,
        hidden: false,
        focusable: !semanticHidden,
        ariaLabel: `${d.name}: открыть сведения и семью`,
        position: { x: center.x - projection.width / 2, y: center.y - projection.height / 2 },
        width: projection.width,
        height: projection.height,
        style: { width: projection.width, height: projection.height, pointerEvents: semanticHidden ? 'none' : 'auto' },
        data: {
          ...cardData,
          label: (
            <div aria-hidden={semanticHidden || undefined} style={{
              visibility: semanticHidden ? 'hidden' : 'visible',
              transform: compact ? `scale(${projection.scale})` : undefined,
              transformOrigin: '0 0',
            }}>
              {compact ? <CompactPersonCard data={cardData} overview={projection.level === 0} />
                : <PersonCardContent data={cardData} />}
            </div>
          ),
        },
      };
    });
  }, [laidNodes, visibleNodeIds, searchMatch, activeId, focusLineageIds, projection]);

  // ReactFlow's controlled nodes must retain dimension changes. Replacing the
  // input with fresh objects without `measured` resets their geometry and hides
  // the wrappers until ResizeObserver runs, including the keyboard destination.
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(displayNodes);
  useLayoutEffect(() => {
    setFlowNodes(current => {
      if (current === displayNodes) return current;
      const previous = new Map(current.map(node => [node.id, node]));
      return displayNodes.map(node => ({
        ...node,
        measured: previous.get(node.id)?.measured,
      }));
    });
  }, [displayNodes, setFlowNodes]);

  // Apply keyboard focus after React has committed the changed node/card state.
  // A new request object also handles navigation to an already active person.
  useLayoutEffect(() => {
    if (!keyboardTarget) return;
    const node = treeRoot.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(keyboardTarget.id)}"]`);
    if (node && node.tabIndex >= 0 && getComputedStyle(node).visibility === 'visible') {
      node.focus({ preventScroll: true });
      setKeyboardTarget(null);
    }
  }, [keyboardTarget, flowNodes]);

  // ── Compute display edges with focus highlighting ──
  const displayEdges: Edge[] = useMemo(() => {
    let result = projection.edges;

    // If focus lineage is active, dim non-focus edges and highlight focus edges
    if (focusLineageIds) {
      result = result.map(e => {
        const inFocus = focusLineageIds.has(e.source) && focusLineageIds.has(e.target);
        if (inFocus) {
          return {
            ...e,
            animated: false,
            style: { ...e.style, strokeWidth: Math.max(Number(e.style?.strokeWidth ?? 1.5), 2.2 / camera.zoom), opacity: 1 },
          };
        }
        return {
          ...e,
          animated: false,
          style: { ...e.style, stroke: (e.style?.stroke as string) || '#888', opacity: 0.12 },
        };
      });
    }
    return result;
  }, [projection.edges, focusLineageIds, camera.zoom, reducedMotion]);

  // ── Helpers ──
  const focusPerson = useCallback((id: string, zoom?: number, duration = 500) => {
    const n = laidNodes.find(n => n.id === id);
    if (n && rfInstance.current) rfInstance.current.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, { zoom: zoom ?? 1.0, duration: reducedMotion ? 0 : duration });
    setActiveId(id);
  }, [laidNodes, reducedMotion]);

  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    if (detailLevel < 2) { focusPerson(node.id, 1, 0); setSelected(null); return; }
    // Toggle: if clicking same node, deactivate focus
    if (activeId === node.id) {
      setActiveId(null);
      setSelected(null);
      return;
    }
    setActiveId(node.id);
    const p = persons.find(pp => pp.id === node.id);
    if (p) setSelected(p);
  }, [persons, activeId, detailLevel, focusPerson]);

  // Click on empty canvas → clear focus
  const onPaneClick = useCallback(() => {
    setActiveId(null);
    setSelected(null);
  }, []);

  const changeLineage = useCallback((filter: LineageFilter) => {
    setShowLineage(filter);
    setSearch('');
    const active = persons.find(person => person.id === activeId);
    if (active && !matchesLineage(active, filter)) setActiveId(null);
    if (selected && !matchesLineage(selected, filter)) setSelected(null);
    setTourIndex(-1);
  }, [activeId, persons, selected]);

  // ── Keyboard nav ──
  const handleGraphKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (showSplit || e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target;
    if (!(target instanceof HTMLElement) || !treeRoot.current?.contains(target)) return;
    if (e.key === 'Escape' && selected && target.closest('[data-genealogy-details]')) {
      e.preventDefault();
      e.stopPropagation();
      setSelected(null);
      setKeyboardTarget({ id: selected.id });
      return;
    }
    // Toolbar, dialogs, links and editable fields own their native keys.
    // Only a focused node inside this atlas can invoke graph navigation.
    const focusedElement = document.activeElement;
    const graphNode = focusedElement instanceof HTMLElement ? focusedElement.closest('.react-flow__node') : null;
    const control = target.closest('button, a, input, textarea, select, summary, [contenteditable], [role="button"], [role="link"]');
    if (!graphNode || !treeRoot.current.contains(graphNode) || (control && control !== graphNode)) return;
    const focusedId = graphNode.getAttribute('data-id');
    const person = persons.find(p => p.id === focusedId);
    if (!person) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(e.key)) return;
    // This atlas owns family navigation; ReactFlow must not also move/select
    // its editor nodes in response to the same key.
    e.preventDefault();
    e.stopPropagation();
    const availableIds = new Set(laidNodes.map(node => node.id));
    const moveFocus = (id: string | undefined) => {
      if (!id || !availableIds.has(id)) return;
      // Repeated arrow keys must not compete with queued camera animations.
      focusPerson(id, 1, 0);
      setSelected(null);
      setKeyboardTarget({ id });
    };
    switch (e.key) {
      case 'ArrowUp': { moveFocus([person.father, person.mother].find(id => id && availableIds.has(id)) ?? undefined); break; }
      case 'ArrowDown': { moveFocus(persons.find(child => availableIds.has(child.id) && (child.father === person.id || child.mother === person.id))?.id); break; }
      case 'ArrowLeft': case 'ArrowRight': {
        const pid = person.father ?? person.mother; if (!pid) break;
        const siblings = persons.filter(sibling => availableIds.has(sibling.id) && (sibling.father === pid || sibling.mother === pid));
        const index = siblings.findIndex(sibling => sibling.id === person.id);
        moveFocus(siblings[index + (e.key === 'ArrowLeft' ? -1 : 1)]?.id);
        break;
      }
      case 'Enter': case ' ': { if (detailLevel < 2) { moveFocus(person.id); } else { setActiveId(person.id); setSelected(person); } break; }
      case 'Escape': setActiveId(null); setSelected(null); break;
    }
  }, [persons, laidNodes, selected, showSplit, focusPerson, detailLevel]);

  // ── Golden path tour ──
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
  const startTour = useCallback(() => {
    setShowLineage('all'); setSearch(''); setSelected(null); setTourIndex(0);
    if (goldenArray[0]) focusPerson(goldenArray[0], 1, 0);
  }, [goldenArray, focusPerson]);
  const tourNext = useCallback(() => setTourIndex(i => Math.min(i + 1, goldenArray.length - 1)), [goldenArray.length]);
  const tourPrev = useCallback(() => setTourIndex(i => Math.max(i - 1, 0)), []);
  useEffect(() => {
    if (tourIndex >= 0 && goldenArray[tourIndex]) focusPerson(goldenArray[tourIndex], 1, 0);
  }, [tourIndex, goldenArray, focusPerson]);

  const visibleCount = visibleNodeIds.size;
  const visibleFocusCount = focusLineageIds ? laidNodes.filter(n => focusLineageIds.has(n.id) && visibleNodeIds.has(n.id)).length : 0;
  const detailLabel = detailLevel === 0 ? 'Обзор' : detailLevel === 1 ? 'Ключевые' : 'Все детали';
  const resetView = () => { setSearch(''); setActiveId(null); setSelected(null); setTourIndex(-1); fitOverview(); };
  const hasCardsInView = laidNodes.some(node => {
    if (!visibleNodeIds.has(node.id)) return false;
    const center = centerOf(node);
    return boxesOverlap({ x: center.x * camera.zoom + camera.x - 72, y: center.y * camera.zoom + camera.y - 26, width: 144, height: 52 },
      { x: 0, y: 0, ...canvasSize });
  });
  const focusEra = (eraId: string) => {
    const members = laidNodes.filter(n => n.data.era === eraId);
    if (!members.length || !rfInstance.current) return;
    setSearch(''); setSelected(null); setActiveId(null); setTourIndex(-1);
    const first = [...members].sort((a, b) => a.position.y - b.position.y)[0];
    focusPerson(first.id, 1, 0);
  };

  return (
    <div ref={treeRoot} className="genealogy-app" data-genealogy-app data-genealogy-level={detailLevel} data-minimap-open={showMiniMap}
      data-genealogy-active-person={activeId ?? undefined} onKeyDownCapture={handleGraphKeyDown}>
      <div className="genealogy-toolbar" role="toolbar" aria-label="Управление древом">
        <div className="genealogy-heading"><h2>Библейские родословия</h2></div>
        <div className="genealogy-primary-tools">
          <input type="text" placeholder="Найти человека…" value={search} onChange={e => { setSearch(e.target.value); setActiveId(null); setSelected(null); }}
            aria-label="Поиск по имени" />
          <button type="button" onClick={() => setShowSplit(true)} title="Сравнить Мф/Лк">Мф / Лк</button>
          <button type="button" onClick={startTour} title="Тур">Пройти нить</button>
        </div>
        <div className="genealogy-filter-tools" role="group" aria-label="Линии и эпохи">
          {LINEAGE_FILTERS.map(l => <button type="button" key={l.id} onClick={() => changeLineage(l.id)}
            aria-pressed={showLineage === l.id}>{l.label}</button>)}
          <button type="button" onClick={() => setShowGolden(g => !g)} aria-pressed={showGolden}
            title="Золотая мессианская нить">✦ Нить</button>

        </div>
      </div>
      <div ref={canvasRoot} className="genealogy-canvas">
        <ReactFlow
          nodes={flowNodes} onNodesChange={onNodesChange} edges={displayEdges}
          onNodeClick={onNodeClick} onPaneClick={onPaneClick}
          onEdgeClick={(_event, edge) => {
            const ids = edge.data?.pathIds as string[] | undefined;
            if (ids?.length) focusPerson(ids[Math.floor(ids.length / 2)], 1, 0);
          }}
          onInit={inst => { rfInstance.current = inst; fitOverview(); }}
          onMoveEnd={(_event, viewport) => setCamera(viewport)}
          defaultViewport={{ x: 0, y: 0, zoom: 0.04 }}
          minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM}
          translateExtent={detailLevel === 0 ? undefined : [[bounds.x - 300, bounds.y - 300], [bounds.x + bounds.width + 300, bounds.y + bounds.height + 300]]}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} deleteKeyCode={null}
          connectionLineType={ConnectionLineType.SmoothStep} proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(190,165,117,0.12)" gap={36} size={1} />
          <MiniMap nodeColor={(n: Node) => getLineStyle((n.data as Record<string, string>)?.lineage ?? 'neutral').fill}
            nodeStrokeWidth={3} maskColor="rgba(12,12,14,0.6)" pannable zoomable style={{ width: 144, height: 96 }} ariaLabel="Мини-карта родословий" />
        </ReactFlow>
        {!hasCardsInView && canvasSize.width > 0 && <div className="genealogy-empty-view" role="status">
          <p>Карточки остались за пределами экрана</p><button type="button" onClick={resetView}>Вернуться к обзору</button>
        </div>}
      </div>
      <div className="genealogy-navigation" role="group" aria-label="Навигация по карте">
        <div>
          <button type="button" data-genealogy-zoom-in className="react-flow__controls-zoomin" aria-label="Приблизить"
            disabled={camera.zoom >= MAX_ZOOM} onClick={() => void rfInstance.current?.zoomIn({ duration: 0 })}>+</button>
          <button type="button" aria-label="Отдалить" disabled={camera.zoom <= MIN_ZOOM}
            onClick={() => void rfInstance.current?.zoomOut({ duration: 0 })}>−</button>
          <button type="button" data-genealogy-overview className="react-flow__controls-fitview" onClick={resetView}
            aria-label="Обзор древа" title="Обзор древа">⌖</button>
          <button type="button" className="genealogy-minimap-toggle" onClick={() => setShowMiniMap(v => !v)}
            title="Мини-карта" aria-label="Мини-карта" aria-expanded={showMiniMap}>⊞</button>
        </div>
          {eras && <select aria-label="Перейти к эпохе" value="" onChange={e => focusEra(e.target.value)}>
            <option value="" disabled>К эпохе…</option>
            {eras.map(era => <option key={era.id} value={era.id}>{era.name}</option>)}
          </select>}
      </div>
      <div className="genealogy-status">
        <div><strong>{detailLabel}</strong><span>Показано {visibleCount} из {laidNodes.length}</span></div>
        <p>{detailLevel < 2 ? 'Пунктир — путь через скрытые персоны. Нажмите имя, чтобы раскрыть ветвь.' : 'Схема поколений: расстояния не обозначают годы.'}</p>
        {activeId && <button type="button" data-genealogy-focus-count onClick={() => { setActiveId(null); setSelected(null); }}>
          Фокус: {visibleFocusCount} из {focusLineageIds?.size ?? 0} · Сбросить
        </button>}
      </div>
      <DetailPanel person={selected} onClose={() => { if (selected) setKeyboardTarget({ id: selected.id }); setSelected(null); }} />
      {showSplit && <SplitView persons={persons} onClose={() => setShowSplit(false)} />}
      {tourActive && tourPerson && <div className="genealogy-tour" role="group" aria-label="Путешествие по родословию">
        <button type="button" onClick={tourPrev} disabled={tourIndex === 0} aria-label="Предыдущий">←</button>
        <div><strong>{tourPerson.name.ru}</strong><span>Шаг {tourIndex + 1} из {goldenArray.length}</span></div>
        <button type="button" onClick={tourNext} disabled={tourIndex >= goldenArray.length - 1} aria-label="Следующий">→</button>
        <button type="button" onClick={() => { setTourIndex(-1); setSelected(tourPerson); }}>Подробнее</button>
        <button type="button" onClick={() => setTourIndex(-1)} aria-label="Закрыть тур">×</button>
      </div>}
    </div>
  );
}

export default function GenealogyTree(props: GenealogyTreeProps) {
  return (
    <GenealogyErrorBoundary>
      <GenealogyTreeContent {...props} />
    </GenealogyErrorBoundary>
  );
}
