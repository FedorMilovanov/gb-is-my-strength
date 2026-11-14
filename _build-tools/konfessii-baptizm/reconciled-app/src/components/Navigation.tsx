import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from './ThemeContext';
const navItems = [{ id: 'hero', label: 'Главная' },{ id: 'origins', label: 'Истоки' },{ id: 'mindmap', label: '3D Карта' },{ id: 'regional-notes', label: 'География' },{ id: 'timeline', label: 'Хроника' },{ id: 'congresses', label: 'Съезды' },{ id: 'organizations', label: 'Союзы' },{ id: 'figures', label: 'Лидеры' },{ id: 'archives', label: 'Источники' },{ id: 'glossary', label: 'Глоссарий' }];
export default function Navigation() {
  const { theme, toggle } = useTheme(); const isLight = theme === 'light';
  const navRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true); const lastScrollYRef = useRef(0); const rafRef = useRef(0); const [atTop, setAtTop] = useState(true); const [mobileOpen, setMobileOpen] = useState(false); const [activeId, setActiveId] = useState<string>('hero');
  useEffect(() => { const onScroll = () => { if (rafRef.current) return; rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; const y = window.scrollY; setAtTop(y < 80); if (y < 80) setVisible(true); else if (y > lastScrollYRef.current + 8) setVisible(false); else if (y < lastScrollYRef.current - 8) setVisible(true); lastScrollYRef.current = y; const sectionIds = navItems.map((item) => item.id); for (let i = sectionIds.length - 1; i >= 0; i--) { const el = document.getElementById(sectionIds[i]); if (el && el.getBoundingClientRect().top <= 120) { setActiveId(sectionIds[i]); break; } } }); }; window.addEventListener('scroll', onScroll, { passive: true }); return () => { window.removeEventListener('scroll', onScroll); if (rafRef.current) cancelAnimationFrame(rafRef.current); }; }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (navRef.current && target && !navRef.current.contains(target)) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [mobileOpen]);
  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setActiveId(id); setMobileOpen(false); };
  return (
    <AnimatePresence>{visible && (
      <motion.nav ref={navRef} initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} className="fixed left-1/2 top-4 z-[90] w-[96%] max-w-[82rem] -translate-x-1/2 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-[2rem] px-2.5 py-2" style={{ background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(7,7,12,0.80)', backdropFilter: 'blur(32px) saturate(220%)', WebkitBackdropFilter: 'blur(32px) saturate(220%)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(196,166,126,0.14)'}`, boxShadow: atTop ? `0 2px 16px rgba(0,0,0,${isLight ? '0.06' : '0.28'})` : `0 16px 48px rgba(0,0,0,${isLight ? '0.12' : '0.5'}), 0 0 0 1px rgba(196,166,126,0.06)` }}>
          <button onClick={() => scrollTo('hero')} className="flex shrink-0 items-center gap-2 rounded-[1.5rem] border px-3 py-2.5 text-left transition-all duration-300 hover:shadow-md" style={{ color: isLight ? '#1a1a1a' : '#f7f1eb', borderColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(196,166,126,0.20)', background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.03)' }} aria-label="Перейти на главную">
            <svg viewBox="0 0 24 32" className="h-7 w-5 shrink-0" fill="none" aria-hidden="true"><rect x="10.5" y="0" width="3" height="32" rx="1" fill="currentColor" /><rect x="3" y="9" width="18" height="3.5" rx="1" fill="currentColor" /><rect x="14" y="22" width="7" height="1.6" rx="0.8" fill="currentColor" transform="rotate(20 17.5 22.7)" /></svg>
            <span className="leading-tight"><span className="block text-[10px] font-black uppercase tracking-[0.25em]">Русский баптизм</span><span className="block text-[8px] font-bold uppercase tracking-[0.22em]" style={{ color: isLight ? '#8a7050' : '#c4a67e' }}>Карта истории</span></span>
          </button>
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-0 xl:flex">
            {navItems.map((item) => { const isActive = activeId === item.id; return (<button key={item.id} onClick={() => scrollTo(item.id)} className="relative whitespace-nowrap rounded-full px-2.5 py-2 text-[11px] font-semibold tracking-wide transition-all duration-200" style={{ color: isActive ? (isLight ? '#1a1a1a' : '#f7f1eb') : (isLight ? 'rgba(23,23,23,0.52)' : 'rgba(240,238,235,0.52)'), background: isActive ? (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.09)') : 'transparent' }}>{item.label}{isActive && (<motion.span layoutId="nav-indicator" className="absolute bottom-1.5 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full" style={{ background: isLight ? '#8a7050' : '#c4a67e' }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />)}</button>); })}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full transition-all hover:scale-110" style={{ color: isLight ? '#8a7050' : '#c4a67e', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(196,166,126,0.08)' }} aria-label="Переключить тему">{isLight ? <Moon size={16} /> : <Sun size={16} />}</button>
            <button onClick={() => setMobileOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full transition-all hover:scale-110 xl:hidden" style={{ color: isLight ? '#8a7050' : '#c4a67e', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(196,166,126,0.08)' }} aria-label="Открыть меню">{mobileOpen ? <X size={16} /> : <Menu size={16} />}</button>
          </div>
        </div>
        <AnimatePresence>{mobileOpen && (
          <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto fixed inset-0 -z-10 bg-black/20 xl:hidden" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 8 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="pointer-events-auto ml-auto mr-2 mt-1 w-[min(340px,92vw)] overflow-hidden rounded-[1.5rem] border shadow-2xl backdrop-blur-2xl xl:hidden"
            style={{
              background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(7,7,12,0.92)',
              borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(196,166,126,0.16)',
              boxShadow: isLight ? '0 20px 50px rgba(42,30,18,0.18)' : '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(196,166,126,0.06)',
            }}
          >
            <div className="grid grid-cols-2 gap-px p-2">
              {navItems.map((item) => {
                const isActive = activeId === item.id;
                const activeColor = isLight ? '#7c6540' : '#c4a67e';
                const idleColor = isLight ? 'rgba(23,23,23,0.72)' : 'rgba(240,238,235,0.72)';
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="rounded-2xl px-4 py-3 text-left text-[11.5px] font-semibold transition-all"
                    style={{
                      color: isActive ? activeColor : idleColor,
                      background: isActive ? (isLight ? 'rgba(196,166,126,0.16)' : 'rgba(196,166,126,0.10)') : 'transparent',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
          </>
        )}</AnimatePresence>
      </motion.nav>
    )}</AnimatePresence>
  );
}
