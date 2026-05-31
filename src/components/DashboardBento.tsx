import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ArticleMeta } from '../data/types'
import ScrollReveal from './ScrollReveal'
import { calculateReadingStreak } from '../utils/streak'
import { safeGetItem, safeSetItem } from '../utils/storage'
import { pluralRu, DAY } from '../utils/plural'

interface BentoProps {
  articles: ArticleMeta[]
  onArticleClick: (article: ArticleMeta) => void
}

const QUOTES = [
  { text: 'Вкус — это не просто сочетание ингредиентов. Это архитектура эмоций и точный расчёт.', author: 'Пьер Эрме' },
  { text: 'Кондитерское искусство рождается на стыке абсолютной точности и искренней страсти.', author: 'Филипп Контисини' },
  { text: 'Соль — лучший друг кондитера. Без соли сладость становится плоской и невыразительной.', author: 'Нина Метайе' },
  { text: 'Когда вы едите десерт, вы должны сначала удивиться глазами, а затем — текстурой.', author: 'Седрик Гроле' },
  { text: 'Хороший рецепт — это начало. Повторяемый результат — это мастерство.', author: 'Мишель Ру' },
  { text: 'Глазурь скрывает ошибки. Текстура — обнажает всё.', author: 'Ален Дюкас' },
  { text: 'Крем должен быть гладким, как мысль, и стойким, как характер.', author: 'Гастон Ленотр' },
]

function StatCard({
  title,
  value,
  unit,
  desc,
  icon,
  delay,
}: {
  title: string
  value: number
  unit?: string
  desc: string
  icon: ReactNode
  delay: number
}) {
  return (
    <ScrollReveal delay={delay} direction="up">
      <div
        className="haptic-btn relative overflow-hidden border p-6 transition-all duration-300 h-full group"
        style={{ backgroundColor: 'var(--bg-deep)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <span className="block" style={{ width: 80, height: 80, color: 'var(--text-accent)' }}>
            {icon}
          </span>
        </div>
        <div className="flex h-full flex-col justify-between">
          <div>
            <span
              className="font-mono text-[9px] uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {title}
            </span>
            <p
              className="mt-4 font-serif text-5xl font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {value}
              {unit && (
                <span className="text-xl font-normal"> {unit}</span>
              )}
            </p>
          </div>
          <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            {desc}
          </p>
        </div>
      </div>
    </ScrollReveal>
  )
}

// Inline SVG icons (no external dependency)
const BookOpenIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} width="100%" height="100%">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)

const BookmarkIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} width="100%" height="100%">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
)

const ClockIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} width="100%" height="100%">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const FlameIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} width="100%" height="100%">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
)

export default function DashboardBento({ articles, onArticleClick }: BentoProps) {
  const [readCount, setReadCount] = useState(0)
  const [bookmarksCount, setBookmarksCount] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [recentArticle, setRecentArticle] = useState<ArticleMeta | null>(null)
  const [mounted, setMounted] = useState(false)
  // Quote state belongs with the rest of state hooks. Effects below may call setQuote.
  const [quote, setQuote] = useState(QUOTES[0])

  useEffect(() => {
    let completed = 0
    let saved = 0
    let minutes = 0
    let lastActiveId: string | null = null
    let lastActiveTs = 0 // F-06: track by timestamp, not maxPct

    articles.forEach((a) => {
      const pct = Number(safeGetItem(`article-progress-pct:${a.id}`) ?? 0)
      if (pct >= 95) completed++
      if (safeGetItem(`article-saved:${a.id}`) === 'true') saved++
      if (pct > 0) {
        minutes += (pct / 100) * a.readTime
        // F-06: use last-read timestamp; fall back to pct rank for articles read before this fix
        const ts = Number(safeGetItem(`article-last-read:${a.id}`) ?? 0)
        if (ts > lastActiveTs) {
          lastActiveTs = ts
          lastActiveId = a.id
        } else if (ts === 0 && pct > 0 && lastActiveTs === 0) {
          // Legacy fallback: no timestamp yet — pick first article with progress
          lastActiveId = lastActiveId ?? a.id
        }
      }
    })

    setReadCount(completed)
    setBookmarksCount(saved)
    setTotalMinutes(Math.round(minutes))
    if (lastActiveId) {
      const match = articles.find((a) => a.id === lastActiveId)
      if (match) setRecentArticle(match)
    }

    const { streak: s } = calculateReadingStreak(false)
    setStreak(s)
    
    const storedQuote = safeGetItem('quote-seed')
    const parsedQuote = storedQuote !== null ? Number(storedQuote) : NaN
    const seed = Number.isInteger(parsedQuote) && parsedQuote >= 0 && parsedQuote < QUOTES.length
      ? parsedQuote
      : Math.floor(Math.random() * QUOTES.length)
    if (!Number.isInteger(parsedQuote) || parsedQuote < 0 || parsedQuote >= QUOTES.length) {
      safeSetItem('quote-seed', String(seed))
    }
    const today = new Date()
    const dayOffset = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 86400000)
    setQuote(QUOTES[(seed + dayOffset) % QUOTES.length])
    setMounted(true)
  }, [articles])

  // F-20: Per-user random quote seed so each visitor sees a different rotation.
  // Uses safeGetItem/safeSetItem to stay resilient in private-browsing mode.

  // F-17: Don't render until useEffect has run (avoids flicker from SSR zeros).
  // After first article read the streak is set to 1 — include streak in the
  // check so the bento becomes visible immediately on return to home page.
  if (!mounted || (readCount === 0 && bookmarksCount === 0 && totalMinutes === 0 && streak === 0)) return null

  return (
    <section className="px-6 pb-12" style={{ backgroundColor: 'var(--bg-main)' }}>
      <div className="mx-auto max-w-7xl">
        <ScrollReveal direction="up">
          <p
            className="mb-4 font-mono text-[10px] uppercase tracking-[0.32em]"
            style={{ color: 'var(--text-muted)' }}
          >
            Ваш прогресс
          </p>
          <h2
            className="mb-10 font-serif text-3xl font-semibold tracking-[-0.04em] md:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Личная статистика
          </h2>
        </ScrollReveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={BookOpenIcon}
            title="Изучено материалов"
            value={readCount}
            desc="Прочитано более чем на 95%"
            delay={0}
          />
          <StatCard
            icon={BookmarkIcon}
            title="В закладках"
            value={bookmarksCount}
            desc="Техники и рецепты для быстрого доступа"
            delay={0.1}
          />
          <StatCard
            icon={ClockIcon}
            title="Время в Архиве"
            value={totalMinutes}
            unit="мин"
            desc="Суммарное время освоения материалов"
            delay={0.2}
          />

          {/* Quote / streak card */}
          <ScrollReveal delay={0.3} direction="up" className="sm:col-span-2 lg:col-span-1">
            <div
              className="haptic-btn relative overflow-hidden border p-6 h-full"
              style={{ backgroundColor: 'var(--bg-deep)', borderColor: 'var(--text-accent)' }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <span style={{ display: 'block', width: 80, height: 80, color: 'var(--text-accent)' }}>
                  {FlameIcon}
                </span>
              </div>
              <div className="flex h-full flex-col justify-between">
                <div>
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.2em]"
                    style={{ color: 'var(--text-accent)' }}
                  >
                    {streak > 0 ? `Серия: ${streak} ${pluralRu(streak, DAY)} 🔥` : 'Мысль дня'}
                  </span>
                  <p
                    className="mt-4 font-serif text-sm italic leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    « {quote.text} »
                  </p>
                </div>
                <p
                  className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-right"
                  style={{ color: 'var(--text-muted)' }}
                >
                  — {quote.author}
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {recentArticle && (
          <ScrollReveal delay={0.4} direction="up">
            <div
              className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border p-4"
              style={{ backgroundColor: 'var(--bg-deep)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Остановились на:{' '}
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {recentArticle.title}
                  </span>
                </p>
              </div>
              <a
                href={`/articles/${recentArticle.id}/`}
                onClick={(e) => { if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) { e.preventDefault(); onArticleClick(recentArticle) } }}
                className="text-xs font-mono uppercase tracking-wider hover:underline cursor-pointer shrink-0"
                style={{ color: 'var(--text-accent)' }}
              >
                Продолжить чтение →
              </a>
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  )
}
