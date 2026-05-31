import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Fuse, { type FuseResultMatch } from 'fuse.js'
import type { ArticleClientMeta } from '../data/types'
import { categories, NON_CHEF_CATEGORY_IDS } from '../data/categories'
import { pluralRu, MATERIAL, RESULT } from '../utils/plural'
import { safeGetItem } from '../utils/storage'
import { highlightWithMatches } from '../utils/highlight'
import { ARTICLE_FUSE_OPTIONS } from '../utils/search'

interface CommandPaletteProps {
  open: boolean
  articles: ArticleClientMeta[]
  onClose: () => void
  onOpenArticle: (article: ArticleClientMeta) => void
  onSelectCategory?: (id: string) => void
}

interface ArticleResult {
  item: ArticleClientMeta
  matches?: ReadonlyArray<FuseResultMatch>
  pct?: number
}

function H({ text, matches, field }: {
  text: string
  matches: ReadonlyArray<FuseResultMatch> | undefined
  field: string
}) {
  return <>{highlightWithMatches(text, matches, field)}</>
}

interface QuickAction {
  id: string
  label: string
  sublabel?: string
  icon: string
  action: () => void
}

function ArticleImage({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) {
  const [loaded, setLoaded]   = useState(false)
  const [errored, setErrored] = useState(false)
  useEffect(() => { setLoaded(false); setErrored(false) }, [src])
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {!loaded && !errored && <div className="cp-skeleton" style={{ position: 'absolute', inset: 0 }} />}
      {!errored && (
        <img src={src} alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => { setErrored(true); setLoaded(false) }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.45s ease' }}
        />
      )}
      {errored && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--cp-chip)', fontSize: 16, color: 'var(--cp-text-mid)' }}>
          ✦
        </div>
      )}
    </div>
  )
}

export default function CommandPalette({ open, articles, onClose, onOpenArticle, onSelectCategory }: CommandPaletteProps) {
  const [query, setQuery]             = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [filterCat, setFilterCat]     = useState<string | null>(null)
  const [wideEnough, setWideEnough]   = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 640 : true)
  const inputRef     = useRef<HTMLInputElement>(null)
  const listRef      = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    const onResize = () => setWideEnough(window.innerWidth >= 640)
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const fuse = useMemo(() => new Fuse<ArticleClientMeta>(articles, ARTICLE_FUSE_OPTIONS), [articles])

  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0); setFilterCat(null); requestAnimationFrame(() => inputRef.current?.focus()) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const w = window.innerWidth - document.documentElement.clientWidth
    const prevO = document.body.style.overflow, prevP = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (w > 0) document.body.style.paddingRight = `${w}px`
    return () => { document.body.style.overflow = prevO; document.body.style.paddingRight = prevP }
  }, [open])

  // Re-read localStorage every time palette opens so "Недавно читали" is always fresh
  const recentArticles = useMemo<Array<{ article: ArticleClientMeta; pct: number }>>(() => {
    return articles
      .map(a => ({ article: a, ts: Number(safeGetItem(`article-last-read:${a.id}`) ?? 0), pct: Number(safeGetItem(`article-progress-pct:${a.id}`) ?? 0) }))
      .filter(x => x.ts > 0 || x.pct > 0).sort((a, b) => b.ts - a.ts).slice(0, 5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, open])

  const quickActions: QuickAction[] = useMemo(() => {
    if (!onSelectCategory) return []
    const chefCats = categories.filter(c => !NON_CHEF_CATEGORY_IDS.has(c.id))
    return [
      { id:'nav-techniques', label:'Техники', sublabel:'Все техники кондитерского искусства', icon:'TK', action:()=>{ onSelectCategory('techniques'); onClose() } },
      { id:'nav-recipes', label:'Рецепты', sublabel:'Практические карты сборки', icon:'RC', action:()=>{ onSelectCategory('recipes'); onClose() } },
      ...chefCats.map(c => ({ id:`nav-${c.id}`, label:c.name, sublabel:c.description, icon:c.icon, action:()=>{ onSelectCategory(c.id); onClose() } })),
    ]
  }, [onSelectCategory, onClose])

  const articleResults: ArticleResult[] = useMemo(() => {
    const trimmed = query.trim()
    let base: ArticleResult[]
    if (!trimmed) {
      base = recentArticles.length > 0
        ? recentArticles.map(r => ({ item: r.article, pct: r.pct }))
        : articles.slice(0, 10).map(a => ({ item: a }))
    } else {
      base = fuse.search(trimmed, { limit: 12 }).map(r => ({ item: r.item, matches: r.matches as ReadonlyArray<FuseResultMatch> | undefined }))
    }
    return filterCat ? base.filter(r => r.item.category === filterCat) : base
  }, [articles, fuse, query, recentArticles, filterCat])

  const chipCategories = useMemo(() => {
    const seen = new Set<string>(); const chips: typeof categories = []
    for (const r of articleResults) {
      if (!seen.has(r.item.category)) { seen.add(r.item.category); const cat = categories.find(c => c.id === r.item.category); if (cat) chips.push(cat) }
      if (chips.length >= 7) break
    }
    return chips
  }, [articleResults])

  const showChips        = chipCategories.length > 1
  const showQuickActions = !query.trim() && !filterCat && quickActions.length > 0
  const totalItems       = (showQuickActions ? quickActions.length : 0) + articleResults.length

  useEffect(() => { setActiveIndex(0) }, [articleResults.length, query, filterCat])
  useEffect(() => {
    const buttons = listRef.current?.querySelectorAll('button[data-item]')
    const el = buttons?.[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  const activeResult: ArticleResult | null = useMemo(() => {
    // When a quick-action is highlighted there is no article to preview;
    // returning null lets the panel render a dedicated quick-action card
    // (see activeQuickAction below) instead of staying empty.
    if (showQuickActions && activeIndex < quickActions.length) return null
    const idx = showQuickActions ? activeIndex - quickActions.length : activeIndex
    return articleResults[idx] ?? null
  }, [activeIndex, showQuickActions, quickActions.length, articleResults])

  /** The quick-action currently highlighted by ↑/↓ — populates the preview panel. */
  const activeQuickAction: QuickAction | null = useMemo(() => {
    if (!showQuickActions) return null
    if (activeIndex >= quickActions.length) return null
    return quickActions[activeIndex] ?? null
  }, [showQuickActions, activeIndex, quickActions])

  const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === 'Tab') {
      const container = containerRef.current; if (!container) return
      const focusable = Array.from(container.querySelectorAll<HTMLElement>('input, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(el => !el.closest('[aria-hidden]'))
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation?.()
      // FIX CP-1: first Escape clears the query; second Escape closes the palette
      if (query.trim()) {
        setQuery('')
        setFilterCat(null)
        return
      }
      onClose()
      return
    }
    if (totalItems === 0) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIndex(i => (i + 1) % totalItems) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => (i - 1 + totalItems) % totalItems) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (showQuickActions && activeIndex < quickActions.length) { quickActions[activeIndex].action() }
      else { const idx = showQuickActions ? activeIndex - quickActions.length : activeIndex; const result = articleResults[idx]; if (result) { onClose(); onOpenArticle(result.item) } }
    }
  }, [totalItems, showQuickActions, quickActions, articleResults, activeIndex, onClose, onOpenArticle, query])

  const spring = shouldReduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 480, damping: 38, mass: 0.85 }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center px-4"
            style={{
              background: 'rgba(5,4,3,0.88)',
              backdropFilter: 'blur(22px) saturate(130%)',
              paddingTop: 'max(5svh, env(safe-area-inset-top, 20px))',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            initial={shouldReduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={shouldReduce ? { duration: 0 } : { duration: 0.18 }}
            onClick={onClose}
          >
            <motion.div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Поиск по материалам"
              className="w-full overflow-hidden"
              style={{
                maxWidth: 760, borderRadius: '16px',
                maxHeight: 'min(92svh, 92vh)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-command)',
                border: '1px solid var(--cp-chip-border)',
                boxShadow: '0 0 0 1px var(--cp-inset-1) inset, 0 1px 0 var(--cp-inset-2) inset, 0 50px 130px rgba(0,0,0,0.55), 0 20px 40px rgba(0,0,0,0.30)',
              }}
              initial={shouldReduce ? false : { y: -22, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={shouldReduce ? { opacity: 0 } : { y: -14, scale: 0.97, opacity: 0 }}
              transition={spring}
              onClick={e => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            >
              {/* Search bar */}
              <div className="flex items-center gap-3 px-5 shrink-0" style={{ height: 54 }}>
                <motion.svg
                  className="h-[15px] w-[15px] shrink-0"
                  animate={{ opacity: query ? 0.6 : 0.28, color: query ? 'var(--text-accent)' : 'var(--text-primary)' }}
                  transition={{ duration: 0.2 }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </motion.svg>

                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setFilterCat(null) }}
                  placeholder="Поиск материалов, шефов, техник..."
                  aria-label="Поиск материалов, шефов и техник"
                  className="flex-1 bg-transparent text-[16px] md:text-[14px] font-light tracking-wide outline-none"
                  style={{ caretColor: 'var(--text-accent)', color: 'var(--text-primary)' }}
                />

                <AnimatePresence>
                  {query && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="font-mono text-[9px] uppercase tracking-[0.18em] shrink-0"
                      style={{ color: 'var(--text-accent)', opacity: 0.6 }}
                    >
                      {articleResults.length}&nbsp;{pluralRu(articleResults.length, RESULT)}
                    </motion.span>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {query && (
                    <motion.button
                      type="button" aria-label="Очистить поиск"
                      initial={{ opacity: 0, scale: 0.6, rotate: -45 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                      onClick={() => { setQuery(''); setFilterCat(null); inputRef.current?.focus() }}
                      className="flex h-5 w-5 shrink-0 items-center justify-center"
                      style={{ background: 'var(--cp-clear-bg)', color: 'var(--cp-clear-fg)', fontSize: 14, lineHeight: 1, borderRadius: 2 }}
                    >×</motion.button>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-[8px] uppercase tracking-[0.32em] shrink-0 transition-opacity"
                  style={{ color: 'var(--cp-text-mid)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >ESC</button>
              </div>

              <div style={{ height: 1, background: 'var(--cp-divider)', flexShrink: 0 }} />

              {/* Category chips */}
              <AnimatePresence>
                {showChips && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    style={{ overflow: 'hidden', flexShrink: 0 }}
                  >
                    <div className="cp-chips flex items-center gap-1.5 overflow-x-auto px-5 py-2" style={{ borderBottom: '1px solid var(--cp-divider)' }}>
                      <button
                        type="button" onClick={() => setFilterCat(null)}
                        className="cp-chip shrink-0 font-mono text-[7.5px] uppercase tracking-[0.2em] transition-all"
                        style={{ padding: '4px 10px', borderRadius: 2, background: !filterCat ? 'var(--text-accent)' : 'var(--cp-chip)', color: !filterCat ? 'var(--bg-main)' : 'var(--text-muted)', border: '1px solid', borderColor: !filterCat ? 'transparent' : 'var(--cp-chip-border)' }}
                      >Все</button>
                      {chipCategories.map(cat => (
                        <motion.button
                          key={cat.id} type="button" layout
                          onClick={() => setFilterCat(prev => prev === cat.id ? null : cat.id)}
                          className="cp-chip shrink-0 font-mono text-[7.5px] uppercase tracking-[0.15em] transition-all"
                          style={{ padding: '4px 10px', borderRadius: 2, whiteSpace: 'nowrap', background: filterCat === cat.id ? 'var(--text-accent)' : 'var(--cp-chip)', color: filterCat === cat.id ? 'var(--bg-main)' : 'var(--text-muted)', border: '1px solid', borderColor: filterCat === cat.id ? 'transparent' : 'var(--cp-chip-border)' }}
                        >
                          <span style={{ marginRight: 4, opacity: 0.65 }}>{cat.icon}</span>{cat.name}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Body */}
              <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 0, flex: 1, overflow: 'hidden' }}>
                {/* Left: list */}
                <div ref={listRef} className="cp-list min-w-0 flex-1 overflow-y-auto" style={{ maxHeight: 'min(58svh, 60vh)' }}>

                  {/* Quick actions */}
                  {showQuickActions && (
                    <div>
                      <SectionLabel>Перейти</SectionLabel>
                      <div className="pb-1">
                        {quickActions.map((action, idx) => {
                          const isActive = idx === activeIndex
                          return (
                            <button key={action.id} type="button" data-item onClick={action.action} onMouseEnter={() => setActiveIndex(idx)}
                              className="flex w-full items-center gap-3 px-5 py-2.5 text-left"
                              style={{ background: isActive ? 'var(--cp-surface)' : 'transparent', borderLeft: isActive ? '2px solid var(--text-accent)' : '2px solid transparent', transition: 'all 0.09s ease' }}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center font-mono text-[7px] font-bold uppercase"
                                style={{ borderRadius: 2, background: isActive ? 'var(--text-accent)' : 'var(--cp-chip)', color: isActive ? 'var(--bg-main)' : 'var(--text-muted)', transition: 'all 0.09s ease' }}
                              >{action.icon}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-normal" style={{ color: 'var(--text-primary)' }}>{action.label}</p>
                                {action.sublabel && <p className="truncate font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{action.sublabel}</p>}
                              </div>
                              <ArrowRight />
                            </button>
                          )
                        })}
                      </div>
                      <Divider />
                    </div>
                  )}

                  {/* Section label */}
                  {articleResults.length > 0 && (
                    <div className="flex items-center justify-between px-5 pb-1 pt-3">
                      <SectionLabel inline>
                        {query.trim() ? `${articleResults.length} ${pluralRu(articleResults.length, RESULT)}` : recentArticles.length > 0 ? 'Недавно читали' : 'Материалы'}
                      </SectionLabel>
                      {filterCat && (
                        <button type="button" onClick={() => setFilterCat(null)}
                          className="font-mono text-[7.5px] uppercase tracking-[0.18em] transition-opacity"
                          style={{ color: 'var(--text-accent)', opacity: 0.65 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
                        >× сбросить</button>
                      )}
                    </div>
                  )}

                  {/* Article rows */}
                  <div className="pb-2">
                    <AnimatePresence initial={false} mode="popLayout">
                      {articleResults.map((result, idx) => {
                        const article   = result.item
                        const cat       = categories.find(c => c.id === article.category)
                        const globalIdx = showQuickActions ? quickActions.length + idx : idx
                        const isActive  = globalIdx === activeIndex
                        const byAuthor  = !!result.matches?.find(m => m.key === 'author')?.indices?.length

                        return (
                          <motion.button
                            key={article.id} type="button" data-item layout
                            initial={shouldReduce ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldReduce ? {} : { opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                            transition={shouldReduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32, delay: Math.min(idx * 0.02, 0.14) }}
                            onClick={() => { onClose(); onOpenArticle(article) }}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                            className="flex w-full items-start gap-3 px-5 py-3 text-left"
                            style={{ background: isActive ? 'var(--cp-surface)' : 'transparent', borderLeft: isActive ? '2px solid var(--text-accent)' : '2px solid transparent', transition: 'background 0.1s ease, border-color 0.08s ease' }}
                          >
                            {/* Thumbnail */}
                            <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
                              {article.image ? (
                                <ArticleImage src={article.image} alt="" style={{ width: 52, height: 52, borderRadius: 2 }} />
                              ) : (
                                <div style={{ width: 52, height: 52, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--text-accent)' : 'var(--cp-chip)', color: isActive ? 'var(--bg-main)' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.1s ease' }}>
                                  {cat?.icon ?? '·'}
                                </div>
                              )}

                              {(result.pct ?? 0) > 0 && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: `${result.pct}%`, background: 'var(--text-accent)', borderRadius: '0 0 0 2px' }} />
                              )}

                              {isActive && article.image && (
                                <motion.div layoutId="cp-active-ring"
                                  style={{ position: 'absolute', inset: -1, border: '1.5px solid var(--text-accent)', borderRadius: 3, opacity: 0.5, pointerEvents: 'none' }}
                                  transition={{ type: 'spring', stiffness: 600, damping: 42 }}
                                />
                              )}
                            </div>

                            {/* Text */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p className="truncate text-[13px] font-normal leading-snug" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.1s ease' }}>
                                <H text={article.title} matches={result.matches} field="title" />
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[9px]" style={{ color: 'var(--cp-text-mid)' }}>
                                <span style={{ opacity: 0.7 }}>{cat?.icon ?? '·'}</span>{' '}{cat?.name ?? article.category}{' · '}{article.readTime} мин
                                {article.author && <>{' · '}<span style={byAuthor ? { color: 'var(--text-accent)', opacity: 0.8 } : undefined}><H text={article.author} matches={result.matches} field="author" /></span></>}
                              </p>
                              <AnimatePresence>
                                {isActive && (article.tags ?? []).length > 0 && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 6 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                    className="flex flex-wrap gap-1 overflow-hidden"
                                  >
                                    {(article.tags ?? []).slice(0, 4).map(tag => (
                                      <span key={tag} className="font-mono text-[7.5px] uppercase tracking-[0.12em]"
                                        style={{ padding: '2px 6px', border: '1px solid var(--cp-chip-border)', color: 'var(--cp-text-mid)', borderRadius: 2 }}>
                                        #{tag}
                                      </span>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.button>
                        )
                      })}
                    </AnimatePresence>

                    {articleResults.length === 0 && query.trim() && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="px-5 py-12 text-center">
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center font-mono text-base"
                          style={{ background: 'var(--cp-chip)', borderRadius: 4, color: 'var(--cp-text-mid)' }}>∅</div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>Ничего не найдено</p>
                        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--cp-text-mid)' }}>«{query}»</p>
                        <p className="mt-3 font-mono text-[8.5px]" style={{ color: 'var(--cp-text-lo)' }}>Попробуйте: шоколад · ваниль · крем · техники</p>
                      </motion.div>
                    )}

                    {articleResults.length === 0 && !query.trim() && (
                      <div className="px-5 py-10 text-center">
                        <p className="font-mono text-[9px] uppercase tracking-[0.28em]" style={{ color: 'var(--cp-text-mid)' }}>Начните вводить для поиска</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: preview panel (sm+ only) */}
                <AnimatePresence mode="wait">
                  {activeQuickAction && wideEnough && (
                    <motion.div
                      key={`qa-${activeQuickAction.id}`}
                      initial={shouldReduce ? false : { opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, x: 10 }}
                      transition={shouldReduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                      style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--cp-divider)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 18px' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cp-chip)', border: '1px solid var(--cp-chip-border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-accent)', letterSpacing: '0.08em' }}>
                          {activeQuickAction.icon}
                        </div>
                        <p className="font-mono text-[8.5px] uppercase tracking-[0.32em]" style={{ color: 'var(--cp-text-mid)' }}>Раздел архива</p>
                        <p className="font-serif text-[19px] font-semibold leading-tight tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>
                          {activeQuickAction.label}
                        </p>
                        {activeQuickAction.sublabel && (
                          <p className="text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>
                            {activeQuickAction.sublabel}
                          </p>
                        )}
                        <button type="button" onClick={activeQuickAction.action}
                          className="mt-3 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.22em] transition-all"
                          style={{ color: 'var(--text-accent)', opacity: 0.85, alignSelf: 'flex-start', padding: '4px 0' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
                        >
                          Открыть
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                  {activeResult && wideEnough && (
                    <motion.div
                      key={activeResult.item.id}
                      initial={shouldReduce ? false : { opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, x: 10 }}
                      transition={shouldReduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                      style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--cp-divider)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                      className="flex"
                    >
                      <div style={{ position: 'relative', height: 200, flexShrink: 0 }}>
                        {activeResult.item.image ? (
                          <ArticleImage src={activeResult.item.image} alt={activeResult.item.title} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'var(--cp-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.15, color: 'var(--text-primary)' }}>
                            {categories.find(c => c.id === activeResult.item.category)?.icon ?? '✦'}
                          </div>
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.04) 30%, var(--bg-command) 100%)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', top: 10, left: 10, padding: '3px 8px', background: 'var(--cp-badge-scrim)', backdropFilter: 'blur(10px)', border: '1px solid var(--cp-chip-border)', borderRadius: 2 }}>
                          <span className="font-mono text-[7px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                            {categories.find(c => c.id === activeResult.item.category)?.icon}{' '}
                            {categories.find(c => c.id === activeResult.item.category)?.name ?? activeResult.item.category}
                          </span>
                        </div>
                        {(activeResult.pct ?? 0) > 0 && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--cp-chip)' }}>
                            <div style={{ height: '100%', width: `${activeResult.pct}%`, background: 'var(--text-accent)' }} />
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '14px 16px 12px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p className="text-[13px] font-normal" style={{ color: 'var(--text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          <H text={activeResult.item.title} matches={activeResult.matches} field="title" />
                        </p>
                        {activeResult.item.excerpt && (
                          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            <H text={activeResult.item.excerpt} matches={activeResult.matches} field="excerpt" />
                          </p>
                        )}
                        <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: 'var(--cp-text-mid)' }}>
                          <span>{activeResult.item.readTime} мин</span>
                          {activeResult.item.date && <><span style={{ opacity: 0.4 }}>·</span><span>{new Date(activeResult.item.date).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}</span></>}
                        </div>
                        {(activeResult.item.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(activeResult.item.tags ?? []).slice(0, 3).map(tag => (
                              <span key={tag} className="font-mono text-[7px] uppercase tracking-[0.1em]"
                                style={{ padding: '2px 6px', border: '1px solid var(--cp-chip-border)', color: 'var(--cp-text-mid)', borderRadius: 2 }}>{tag}</span>
                            ))}
                          </div>
                        )}
                        <button type="button" onClick={() => { onClose(); onOpenArticle(activeResult.item) }}
                          className="mt-auto flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.22em] transition-all"
                          style={{ color: 'var(--text-accent)', opacity: 0.65, alignSelf: 'flex-start', padding: '4px 0' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
                        >
                          Читать
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--cp-divider)' }}>
                <div className="flex items-center gap-5 font-mono text-[7.5px] uppercase tracking-[0.24em]" style={{ color: 'var(--cp-text-mid)' }}>
                  <span>↑↓ навигация</span>
                  <span>↵ открыть</span>
                  <span className="hidden sm:inline">esc закрыть</span>
                </div>
                <span className="font-mono text-[7.5px] uppercase tracking-[0.2em]" style={{ color: 'var(--cp-text-lo)' }}>
                  {articles.length}&thinsp;{pluralRu(articles.length, MATERIAL)}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function SectionLabel({ children, inline }: { children: ReactNode; inline?: boolean }) {
  if (inline) return <span className="font-mono text-[8px] uppercase tracking-[0.36em]" style={{ color: 'var(--cp-text-mid)' }}>{children}</span>
  return <div className="px-5 pb-1 pt-3"><span className="font-mono text-[8px] uppercase tracking-[0.36em]" style={{ color: 'var(--cp-text-mid)' }}>{children}</span></div>
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--cp-divider)', margin: '2px 20px 2px' }} />
}

function ArrowRight() {
  return (
    <svg className="h-3 w-3 shrink-0" style={{ color: 'var(--cp-text-mid)' }}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
