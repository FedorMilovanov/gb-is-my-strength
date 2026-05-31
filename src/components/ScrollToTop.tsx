import { AnimatePresence, motion } from 'framer-motion'
import { useScrollProgress } from '../hooks/useScrollProgress'

export default function ScrollToTop() {
  const progress = useScrollProgress()
  const visible = progress > 12

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed right-4 max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 z-40 flex h-12 w-12 items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-overlay-95)] text-stone-600 shadow-lg backdrop-blur-sm transition hover:border-stone-400 hover:text-stone-950 active:scale-95 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-amber-100"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          whileHover={{ y: -2 }}
          aria-label="Наверх"
        >
          {/* Circular progress ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-10" />
            <circle
              cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress / 100)}`}
              className="text-amber-600 transition-all duration-200"
            />
          </svg>
          <svg className="relative h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
