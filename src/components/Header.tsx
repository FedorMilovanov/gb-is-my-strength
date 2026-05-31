import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

type Theme = 'light' | 'dark'

interface HeaderProps {
  theme: Theme
  onToggleTheme: () => void
  onGoHome: () => void
  onGoCategories: () => void
  onGoArticles: () => void
  onGoAbout: () => void
  onOpenCommand: () => void
}

export default function Header({ theme, onToggleTheme, onGoHome, onGoCategories, onGoArticles, onGoAbout, onOpenCommand }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  // Close mobile menu when viewport becomes desktop-wide
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Scroll lock — prevent body scroll while mobile menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPad = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPad
    }
  }, [mobileMenuOpen])

  // Focus trap for mobile menu
  useEffect(() => {
    if (!mobileMenuOpen || !mobileMenuRef.current) return
    const menu = mobileMenuRef.current
    const focusable = Array.from(
      menu.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
    )
    if (focusable.length) focusable[0].focus()
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleTab)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('keydown', handleTab)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header className={`sticky top-0 z-40 border-b transition-all duration-300 ${scrolled ? 'border-[var(--border-subtle)] bg-[var(--bg-overlay-95)] shadow-sm backdrop-blur-xl' : 'border-transparent bg-[var(--bg-overlay-90)] backdrop-blur-md'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <a href="/" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); onGoHome() }} className="haptic-btn group flex items-center gap-3 text-left">
            <img src="/images/logo.svg" alt="Patisserie Russe" title="Patisserie Russe" width="44" height="44" className="h-11 w-11 transition group-hover:scale-105" loading="eager" decoding="async" />
            <span>
              <span className="block font-serif text-[1.1rem] font-semibold tracking-[-0.04em] sm:text-[1.25rem]">Patisserie Russe</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.28em] text-stone-500 dark:text-stone-400">French Pastry Archive</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="/" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); onGoHome() }} className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100">Главная</a>
            <a href="/#archive" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); onGoCategories() }} className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100">Архив</a>
            <a href="/#articles" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); onGoArticles() }} className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100">Материалы</a>
            <a href="/#about" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); onGoAbout() }} className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100">О проекте</a>
          </nav>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={onOpenCommand}
              aria-label="Открыть поиск"
              className="inline-flex h-11 items-center gap-2 border border-[var(--border-subtle)] px-4 text-[11px] font-mono uppercase tracking-[0.22em] text-stone-700 transition hover:border-stone-400 hover:bg-stone-950 hover:text-amber-50 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-amber-100 dark:hover:text-stone-950"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">Поиск</span>
              <kbd className="hidden border border-stone-200 px-1 py-0.5 font-mono text-[9px] text-stone-400 dark:border-stone-700 lg:inline">⌘K</kbd>
            </motion.button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center border border-[var(--border-subtle)] text-stone-700 transition hover:border-stone-400 hover:bg-stone-950 hover:text-amber-50 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-amber-100 dark:hover:text-stone-950"
              aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              {theme === 'dark' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-11 w-11 items-center justify-center border border-[var(--border-subtle)] text-stone-700 transition hover:border-stone-400 md:hidden dark:text-stone-300"
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Навигационное меню"
            id="mobile-navigation-menu"
            className="fixed inset-x-0 top-[84px] z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-overlay-95)] p-6 backdrop-blur-xl md:hidden"
            initial={shouldReduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={shouldReduce ? { duration: 0 } : { duration: 0.2 }}
          >
            <div className="flex flex-col gap-5">
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onGoHome() }}
                className="text-left font-mono text-[12px] uppercase tracking-[0.24em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100"
              >
                Главная
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onGoCategories() }}
                className="text-left font-mono text-[12px] uppercase tracking-[0.24em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100"
              >
                Архив
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onGoArticles() }}
                className="text-left font-mono text-[12px] uppercase tracking-[0.24em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100"
              >
                Материалы
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onGoAbout() }}
                className="text-left font-mono text-[12px] uppercase tracking-[0.24em] text-stone-600 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-amber-100"
              >
                О проекте
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
