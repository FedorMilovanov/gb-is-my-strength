import { useState, useEffect, useCallback, useMemo, useRef, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Article } from '../data/types'
import type { ArticleClientMeta } from '../data/types'
import { categories } from '../data/categories'
import { fallbackImageFor } from '../assets/images'
import ArticleActions from './ArticleActions'
import ReadingTime from './ReadingTime'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { calculateReadingStreak } from '../utils/streak'
import { pluralRu, HEADING } from '../utils/plural'
import { showToast } from './Toast'
import { useScrollProgress as useSharedScrollProgress } from '../hooks/useScrollProgress'

interface ArticleViewProps {
  article: Article
  /** All article metadata — used for related articles. Passed as prop to avoid bundling library.ts. */
  allArticles: ArticleClientMeta[]
  onBack: () => void
  onNavigate?: (article: ArticleClientMeta) => void
  /** Prevent article-level Escape navigation while another modal/dialog is open. */
  disableEscapeBack?: boolean
}

// Разбивает блок текста на параграфы. Если есть **bold heading** в начале строки,
// он становится отдельным параграфом, чтобы корректно отрендериться как заголовок.
function splitInlineBlocks(text: string): string[] {
  const lines = text.split('\n')
  const result: string[] = []
  let current: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    // Если строка целиком — это **bold заголовок**, выносим её отдельно
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      if (current.length) { result.push(current.join('\n')); current = [] }
      result.push(trimmed)
    } else {
      current.push(line)
    }
  }
  if (current.length) result.push(current.join('\n'))
  return result
}

const TERMS: Record<string, string> = {
  ganache: 'ганаш: эмульсия шоколада со сливками',
  'crème diplomate': 'дипломатический крем: заварной крем со взбитыми сливками',
  'crème pâtissière': 'заварной кондитерский крем',
  'ganache montée': 'взбитый ганаш',
  macaronage: 'макаронаж: вымешивание массы для макарон',
  panade: 'заваренная масса до добавления яиц',
  'pâte à choux': 'заварное тесто для эклеров и шу',
  'fleur de sel': 'цветочная морская соль',
  maturation: 'созревание: выдержка для стабилизации',
  ruban: 'лента: стадия массы, когда она стекает лентой',
  'mise en place': 'подготовка ингредиентов и рабочего места',
}
const TERMS_PATTERN = /\b(crème diplomate|crème pâtissière|ganache montée|pâte à choux|fleur de sel|mise en place|macaronage|maturation|ganache|panade|ruban)\b/gi
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
// NOTE: Lookbehind assertions ((?<=...) / (?<!...)) crash iOS Safari <16.4 at
// parse time with a SyntaxError — the whole component fails to mount. This
// regex achieves the same semantic without any lookbehind:
//   **bold** — greedy, takes priority in the alternation
//   *italic* — content must start AND end with a non-whitespace, non-asterisk char
const FORMAT_REGEX = /(\*\*.*?\*\*|\*(?!\*|\s)(?:[^\s*][^*]*[^\s*]|[^\s*])\*)/g;

function TermTooltip({ piece, translation, tipId }: { piece: string, translation: string, tipId: string }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Close on outside click + Escape — onBlur alone closes prematurely if the
  // user tabs into the tooltip itself, and offers no escape hatch on touch.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation?.()
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <button
      ref={btnRef}
      type="button"
      className="relative inline-flex cursor-help touch-manipulation items-baseline border-0 border-b border-amber-700/40 bg-transparent p-0 text-left text-stone-900 [font:inherit] dark:text-amber-200"
      aria-describedby={open ? tipId : undefined}
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
    >
      {piece}
      <span id={tipId} role="tooltip" aria-hidden={!open} className={`absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[calc(100vw-2rem)] sm:max-w-[256px] -translate-x-1/2 border border-stone-200 bg-[var(--bg-main)] px-3 py-2 text-xs leading-5 text-stone-700 shadow-xl transition-opacity dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ pointerEvents: open ? 'auto' : 'none' }}>
        {translation}
      </span>
    </button>
  )
}

function MiloviCakeArticleNote() {
  return (
    <aside className="my-10 overflow-hidden border border-amber-900/15 bg-[linear-gradient(135deg,rgba(146,64,14,0.08),rgba(255,251,235,0.58)_46%,rgba(255,255,255,0.38))] px-6 py-6 shadow-sm dark:border-amber-400/15 dark:bg-[linear-gradient(135deg,rgba(146,64,14,0.18),rgba(28,25,23,0.72)_48%,rgba(12,10,9,0.9))] sm:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-800/80 dark:text-amber-400/80">
            Patisserie Russe · проект Milovi Cake
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400 sm:text-base sm:leading-7">
            Эта статья — часть образовательной библиотеки Milovi Cake о французской pâtisserie: без меню и обещаний, только история, техники и аккуратные учебные разборы.
          </p>
        </div>
        <a
          href="https://milovicake.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-shrink-0 items-center justify-center border border-amber-900/25 bg-white/50 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-stone-950 transition hover:border-amber-800 hover:bg-amber-100/70 hover:text-amber-900 dark:border-amber-400/25 dark:bg-stone-950/35 dark:text-amber-100 dark:hover:border-amber-300 dark:hover:bg-amber-400/10 dark:hover:text-amber-200"
          aria-label="Перейти на основной сайт Milovi Cake"
        >
          Milovi Cake →
        </a>
      </div>
    </aside>
  )
}

function InlineText({ text }: { text: string }) {
  const uid = useId()
  if (!text) return null

  const renderTermText = (value: string, keyPrefix: string) => {
    return value.split(TERMS_PATTERN).filter(Boolean).map((piece, index) => {
      const translation = TERMS[piece.toLowerCase()]
      if (!translation) return <span key={`${keyPrefix}-${index}`}>{piece}</span>
      return <TermTooltip key={`${keyPrefix}-${index}`} piece={piece} translation={translation} tipId={`${uid}-${keyPrefix}-tip-${index}`} />
    })
  }

  const parts = text.split(LINK_REGEX);
  return (
    <>
      {parts.flatMap((part, index) => {
        // FIX: use flatMap + include outer `index` in every key to guarantee
        // uniqueness across sibling text segments. Previously `key="f-0"` could
        // appear multiple times when a text had more than one plain-text chunk.
        if (index % 3 === 0) {
          const lIdx = Math.floor(index / 3);
          const fParts = part.split(FORMAT_REGEX).filter(Boolean);
          return fParts.map((fPart, i) => {
            const key = `txt-${index}-${i}`;
            if (fPart.startsWith('**') && fPart.endsWith('**')) return <strong key={key} className="font-semibold smart-highlight">{fPart.slice(2, -2)}</strong>;
            if (fPart.startsWith('*') && fPart.endsWith('*')) return <em key={key} className="italic text-stone-800 dark:text-stone-300">{fPart.slice(1, -1)}</em>;
            return <span key={key}>{renderTermText(fPart, `term-${lIdx}-${i}`)}</span>;
          });
        }
        if (index % 3 === 1) {
          const lIdx = Math.floor(index / 3);
          const linkHref = parts[lIdx * 3 + 2] ?? '#';
          return [
            <a key={`link-${lIdx}`} href={linkHref} target="_blank" rel="noopener noreferrer" className="text-amber-800 underline transition hover:text-stone-950 dark:text-amber-400 dark:hover:text-amber-300">
              {part}
            </a>
          ];
        }
        // index % 3 === 2: href segment, already consumed above
        return [];
      })}
    </>
  )
}


function isSectionTitle(text: string) {
  const words = text.trim().split(/\s+/)
  if (words.length < 3) return false
  // Normalise diacritics first so accented French heading like "PÂTE À CHOUX"
  // is correctly identified as all-caps regardless of locale-specific rules.
  const ascii = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // eslint-disable-next-line no-useless-escape -- keep hyphen escaped to avoid accidental range if class is reordered
  const compact = ascii.replace(/[\s\d:.,;()'«»—–\-]/g, '')
  if (!compact) return false
  return compact === compact.toUpperCase() && /[A-ZА-ЯЁ]/.test(compact) && text.length < 150 && !text.includes('*')
}

function slugify(text: string) {
  // NFD splits 'é' → 'e' + combining acute, then we drop combining marks.
  // Result: French accented words ("crème brûlée") and any other diacritics
  // produce stable ASCII / Cyrillic-only ids that match between the headings
  // useMemo and the rendered <h2 id={...}>.
  const ascii = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return ascii.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '')
}

function headingId(text: string, index: number) {
  return `h-${slugify(text)}-${index}`
}

export default function ArticleView({ article, allArticles, onBack, onNavigate, disableEscapeBack = false }: ArticleViewProps) {
  const category = categories.find((c) => c.id === article.category)
  const imageWidth = article.imageWidth ?? 1280
  const imageHeight = article.imageHeight ?? 800
  const isPortraitHero = imageHeight > imageWidth
  const heroAspectRatio = `${imageWidth} / ${imageHeight}`
  // BUG FIX: removed duplicate local useScrollProgress that registered a second scroll
  // listener. Use the shared hook (returns 0-100) and normalise to 0-1 here so all
  // internal usages (progress * 100, 1 - progress, progress > 0.05) stay consistent.
  const progress = useSharedScrollProgress() / 100
  // Preferences are mirrored on <html> by BaseLayout's pre-paint script.
  // Reading those classes here prevents the visible largeText/focusMode CLS that
  // would otherwise happen after useEffect.
  const [largeText, setLargeText] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('pref-large-text'))
  const [focusMode, setFocusMode] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('focus-mode-active'))
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimeoutRef = useRef<number | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [resumePosition, setResumePosition] = useState(0)
  // F-18: ref to the floating TOC <details> element so we can close it after navigation
  const detailsTocRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const savedPos = Number(safeGetItem(`article-progress:${article.id}`) ?? 0)
    setResumePosition(savedPos > 360 ? savedPos : 0)
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
    setSaved(safeGetItem(`article-saved:${article.id}`) === 'true')
    // F-06: record timestamp of last visit so DashboardBento shows truly last-read article
    safeSetItem(`article-last-read:${article.id}`, String(Date.now()))
  }, [article.id])

  useEffect(() => {
    let streakMarked = false
    const save = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const pct = scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 0
      if (window.scrollY > 24 || pct > 0) {
        safeSetItem(`article-progress:${article.id}`, String(window.scrollY))
        safeSetItem(`article-progress-pct:${article.id}`, String(Math.min(Math.max(pct, 0), 100)))
        // Засчитать день чтения при достижении 20%+
        if (!streakMarked && pct >= 20) {
          calculateReadingStreak(true)
          streakMarked = true
        }
      }
    }
    const interval = window.setInterval(save, 2000)
    window.addEventListener('beforeunload', save)
    // FIX AV-1: don't call save() explicitly in cleanup — beforeunload handles the final save.
    // Double-calling overwrites progress with a stale value on iOS Safari where cleanup
    // may run after pagehide but before the actual unload completes.
    return () => { window.clearInterval(interval); window.removeEventListener('beforeunload', save) }
  }, [article.id])

  // FIX C-2: clean up copiedTimeoutRef on unmount to avoid setState on unmounted component
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current)
    }
  }, [])

  // FIX: initialize both largeText and focusMode from localStorage in a single effect.
  // useState initializers must be pure — reading localStorage there causes hydration mismatches
  // (server sees false, client may see true). DOM side-effects (classList.add) also must not
  // run during render. Merging into one effect avoids two separate microtasks.
  useEffect(() => {
    const prefFocusMode = safeGetItem('pref-focus-mode') === 'true'
    const prefLargeText = safeGetItem('pref-large-text') === 'true'
    setLargeText(prefLargeText)
    setFocusMode(prefFocusMode)
    document.documentElement.classList.toggle('pref-large-text', prefLargeText)
    document.documentElement.classList.toggle('focus-mode-active', prefFocusMode)
  }, [])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.defaultPrevented || disableEscapeBack) return
    if (e.key === 'Escape') {
      onBack()
    }
  }, [disableEscapeBack, onBack])
  useEffect(() => { window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey) }, [handleKey])

  // BUG FIX: clean up focus-mode class when navigating away from article
  useEffect(() => {
    return () => { document.documentElement.classList.remove('focus-mode-active', 'pref-large-text') }
  }, [])

  const toggleLargeText = () => setLargeText(v => {
    const next = !v
    safeSetItem('pref-large-text', String(next))
    document.documentElement.classList.toggle('pref-large-text', next)
    return next
  })
  // BUG FIX: toggle CSS class on <html> so global.css .focus-mode-active rules apply
  const toggleFocusMode = () => setFocusMode(v => {
    const next = !v
    safeSetItem('pref-focus-mode', String(next))
    document.documentElement.classList.toggle('focus-mode-active', next)
    return next
  })

  // Z-8 FIX: single parse of article.content shared by both headings and renderedContent
  const blocks = useMemo(
    () => article.content.split('\n\n').flatMap(splitInlineBlocks).map(b => b.trim()),
    [article.content]
  )

  // NEW-IMP-A: memoize — headings is expensive (split+flatMap the full article content)
  //
  // IMPORTANT — filter order matters:
  //   1. **bold** exact match
  //   2. ======== separator  ← must come before isSectionTitle; a block like
  //                            "======== TITRE ========" has all-caps compact text
  //                            and isSectionTitle() would accept it first, then
  //                            the title extraction would keep the raw "===..." prefix
  //                            producing a headingId mismatch → dead TOC link.
  //   3. ## / ### markdown   ← must come before isSectionTitle for the same reason:
  //                            "## SOME CAPS TITLE" passes isSectionTitle() and its
  //                            title ends up as "## SOME CAPS TITLE" while renderedContent
  //                            uses only "SOME CAPS TITLE" for the id → dead TOC link.
  //   4. isSectionTitle      ← generic all-caps detector, last resort
  const headings = useMemo(() => blocks
    .map((raw, idx) => ({ raw, idx }))
    .filter(({ raw }) => {
      if (/^\*\*([^*]+)\*\*$/.test(raw)) return true
      // ======== separator blocks — check BEFORE isSectionTitle (see note above)
      if (raw.includes('========')) {
        const title = raw
          .replace(/={8,}/g, '\n')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .join(' ')
        return title.length > 0 && title.length < 200
      }
      // Markdown ## / ### headings — check BEFORE isSectionTitle (see note above)
      if (/^#{2,3}\s+/.test(raw)) return true
      if (isSectionTitle(raw)) return true
      return false
    })
    .map(({ raw, idx }) => {
      let title: string
      if (raw.includes('========')) {
        title = raw
          .replace(/={8,}/g, '\n')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .join(' ')
      } else if (/^#{2,3}\s+/.test(raw)) {
        // Strip the "## " / "### " prefix so the TOC title matches what
        // renderedContent passes to headingId() (mdHeadingMatch[2]).
        title = raw.replace(/^#{2,3}\s+/, '')
      } else {
        title = raw.replace(/^\*\*|\*\*$/g, '')
      }
      return { title, id: headingId(title, idx) }
    })
  , [blocks])

  // F-07: Related articles — same category first, then by shared tags from other categories
  const related = useMemo(() => {
    const sameCat = allArticles.filter(a => a.id !== article.id && a.category === article.category)
    if (sameCat.length >= 3) return sameCat.slice(0, 3)
    const tagSet = new Set(article.tags ?? [])
    const byTags = allArticles.filter(a =>
      a.id !== article.id &&
      a.category !== article.category &&
      a.tags?.some(t => tagSet.has(t))
    )
    return [...sameCat, ...byTags].slice(0, 3)
  }, [allArticles, article.id, article.category, article.tags])

  const textSize = largeText ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'

  // NEW-IMP-A: memoize — full content parse is expensive
  const renderedContent = useMemo(() => {
    return blocks.map((p, idx) => {
        
      if (!p) return null

      // [NEW] Block-level images (Prevents <figure> inside <p> Hydration Mismatch)
      const imgMatch = p.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        return (
          // FIX CLS: aspect-ratio reserves the exact space before the image loads so
          // surrounding text doesn't shift. max-h-[600px] still caps very tall images.
          <figure key={idx} className="my-12 w-full overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800/80 shadow-md bg-stone-50 dark:bg-stone-900/50 print:break-inside-avoid" style={{ aspectRatio: '16/9' }}>
            <img itemProp="image" src={imgMatch[2]} alt={imgMatch[1]} title={imgMatch[1]} className="w-full h-full object-cover object-center transition-opacity duration-700" loading="lazy" decoding="async" onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = fallbackImageFor(article.category) }} />
            {imgMatch[1] && <figcaption className="px-6 py-4 text-center font-serif text-[15px] italic text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800/60">{imgMatch[1]}</figcaption>}
          </figure>
        )
      }


      if (/^={10,}$/.test(p)) return <hr key={idx} className="my-10 border-none h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent dark:via-stone-700" />

      const separatorTitle = p.replace(/={8,}/g, '\n').split('\n').map(line => line.trim()).filter(Boolean).join(' ')
      if (p.includes('========') && separatorTitle && separatorTitle.length < 200) {
        return (
          <section key={idx} id={headingId(separatorTitle, idx)} className="scroll-mt-28 mt-16 mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent dark:via-stone-700" />
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.36em] text-amber-800/70 dark:text-amber-500/70">Раздел</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug tracking-[-0.04em] text-stone-950 dark:text-stone-100 md:text-3xl">{separatorTitle}</h2>
            <div className="mt-6 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent dark:via-stone-700" />
          </section>
        )
      }

      const boldMatch = p.match(/^\*\*([^*]+)\*\*$/)
      if (boldMatch) {
        return <h2 key={idx} id={headingId(boldMatch[1], idx)} className="scroll-mt-28 mt-16 mb-4 font-serif text-2xl font-semibold tracking-[-0.04em] text-stone-950 dark:text-stone-100 md:text-3xl">{boldMatch[1]}</h2>
      }

      // Markdown ## / ### headings — headings useMemo catches these for TOC;
      // renderContent must assign matching id or TOC scrollIntoView finds nothing.
      const mdHeadingMatch = p.match(/^(#{2,3})\s+(.*)$/)
      if (mdHeadingMatch) {
        const level = mdHeadingMatch[1].length as 2 | 3
        const title = mdHeadingMatch[2]
        const Tag = level === 2 ? 'h2' : 'h3'
        return (
          <Tag
            key={idx}
            id={headingId(title, idx)}
            className={`scroll-mt-28 mt-16 mb-4 font-serif font-semibold tracking-[-0.04em] text-stone-950 dark:text-stone-100 ${level === 3 ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}
          >
            {title}
          </Tag>
        )
      }

      if (isSectionTitle(p)) {
        return (
          <div key={idx} id={headingId(p, idx)} className="scroll-mt-28 mt-14 mb-6">
            <div className="h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent dark:via-stone-700" />
            <h2 className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-900/80 dark:text-amber-400/80 md:text-xs">{p}</h2>
          </div>
        )
      }

      if (/смысловое переложение|адаптац|не дословн/i.test(p)) {
        return (
          <aside key={idx} className="my-10 rounded-lg border border-stone-200 bg-white/50 px-6 py-5 text-sm leading-7 text-stone-500 italic dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400">
            <InlineText text={p} />
          </aside>
        )
      }

      const lines = p.split('\n').filter(line => line.trim().length > 0)
      const isList = lines.length > 1 && lines.every(line => /^\s*(-|•|\d{1,2}[.)])\s+\S/.test(line))
      if (isList) {
        return (
          <ul key={idx} className={`my-6 space-y-3 pl-0 ${textSize} leading-8 text-stone-700 dark:text-stone-300 md:leading-9`}>
            {lines.map((line, li) => (
              <li key={li} className="flex gap-3">
                <span className="mt-[0.55em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-700/60" />
                <InlineText text={line.replace(/^\s*(-|•|\d{1,2}[.)])\s+/, '')} />
              </li>
            ))}
          </ul>
        )
      }

      const isQuote = p.length > 50 && p.length < 480 && !p.includes("\n") && ((p.startsWith("«") && p.endsWith("»")) || (p.startsWith("\"") && p.endsWith("\"")) || (p.startsWith("❝") && p.endsWith("❞")))
      if (isQuote) {
        return <blockquote key={idx} className={`my-10 border-l-2 border-amber-700/60 pl-6 italic leading-9 text-stone-600 dark:text-stone-400 ${textSize}`}><InlineText text={p} /></blockquote>
      }

      return <p key={idx} className={`leading-[1.85] text-stone-700 dark:text-stone-300 ${textSize} whitespace-pre-line`}><InlineText text={p} /></p>
    })
  }, [article.category, blocks, textSize])


  const readingTimeLeft = Math.max(0, Math.ceil(article.readTime * (1 - progress)))

  return (
    <main className="relative bg-[var(--bg-main)] pb-32 pt-0 dark:bg-stone-950 lg:pb-24">
      {/* Progress bar — flush under sticky header; header is py-5 + h-11 = 84px on all breakpoints */}
      <div className="fixed inset-x-0 top-[84px] z-40 hidden h-[2px] lg:block">
        <div className="h-full bg-gradient-to-r from-amber-700 to-amber-500 transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="px-4 pt-8 sm:px-6">
        <article className="mx-auto max-w-7xl">
          {/* Back */}
          <button type="button" onClick={onBack} className="back-btn mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-stone-600 transition-colors hover:text-amber-800 dark:text-stone-400 dark:hover:text-amber-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Назад к библиотеке
          </button>

          {/* Header */}
          <header className={`grid gap-8 border-y border-[var(--border-subtle)] py-10 dark:border-stone-800 ${focusMode ? 'lg:grid-cols-1 lg:mx-auto lg:max-w-3xl' : 'lg:grid-cols-[0.88fr_1.12fr] lg:items-end'}`}>
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em] text-amber-800 dark:text-amber-500">
                {category?.name ?? article.category}
                <span className="mx-2 text-stone-400">·</span>
                <ReadingTime minutes={article.readTime} />
                {progress > 0.05 && progress < 0.995 && readingTimeLeft > 0 && <span className="text-stone-400"> · ещё ~{readingTimeLeft} мин</span>}
              </p>
              <h1 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.06em] text-stone-950 dark:text-stone-100 sm:text-5xl md:text-6xl">{article.title}</h1>
            </div>
            <div>
              <p className="text-xl leading-8 text-stone-600 dark:text-stone-400 md:text-2xl md:leading-9">{article.excerpt}</p>
              <div className="mt-5 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                {(article.tags ?? []).slice(0, 6).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      // Write the search query to sessionStorage so HomeApp picks it up on mount
                      try { sessionStorage.setItem('pending-search', tag) } catch (_) { /* sessionStorage unavailable */ }
                      onBack()
                    }}
                    className="border border-stone-200 dark:border-stone-700 px-2 py-0.5 transition hover:border-amber-700 hover:text-amber-800 dark:hover:border-amber-500 dark:hover:text-amber-400 cursor-pointer"
                    title={`Найти материалы по тегу ${tag}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <ArticleActions
                  article={article}
                  saved={saved}
                  onToggleSave={(next) => { setSaved(next); safeSetItem(`article-saved:${article.id}`, String(next)) }}
                />
              </div>
              {resumePosition > 0 && (
                <button type="button" onClick={() => { window.scrollTo({ top: resumePosition, behavior: 'smooth' }); setResumePosition(0); }} className="mt-5 border border-stone-950 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-stone-950 transition hover:bg-stone-950 hover:text-amber-100 dark:border-amber-100 dark:text-amber-100 dark:hover:bg-amber-100 dark:hover:text-stone-950">
                  Продолжить с прошлого места
                </button>
              )}
            </div>
          </header>

          {/* Hero image — figure/caption improves accessibility and image SEO */}
          <figure className="my-8">
            <div
              className={`overflow-hidden bg-stone-200 dark:bg-stone-800 ${focusMode ? 'mx-auto max-w-3xl' : isPortraitHero ? 'mx-auto max-w-md' : 'mx-auto max-w-6xl'}`}
              style={{ aspectRatio: heroAspectRatio }}
            >
              <img itemProp="image" 
                src={article.image} 
                alt={article.imageAlt ?? article.title}
                title={article.imageTitle ?? article.title}
                width={imageWidth}
                height={imageHeight}
                className="h-full w-full object-cover object-center" 
                loading="eager" 
                decoding="async" 
                fetchPriority="high" 
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImageFor(article.category) }} 
              />
            </div>
            {article.imageCaption && (
              <figcaption className="mx-auto mt-3 max-w-3xl px-2 text-center font-serif text-[15px] italic leading-6 text-stone-500 dark:text-stone-400">
                {article.imageCaption}
              </figcaption>
            )}
          </figure>

          <div className={focusMode ? 'mx-auto max-w-3xl' : 'mx-auto max-w-6xl'}>
            <MiloviCakeArticleNote />
          </div>

          {/* Mobile TOC — luxury animated accordion */}
          {headings.length > 2 && (
            <div className="mb-8 border border-stone-200 bg-white/60 dark:border-stone-800 dark:bg-stone-900/60 lg:hidden">
              <button
                type="button"
                onClick={() => setTocOpen(v => !v)}
                aria-expanded={tocOpen}
                aria-controls="mobile-toc-list"
                className="haptic-btn flex w-full select-none items-center justify-between px-5 py-4 font-mono text-[11px] uppercase tracking-[0.24em] text-stone-950 dark:text-stone-100"
              >
                <span>Содержание</span>
                <span className="flex items-center gap-3 text-stone-500">
                  <span>{headings.length}&thinsp;{pluralRu(headings.length, HEADING)}</span>
                  <motion.span
                    animate={{ rotate: tocOpen ? 180 : 0 }}
                    transition={{ duration: 0.22 }}
                    className="inline-block"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.span>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {tocOpen && (
                  <motion.ol id="mobile-toc-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden border-t border-stone-100 dark:border-stone-800"
                  >
                    {headings.map((h, i) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setTocOpen(false)
                            setTimeout(() => {
                              document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }, 280)
                          }}
                          className="haptic-btn flex w-full gap-3 border-b border-stone-50 px-5 py-3 text-left text-sm leading-6 text-stone-600 transition-colors last:border-b-0 hover:bg-amber-50/60 hover:text-amber-800 dark:border-stone-900 dark:text-stone-400 dark:hover:bg-amber-950/20 dark:hover:text-amber-400"
                        >
                          <span className="mt-px flex-shrink-0 font-mono text-[9px] tracking-wider text-stone-400">{String(i + 1).padStart(2, '0')}</span>
                          <span>{h.title}</span>
                        </button>
                      </li>
                    ))}
                  </motion.ol>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* 3-column body */}
          <div className={`grid gap-10 ${focusMode ? 'lg:grid-cols-[minmax(0,54rem)] lg:justify-center' : 'lg:grid-cols-[15rem_minmax(0,52rem)_1fr]'}`}>
            {/* Desktop sidebar */}
            <aside className={`${focusMode ? 'hidden' : 'hidden lg:block'}`}>
              <div className="sticky top-28 space-y-8">
                {/* Reading controls */}
                <div className="border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/70">
                  <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-stone-400">Чтение</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => { if (largeText) toggleLargeText() }} aria-pressed={!largeText} className={`flex-1 border py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition ${!largeText ? 'border-stone-950 bg-stone-950 text-amber-100 dark:border-amber-100 dark:bg-amber-100 dark:text-stone-950' : 'border-stone-200 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500'}`}>A</button>
                    <button type="button" onClick={() => { if (!largeText) toggleLargeText() }} aria-pressed={largeText} className={`flex-1 border py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition ${largeText ? 'border-stone-950 bg-stone-950 text-amber-100 dark:border-amber-100 dark:bg-amber-100 dark:text-stone-950' : 'border-stone-200 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500'}`}>A+</button>
                  </div>
                  <button type="button" onClick={async () => { const url = `${window.location.origin}/articles/${encodeURIComponent(article.id)}/`; try { await navigator.clipboard.writeText(url); setCopied(true); showToast('copy', 'Ссылка скопирована'); if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current); copiedTimeoutRef.current = window.setTimeout(() => { setCopied(false); copiedTimeoutRef.current = null }, 1400) } catch { /* clipboard unavailable — silent fail */ } }} className="mt-3 block w-full border-t border-stone-100 dark:border-stone-800 pt-3 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600 transition hover:text-amber-800 dark:text-stone-400 dark:hover:text-amber-400">{copied ? '✓ скопировано' : 'Копировать ссылку'}</button>
                  <button type="button" onClick={() => { const next = !saved; setSaved(next); safeSetItem(`article-saved:${article.id}`, String(next)); showToast('save', next ? 'Добавлено в закладки' : 'Убрано из закладок') }} className="mt-2 block w-full text-left font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600 transition hover:text-amber-800 dark:text-stone-400 dark:hover:text-amber-400">{saved ? '✓ в закладках' : '+ сохранить'}</button>
                  <button type="button" onClick={toggleFocusMode} className="mt-2 block w-full text-left font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600 transition hover:text-amber-800 dark:text-stone-400 dark:hover:text-amber-400">{focusMode ? 'выключить фокус' : 'режим фокуса'}</button>
                </div>

                {/* Source card */}
                <div className="border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/70">
                  <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-stone-400">Источник</p>
                  <p className="mt-2 text-sm leading-6 text-stone-700 dark:text-stone-300">{article.author}</p>
                  {article.sourceUrl && (
                    <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">
                      {article.sourceLabel ?? 'Открыть'} ↗
                    </a>
                  )}
                  <p className="mt-3 text-xs leading-5 text-stone-400">Смысловое переложение и учебный конспект.</p>
                </div>

                {/* Desktop TOC */}
                {headings.length > 2 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-stone-400">Содержание</p>
                    <ol className="mt-3 space-y-1.5">
                      {headings.map((h, i) => <li key={h.id}><button type="button" onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="haptic-btn flex w-full gap-2 text-left text-sm leading-6 text-stone-600 transition hover:text-amber-800 line-clamp-2 dark:text-stone-400 dark:hover:text-amber-400"><span className="flex-shrink-0 text-stone-400">{i + 1}.</span>{h.title}</button></li>)}
                    </ol>
                  </div>
                )}
              </div>
            </aside>

            {/* Article body */}
            <div className="space-y-7 min-w-0 article-body"><div className="drop-cap relative">{renderedContent}</div>

          {/* ================= FAQ UI ================= */}
          {article.faq && article.faq.length > 0 && (
            <section className="my-20 pt-12 border-t border-stone-200 dark:border-stone-800">
              <div className="mb-10 text-center">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-800 dark:text-amber-500">Траблшутинг</span>
                <h2 className="mt-3 font-serif text-3xl md:text-4xl font-semibold text-stone-900 dark:text-stone-100">Частые ошибки и вопросы</h2>
              </div>
              <div className="mx-auto max-w-3xl space-y-4">
                {article.faq.map((f, i) => (
                  <details key={i} className="group overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900/50 shadow-sm transition-all open:border-amber-700/30 open:ring-1 open:ring-amber-700/30 dark:open:border-amber-500/30 dark:open:ring-amber-500/30">
                    <summary className="haptic-btn flex cursor-pointer items-center justify-between px-6 py-5 font-serif text-xl font-medium text-stone-800 transition hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800/50">
                      {f.question}
                      <span className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-500 transition-transform duration-300 group-open:rotate-180 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </span>
                    </summary>
                    <div className="px-6 pb-6 pt-2 text-stone-600 dark:text-stone-400 leading-relaxed text-lg border-t border-stone-100 dark:border-stone-800 mt-2 mx-6">
                      <p className="pt-4"><InlineText text={f.answer} /></p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
</div>

            {/* Spacer for right column */}
            <div className={focusMode ? 'hidden' : 'hidden lg:block'} />
          </div>

          {/* F-18: Floating TOC button for focus mode on desktop — sidebar is hidden in focus
              mode but TOC navigation is still useful. Show a minimal sticky pill at top-right
              of the reading area that expands into a mini TOC on click. */}
          {focusMode && headings.length > 2 && (
            <div className="hidden lg:block">
              <div className="fixed right-6 top-32 z-30">
                <details ref={detailsTocRef} className="group relative">
                  <summary className="haptic-btn flex cursor-pointer list-none items-center gap-2 border border-stone-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm transition hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900/90 dark:hover:border-stone-500">
                    <svg className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
                    </svg>
                    <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">Разделы</span>
                  </summary>
                  <div className="absolute right-0 top-full mt-1 w-64 border border-stone-200 bg-white/95 py-2 shadow-xl backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95">
                    {headings.map((h, i) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          // Close via ref — reliable regardless of where focus ends up
                          if (detailsTocRef.current) detailsTocRef.current.open = false
                        }}
                        className="haptic-btn flex w-full gap-2.5 px-4 py-2 text-left text-sm leading-5 text-stone-600 transition hover:bg-amber-50 hover:text-amber-800 dark:text-stone-400 dark:hover:bg-amber-950/20 dark:hover:text-amber-400"
                      >
                        <span className="mt-px flex-shrink-0 font-mono text-[9px] text-stone-400">{String(i + 1).padStart(2, '0')}</span>
                        <span className="line-clamp-2">{h.title}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Related articles */}
          {!focusMode && related.length > 0 && (
            <section className="mt-20 border-t border-stone-200 dark:border-stone-800 pt-12">
              <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.32em] text-stone-500">Читайте также — {category?.name}</p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map(r => (
                  <a key={r.id} href={`/articles/${r.id}/`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); window.scrollTo({ top: 0, behavior: 'auto' }); onNavigate?.(r) }} className="group block text-left">
                    <div className="mb-4 aspect-[16/9] overflow-hidden bg-stone-200 dark:bg-stone-800">
                      <img itemProp="image" src={r.image} alt={r.imageAlt ?? r.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImageFor(r.category) }} />
                    </div>
                    <h4 className="font-serif text-lg font-semibold tracking-[-0.03em] text-stone-950 transition group-hover:text-amber-800 line-clamp-2 dark:text-stone-100 dark:group-hover:text-amber-400">{r.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-500 line-clamp-2 dark:text-stone-400">{r.excerpt}</p>
                    <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-amber-800 dark:text-amber-400">Читать →</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>

      {/* F-16: Source info on mobile — desktop shows it in sidebar, mobile had nothing */}
      {article.sourceUrl && (
        <div className="mx-4 mt-4 border border-stone-200 bg-white/70 px-5 py-4 dark:border-stone-800 dark:bg-stone-900/70 lg:hidden">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-stone-400">Источник</p>
          <p className="mt-1.5 text-sm leading-5 text-stone-700 dark:text-stone-300">{article.author}</p>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            {article.sourceLabel ?? 'Открыть'} ↗
          </a>
        </div>
      )}

      {/* Luxury mobile reading bar — article-specific controls */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Progress micro-bar */}
        <div className="h-[3px] w-full bg-stone-200 dark:bg-stone-800">
          <div
            className="h-[3px] bg-gradient-to-r from-amber-700 to-amber-500 transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Top decorative line */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-700/25 to-transparent dark:via-amber-500/15" />

        <div className="grid grid-cols-4 bg-[var(--bg-overlay-95)] backdrop-blur-xl dark:bg-stone-950/95">
          {/* Back */}
          <button
            type="button"
            onClick={onBack}
            className="haptic-btn group flex flex-col items-center justify-center gap-1 py-3 text-stone-500 transition-colors hover:text-stone-950 dark:text-stone-500 dark:hover:text-stone-100"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-mono text-[8px] uppercase tracking-[0.22em]">Назад</span>
          </button>

          {/* Save / bookmark */}
          <button
            type="button"
            onClick={() => {
              const next = !saved
              setSaved(next)
              safeSetItem(`article-saved:${article.id}`, String(next))
              // F-05: show toast confirmation (was silent on mobile)
              showToast('save', next ? 'Добавлено в закладки' : 'Убрано из закладок')
            }}
            className={`haptic-btn group flex flex-col items-center justify-center gap-1 border-l border-[var(--border-subtle)] py-3 transition-colors dark:border-stone-800 ${saved ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500 hover:text-amber-800 dark:text-stone-500 dark:hover:text-amber-400'}`}
          >
            <svg className="h-[18px] w-[18px]" fill={saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            <span className="font-mono text-[8px] uppercase tracking-[0.22em]">{saved ? 'Сохранено' : 'Сохранить'}</span>
          </button>

          {/* Font size toggle */}
          <button
            type="button"
            onClick={toggleLargeText}
            className="haptic-btn flex flex-col items-center justify-center gap-1 border-l border-[var(--border-subtle)] py-3 text-stone-500 transition-colors hover:text-stone-950 dark:border-stone-800 dark:text-stone-500 dark:hover:text-stone-100"
          >
            <span className={`font-serif leading-none transition-all ${largeText ? 'text-[20px] text-amber-800 dark:text-amber-400' : 'text-[15px]'}`}>A</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.22em]">{largeText ? 'Меньше' : 'Больше'}</span>
          </button>

          {/* Focus mode */}
          <button
            type="button"
            onClick={toggleFocusMode}
            className={`haptic-btn flex flex-col items-center justify-center gap-1 border-l border-[var(--border-subtle)] py-3 transition-colors dark:border-stone-800 ${focusMode ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500 hover:text-stone-950 dark:text-stone-500 dark:hover:text-stone-100'}`}
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            <span className="font-mono text-[8px] uppercase tracking-[0.22em]">{focusMode ? 'Выйти' : 'Фокус'}</span>
          </button>
        </div>
      </div>
    </main>
  )
}
