import { Component, useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { ErrorInfo, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ReactFlow, Background, MiniMap, useNodesState,
  type Node, type Edge, ConnectionLineType, type ReactFlowInstance, type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Person, Era, LineageFilter, RuntimeGenealogyRelation } from './types';
import { getLineStyle, NODE_W, NODE_H } from './theme';
import { projectGenealogy, overviewIds, fitGenealogyView, centerOf, getDetailLevel, MIN_ZOOM, MAX_ZOOM, boxesOverlap } from './semanticGraph';
import './GenealogyTree.css';
import { buildLayout, computeFocusLineage } from './layout';
import { matchesLineage } from './focusGraph';
import { PersonCardContent, CompactPersonCard } from './PersonNode';
import { DetailPanel } from './DetailPanel';
import { SplitView } from './SplitView';
import { RelationshipInspector } from './RelationshipInspector';
import {
  automaticGenealogySearchResult,
  genealogySearchOptionContext,
  genealogySearchOptionLabel,
  searchGenealogyPeople,
} from './search';

const LINEAGE_FILTERS = [
  { id: 'all' as LineageFilter, label: 'Все' },
  { id: 'messianic' as LineageFilter, label: 'Мессианская' },
  { id: 'cainite' as LineageFilter, label: 'Каинова' },
  { id: 'neutral' as LineageFilter, label: 'Прочие' },
];

type GenealogyTreeProps = { persons: Person[]; eras?: Era[]; relations?: RuntimeGenealogyRelation[] };
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
        className="genealogy-fallback"
        role="alert"
        aria-live="assertive"
        data-genealogy-fallback
      >
        <div className="genealogy-fallback__content">
          <h2 className="genealogy-fallback__title">
            Интерактивное древо временно не загрузилось
          </h2>
          <p className="genealogy-fallback__copy">
            Основной текст страницы сохранён. Можно повторно запустить только интерактивное древо без перезагрузки страницы.
          </p>
          <button
            className="genealogy-fallback__retry"
            type="button"
            onClick={this.retry}
          >
            Повторить загрузку древа
          </button>
        </div>
      </section>
    );
  }
}

function GenealogyTreeContent({ persons, eras, relations = [] }: GenealogyTreeProps) {
  const treeRoot = useRef<HTMLDivElement | null>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [search, setSearch] = useState('');
  const [searchSelectionId, setSearchSelectionId] = useState<string | null>(null);
  const [searchCursor, setSearchCursor] = useState(-1);
  const [showLineage, setShowLineage] = useState<LineageFilter>('all');
  const [showGolden, setShowGolden] = useState(true);
  const [selected, setSelected] = useState<Person | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<RuntimeGenealogyRelation | null>(null);
  const [relationReturnFocusId, setRelationReturnFocusId] = useState<string | null>(null);
  const splitOpener = useRef<HTMLButtonElement | null>(null);
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

  // ── Search match ──
  const searchResults = useMemo(() => searchGenealogyPeople(persons, search), [persons, search]);
  const visibleSearchResults = useMemo(() => searchResults.slice(0, 8), [searchResults]);
  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;
    if (searchSelectionId) {
      return searchResults.find(result => result.person.id === searchSelectionId)?.person ?? null;
    }
    return automaticGenealogySearchResult(searchResults, search);
  }, [search, searchResults, searchSelectionId]);
  const searchNeedsChoice = Boolean(search.trim() && !searchMatch && searchResults.length > 1);
  const searchListId = 'genealogy-person-search-results';
  const activeSearchOptionId = searchNeedsChoice && searchCursor >= 0 && visibleSearchResults[searchCursor]
    ? `genealogy-search-option-${visibleSearchResults[searchCursor].person.id}`
    : undefined;

  const chooseSearchPerson = useCallback((id: string) => {
    setSearchSelectionId(id);
    setSearchCursor(-1);
    setActiveId(null);
    setSelected(null);
    setSelectedRelation(null);
    setRelationReturnFocusId(null);
  }, []);

  useEffect(() => {
    const node = canvasRoot.current;
    if (!node) return;
    let resizeFrame: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        setCanvasSize(current => current.width === next.width && current.height === next.height ? current : next);
      });
    });
    observer.observe(node);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    return () => {
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      motion.removeEventListener('change', updateMotion);
    };
  }, []);

  const fitOverview = useCallback(() => {
    const ids = overviewIds(laidNodes);
    if (!rfInstance.current || !canvasSize.width || !canvasSize.height) return;
    const viewport = fitGenealogyView(laidNodes.filter(n => ids.has(n.id)), canvasSize.width, canvasSize.height);
    void rfInstance.current.setViewport(viewport, { duration: 0 });
  }, [laidNodes, canvasSize]);

  // Search, filters and resize share one camera decision. In particular, a
  // search that clears an excluding filter must not race a second fit command.
  const lastFrame = useRef({ width: 0, height: 0, filter: '', searchId: null as string | null });
  useEffect(() => {
    const instance = rfInstance.current;
    if (!instance || !canvasSize.width || !canvasSize.height) return;
    const before = lastFrame.current;
    const resized = before.width !== canvasSize.width || before.height !== canvasSize.height;
    const filterChanged = before.filter !== showLineage;
    const searchId = searchMatch?.id ?? null;
    if (searchMatch) {
      const node = laidNodes.find(n => n.id === searchMatch.id);
      if (!node) { setShowLineage('all'); setActiveId(null); setSelected(null); return; }
      if (searchId !== before.searchId || filterChanged || resized) {
        const center = centerOf(node);
        void instance.setCenter(center.x, center.y, { zoom: 1.2, duration: 0 });
      }
    } else if (!before.width || filterChanged || (resized && getDetailLevel(instance.getZoom()) === 0)) {
      fitOverview();
    } else if (resized) {
      const current = instance.getViewport();
      void instance.setViewport({ ...current, x: current.x + (canvasSize.width - before.width) / 2,
        y: current.y + (canvasSize.height - before.height) / 2 }, { duration: 0 });
    }
    lastFrame.current = { ...canvasSize, filter: showLineage, searchId };
  }, [canvasSize, showLineage, searchMatch, laidNodes, fitOverview]);

  const worldExtent = useMemo<[[number, number], [number, number]]>(() => [
    [bounds.x - 300, bounds.y - 300],
    [bounds.x + bounds.width + 300, bounds.y + bounds.height + 300],
  ], [bounds.x, bounds.y, bounds.width, bounds.height]);

  // ── Focus lineage: when activeId is set, compute ancestor+descendant set ──
  const focusLineageIds = useMemo(() => {
    if (!activeId) return null;
    return computeFocusLineage(persons, activeId);
  }, [activeId, persons]);

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
        // Keep ReactFlow's measured node box stable across semantic zoom. The
        // compact card is centred inside it and may overflow visually, which
        // prevents the 154-node ResizeObserver set from thrashing on zoom.
        position: { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 },
        width: NODE_W,
        height: NODE_H,
        style: { width: NODE_W, height: NODE_H, pointerEvents: semanticHidden ? 'none' : 'auto' },
        data: {
          ...cardData,
          label: (
            <div aria-hidden={semanticHidden || undefined} style={{
              position: compact ? 'absolute' : undefined,
              left: compact ? `calc(${(NODE_W - projection.width) / 2}px)` : undefined,
              top: compact ? `calc(${(NODE_H - projection.height) / 2}px)` : undefined,
              width: compact ? projection.width : undefined,
              height: compact ? projection.height : undefined,
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

  // ReactFlow's controlled nodes must retain measured geometry. Replacing the
  // input with fresh objects without `measured` resets the wrappers and can hide
  // the keyboard destination until ResizeObserver measures them again.
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
    setSelectedRelation(null);
    setRelationReturnFocusId(null);
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
    setSelectedRelation(null);
    setRelationReturnFocusId(null);
  }, []);

  const changeLineage = useCallback((filter: LineageFilter) => {
    setShowLineage(filter);
    setSearch('');
    setSearchSelectionId(null);
    setSearchCursor(-1);
    const active = persons.find(person => person.id === activeId);
    if (active && !matchesLineage(active, filter)) setActiveId(null);
    if (selected && !matchesLineage(selected, filter)) setSelected(null);
    setTourIndex(-1);
    setSelectedRelation(null);
    setRelationReturnFocusId(null);
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
    if (e.key === 'Escape' && selectedRelation && target.closest('[data-genealogy-relation-details]')) {
      e.preventDefault();
      e.stopPropagation();
      const returnId = relationReturnFocusId ?? selectedRelation.from;
      setSelectedRelation(null);
      setRelationReturnFocusId(null);
      setKeyboardTarget({ id: returnId });
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
  }, [persons, laidNodes, selected, selectedRelation, relationReturnFocusId, showSplit, focusPerson, detailLevel]);

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
    setShowLineage('all'); setSearch(''); setSearchSelectionId(null); setSearchCursor(-1); setSelected(null); setSelectedRelation(null); setRelationReturnFocusId(null); setTourIndex(0);
    if (goldenArray[0]) focusPerson(goldenArray[0], 1, 0);
  }, [goldenArray, focusPerson]);
  const tourNext = useCallback(() => setTourIndex(i => Math.min(i + 1, goldenArray.length - 1)), [goldenArray.length]);
  const tourPrev = useCallback(() => setTourIndex(i => Math.max(i - 1, 0)), []);
  useEffect(() => {
    if (tourIndex >= 0 && goldenArray[tourIndex]) focusPerson(goldenArray[tourIndex], 1, 0);
  }, [tourIndex, goldenArray, focusPerson]);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const pathIds = edge.data?.pathIds as string[] | undefined;
    if (pathIds?.length) {
      setSelectedRelation(null);
      setRelationReturnFocusId(null);
      focusPerson(pathIds[Math.floor(pathIds.length / 2)], 1, 0);
      return;
    }
    const relation = relations.find(item =>
      item.kind === 'parent' && item.from === edge.source && item.to === edge.target);
    if (!relation) return;
    setSelected(null);
    setRelationReturnFocusId(edge.source);
    setSelectedRelation(relation);
  }, [relations, focusPerson]);

  const handleSearchKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Escape') {
      if (!search) return;
      event.preventDefault();
      setSearch('');
      setSearchSelectionId(null);
      setSearchCursor(-1);
      setActiveId(null);
      setSelected(null);
      setSelectedRelation(null);
      setRelationReturnFocusId(null);
      return;
    }

    if (!searchNeedsChoice) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchCursor(current => {
        if (!visibleSearchResults.length) return -1;
        if (current < 0) return event.key === 'ArrowDown' ? 0 : visibleSearchResults.length - 1;
        return (current + (event.key === 'ArrowDown' ? 1 : -1) + visibleSearchResults.length) % visibleSearchResults.length;
      });
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setSearchCursor(event.key === 'Home' ? 0 : visibleSearchResults.length - 1);
      return;
    }

    if (event.key === 'Enter' && searchCursor >= 0) {
      const result = visibleSearchResults[searchCursor];
      if (!result) return;
      event.preventDefault();
      chooseSearchPerson(result.person.id);
    }
  }, [search, searchNeedsChoice, searchCursor, visibleSearchResults, chooseSearchPerson]);

  const visibleCount = visibleNodeIds.size;
  const visibleFocusCount = focusLineageIds ? laidNodes.filter(n => focusLineageIds.has(n.id) && visibleNodeIds.has(n.id)).length : 0;
  const detailLabel = detailLevel === 0 ? 'Обзор' : detailLevel === 1 ? 'Ключевые' : 'Все детали';
  const resetView = () => { setSearch(''); setSearchSelectionId(null); setSearchCursor(-1); setActiveId(null); setSelected(null); setSelectedRelation(null); setRelationReturnFocusId(null); setTourIndex(-1); fitOverview(); };
  const hasCardsInView = laidNodes.some(node => {
    if (!visibleNodeIds.has(node.id)) return false;
    const center = centerOf(node);
    return boxesOverlap({ x: center.x * camera.zoom + camera.x - 72, y: center.y * camera.zoom + camera.y - 26, width: 144, height: 52 },
      { x: 0, y: 0, ...canvasSize });
  });
  const focusEra = (eraId: string) => {
    const members = laidNodes.filter(n => n.data.era === eraId);
    if (!members.length || !rfInstance.current) return;
    setSearch(''); setSearchSelectionId(null); setSearchCursor(-1); setSelected(null); setSelectedRelation(null); setRelationReturnFocusId(null); setActiveId(null); setTourIndex(-1);
    const first = [...members].sort((a, b) => a.position.y - b.position.y)[0];
    focusPerson(first.id, 1, 0);
  };

  return (
    <div ref={treeRoot} className="genealogy-app" data-genealogy-app data-genealogy-level={detailLevel} data-minimap-open={showMiniMap}
      data-genealogy-active-person={activeId ?? undefined}
      data-genealogy-search-query={search || undefined}
      data-genealogy-search-result-count={searchResults.length}
      data-genealogy-search-needs-choice={searchNeedsChoice ? 'true' : 'false'}
      data-genealogy-search-selection={searchSelectionId ?? undefined}
      data-genealogy-search-person={searchMatch?.id ?? undefined}
      onKeyDownCapture={handleGraphKeyDown}>
      <div className="genealogy-toolbar" role="toolbar" aria-label="Управление древом">
        <div className="genealogy-heading"><h2>Библейские родословия</h2></div>
        <div className="genealogy-primary-tools">
          <div className="genealogy-person-search">
            <input
              type="text"
              role="combobox"
              placeholder="Найти человека…"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setSearchSelectionId(null);
                setSearchCursor(-1);
                setActiveId(null);
                setSelected(null);
                setSelectedRelation(null);
                setRelationReturnFocusId(null);
              }}
              onKeyDown={handleSearchKeyDown}
              aria-label="Поиск по имени"
              aria-autocomplete="list"
              aria-expanded={searchNeedsChoice}
              aria-controls={searchNeedsChoice ? searchListId : undefined}
              aria-activedescendant={activeSearchOptionId}
            />
            {searchNeedsChoice && (
              <div
                id={searchListId}
                className="genealogy-search-popover"
                role="listbox"
                aria-label="Люди с похожим именем"
              >
                {visibleSearchResults.map((result, index) => (
                  <div
                    key={result.person.id}
                    id={`genealogy-search-option-${result.person.id}`}
                    role="option"
                    aria-selected={searchCursor === index}
                    data-person-id={result.person.id}
                    aria-label={genealogySearchOptionLabel(result.person)}
                    onPointerDown={event => {
                      event.preventDefault();
                      chooseSearchPerson(result.person.id);
                    }}
                  >
                    <strong>{result.person.name.ru}</strong>
                    <span>{genealogySearchOptionContext(result.person)}</span>
                  </div>
                ))}
                {searchResults.length > visibleSearchResults.length && (
                  <p>Ещё {searchResults.length - visibleSearchResults.length} — уточните запрос</p>
                )}
              </div>
            )}
            {Boolean(search.trim()) && searchResults.length === 0 && (
              <div className="genealogy-search-empty" role="status">Ничего не найдено</div>
            )}
          </div>
          <button ref={splitOpener} type="button" onClick={() => setShowSplit(true)} title="Сравнить Мф/Лк">Мф / Лк</button>
          <button type="button" onClick={startTour} title="Тур" aria-label="Пройти мессианскую нить">Тур</button>
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
          onEdgeClick={onEdgeClick}
          onInit={inst => { rfInstance.current = inst; fitOverview(); }}
          onMoveEnd={(_event, viewport) => setCamera(current => current.x === viewport.x && current.y === viewport.y && current.zoom === viewport.zoom ? current : viewport)}
          defaultViewport={{ x: 0, y: 0, zoom: 0.04 }}
          minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM}
          translateExtent={worldExtent}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} deleteKeyCode={null}
          connectionLineType={ConnectionLineType.SmoothStep} proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(190,165,117,0.12)" gap={36} size={1} />
          <MiniMap nodeColor={(n: Node) => getLineStyle((n.data as Record<string, string>)?.lineage ?? 'neutral').fill}
            nodeStrokeWidth={3} maskColor="var(--genealogy-minimap-mask)" pannable zoomable style={{ width: 144, height: 96 }} ariaLabel="Мини-карта родословий" />
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
        {activeId && <button type="button" data-genealogy-focus-count onClick={() => { setActiveId(null); setSelected(null); setSelectedRelation(null); setRelationReturnFocusId(null); }}>
          Фокус: {visibleFocusCount} из {focusLineageIds?.size ?? 0} · Сбросить
        </button>}
      </div>
      <DetailPanel
        person={selected}
        persons={persons}
        relations={relations}
        onInspectRelation={relation => {
          const returnId = selected?.id ?? null;
          setSelected(null);
          setRelationReturnFocusId(returnId);
          setSelectedRelation(relation);
        }}
        onNavigatePerson={personId => {
          const target = persons.find(person => person.id === personId);
          if (!target) return;
          setSelectedRelation(null);
          setRelationReturnFocusId(null);
          setActiveId(personId);
          setSelected(target);
          focusPerson(personId, 1, 0);
        }}
        onClose={() => {
          if (selected) setKeyboardTarget({ id: selected.id });
          setSelected(null);
        }}
      />
      <RelationshipInspector
        relation={selectedRelation}
        persons={persons}
        onClose={() => {
          const returnId = relationReturnFocusId ?? selectedRelation?.from ?? null;
          setSelectedRelation(null);
          setRelationReturnFocusId(null);
          if (returnId) setKeyboardTarget({ id: returnId });
        }}
      />
      {showSplit && <SplitView persons={persons} returnFocusTo={splitOpener.current} onClose={() => setShowSplit(false)} />}
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
