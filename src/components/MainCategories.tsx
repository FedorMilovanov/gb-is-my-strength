import { useEffect, useMemo, useRef } from 'react'
import type { ArticleMeta } from '../data/types'
import { NON_CHEF_CATEGORY_IDS } from '../data/categories'


const STATIC_CATS = [
  {
    id: 'chefs',
    badge: 'Биографии · Школы',
    name: 'Шефы & Мастера',
    desc: '14 шефов — от Пьера Эрме до Жака Жени. Разборы почерка, философии и сигнатурных творений.',
    unit: 'материалов',
    img: '/images/cat-chefs.webp',
    imgAlt: 'Шефы-кондитеры',
    isNew: false,
    localFallback: '/images/cat-chefs.svg',
  },
  {
    id: 'techniques',
    badge: 'Технологии · Процессы',
    name: 'Техники',
    desc: 'Feuilletage, pâte à choux, кремы, муссы, глазури — профессиональные разборы с температурами и пропорциями.',
    unit: 'материалов',
    img: '/images/cat-techniques.webp',
    imgAlt: 'Техники кондитерского искусства',
    isNew: false,
    localFallback: '/images/cat-techniques.svg',
  },
  {
    id: 'recipes',
    badge: 'Сборка · Практика',
    name: 'Рецепты',
    desc: 'Практические карты сборки и домашние адаптации — от тарта с пеканом до entremets с кремом брюле.',
    unit: 'рецептов',
    img: '/images/cat-recipes.webp',
    imgAlt: 'Рецепты французской кондитерской',
    isNew: false,
    localFallback: '/images/cat-recipes.svg',
  },
  {
    id: 'chiffres-gourmands',
    badge: 'Статистика · Рейтинги · Аналитика',
    name: 'Цифры гурмана',
    desc: 'Рейтинги пекарен, обороты кондитерских домов, мировое потребление шоколада и другая аналитика индустрии.',
    unit: 'материалов',
    img: '/images/cat-chiffres.webp',
    imgAlt: 'Chiffres Gourmands — аналитика',
    isNew: true,
    localFallback: '/images/cat-chiffres.svg',
  },
]

// Export for use in other components (e.g. CommandPalette quick actions)
export { STATIC_CATS }

interface MainCategoriesProps {
  articles: ArticleMeta[]
  onSelectCategory: (id: string) => void
}

export default function MainCategories({ articles, onSelectCategory }: MainCategoriesProps) {
  const sectionRef = useRef<HTMLDivElement>(null)

  // F-02: Compute real counts from articles
  const counts = useMemo(() => {
    const chefs = articles.filter(a => !NON_CHEF_CATEGORY_IDS.has(a.category)).length
    const techniques = articles.filter(a => a.category === 'techniques').length
    const recipes = articles.filter(a => a.category === 'recipes').length
    const chiffres = articles.filter(a => a.category === 'chiffres-gourmands').length
    return { chefs, techniques, recipes, 'chiffres-gourmands': chiffres }
  }, [articles])

  // Scroll-reveal observer with fallback timer
  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll('.reveal')
    if (!els?.length) return

    // Fallback: если observer не сработал — показываем всё через 400ms
    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add('in'))
    }, 400)

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
      },
      { threshold: 0.05, rootMargin: '120px 0px 0px 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => { io.disconnect(); window.clearTimeout(fallback) }
  }, [])

  return (
    <section id="categories" className="py-24 transition-colors bg-[var(--bg-deep)]" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} ref={sectionRef}>
      <div className="mx-auto max-w-[1380px] px-6 lg:px-10">
        {/* Section header */}
        <div className="reveal mb-16 flex flex-col items-start justify-between gap-6 border-b border-[var(--border)] pb-12 sm:flex-row sm:items-end">
          <div>
            <span className="mb-3 block font-mono text-[9px] uppercase tracking-[0.44em] text-[var(--gold)]">
              Четыре направления
            </span>
            <h2 className="mt-2 font-serif text-[clamp(2.8rem,5.5vw,5rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-[var(--ink)]">
              Архив по темам
            </h2>
          </div>
          <p className="max-w-md font-['Cormorant_Garamond'] text-base italic leading-[1.82] text-[var(--ink-50)]">
            Четыре главных раздела — шефы, техники, рецепты и аналитика кондитерского мира. Выберите направление или читайте всё подряд.
          </p>
        </div>

        {/* 2×2 grid */}
        <div
          className="grid grid-cols-1 gap-[2px] bg-[var(--border)] sm:grid-cols-2"
          style={{ border: '1px solid var(--border)' }}
        >
          {STATIC_CATS.map((cat, i) => {
            const count = counts[cat.id as keyof typeof counts] ?? 0
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`cat-img-card reveal group relative block cursor-pointer overflow-hidden bg-[var(--cream)] text-left transition-colors ${i > 0 ? `reveal-delay-${Math.min(i, 3)}` : ''}`}
              >
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={cat.img}
                    alt={cat.imgAlt} title={cat.imgAlt}
                    loading="lazy"
                    decoding="async"
                    className="cat-img h-full w-full object-cover"
                    onError={(e) => {
                      const el = e.currentTarget
                      const fb = (cat as { localFallback?: string }).localFallback
                      if (fb && el.src !== window.location.origin + fb) {
                        el.src = fb
                      }
                    }}
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(175deg,rgba(10,8,7,0)_30%,rgba(10,8,7,0.82)_100%)] transition-all duration-500 group-hover:bg-[linear-gradient(175deg,rgba(10,8,7,0.05)_20%,rgba(10,8,7,0.9)_100%)]" />

                  {/* "NEW" badge */}
                  {cat.isNew && (
                    <div className="absolute left-5 top-5 z-10 bg-[var(--gold)] px-3 py-[5px] font-mono text-[8px] uppercase tracking-[0.32em] text-stone-950">
                      Nouveau
                    </div>
                  )}

                  {/* Body overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-9">
                    <span className="mb-3.5 inline-block border border-[rgba(212,169,106,0.25)] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.36em] text-[rgba(212,169,106,0.75)]">
                      {cat.badge}
                    </span>
                    <span className="block font-serif text-[1.9rem] font-semibold leading-none tracking-[-0.05em] text-stone-950">
                      {cat.name}
                    </span>
                    <p className="mt-2.5 max-w-xs font-['Cormorant_Garamond'] text-[0.85rem] italic leading-[1.65] text-[rgba(232,220,200,0.72)]">
                      {cat.desc}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-[rgba(255,255,255,0.1)] pt-4">
                      <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-[rgba(212,169,106,0.6)]">
                        {/* F-02: real count from articles */}
                        <strong className="mr-1 font-serif text-[1.1rem] font-semibold tracking-[-0.04em] text-[var(--gold-pale)]">{count}</strong>
                        {cat.unit}
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center border border-[rgba(255,255,255,0.2)] transition-all duration-300 group-hover:border-[var(--gold-pale)] group-hover:bg-[var(--gold-pale)]">
                        <svg
                          className="h-3 w-3 stroke-white transition-[stroke] duration-300 group-hover:stroke-[var(--ink)]"
                          fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
