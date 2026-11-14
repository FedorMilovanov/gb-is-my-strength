import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, Loader2, Network, Sparkles, X, Maximize2 } from 'lucide-react';
import { useTheme } from './ThemeContext';

// Lazy-load тяжёлого 3D-компонента — грузится ТОЛЬКО при открытии
const MindMap3D = lazy(() => import('./MindMap3D'));

/* ─── Cinematic loading screen ─── */
function LoadingScreen() {
  const [step, setStep] = useState(0);
  const steps = [
    'Инициализация архивов…',
    'Построение связей…',
    'Загрузка 3D-сцены…',
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 600);
    const t2 = setTimeout(() => setStep(2), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-10"
      style={{ background: 'radial-gradient(ellipse at 50% 38%, rgba(196,166,126,0.10), transparent 58%), #050508' }}
    >
      {/* SVG кольцо прогресса + глобус в центре */}
      <div className="relative h-24 w-24">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 96 96">
          {/* Трек */}
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(196,166,126,0.12)" strokeWidth="3" />
          {/* Прогресс */}
          <motion.circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke="rgba(196,166,126,0.85)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 40}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - (step + 1) / steps.length) }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(196,166,126,0.55))' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className="grid h-14 w-14 place-items-center rounded-full"
            style={{ background: 'rgba(196,166,126,0.10)', boxShadow: '0 0 32px rgba(196,166,126,0.18)' }}
          >
            <Globe size={28} className="text-brand-gold" />
          </motion.div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col items-start gap-2.5">
        {steps.map((text, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: i <= step ? 1 : 0.22, x: i <= step ? 0 : -4 }}
            transition={{ duration: 0.35, delay: i * 0.08 }}
            className="flex items-center gap-3"
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              {i < step ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-1.5 w-1.5 rounded-full bg-brand-gold" style={{ boxShadow: '0 0 8px rgba(196,166,126,0.7)' }} />
              ) : i === step ? (
                <Loader2 size={14} className="animate-spin text-brand-gold" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-white/18" />
              )}
            </span>
            <span className={`text-[12.5px] font-medium tracking-wide ${i < step ? 'text-white/55 line-through decoration-brand-gold/40' : i === step ? 'text-white/88' : 'text-white/25'}`}>
              {text}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/20">
        Карта русского баптизма · 1867
      </p>
    </motion.div>
  );
}

/* ─── Teaser card with animated background ─── */
function TeaserBackground({ isLight }: { isLight: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Night sky / warm paper base */}
      <div
        className="absolute inset-0"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, #f5f0e8, #ede5d8 50%, #f0ece4)'
            : 'linear-gradient(135deg, #08080e, #0c0c16 50%, #08080e)',
        }}
      />

      {/* Animated orbs (премиум многослойное свечение) */}
      <motion.div
        className="absolute h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(196,166,126,0.15), transparent 60%)',
          left: '10%',
          top: '15%',
        }}
        animate={{ x: [0, 40, -20, 0], y: [0, -25, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-[380px] w-[380px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139,77,255,0.10), transparent 60%)',
          right: '8%',
          bottom: '12%',
        }}
        animate={{ x: [0, -30, 25, 0], y: [0, 22, -28, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-[300px] w-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0,200,200,0.08), transparent 60%)',
          left: '50%',
          top: '8%',
        }}
        animate={{ x: [0, 25, -18, 0], y: [0, -18, 25, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grid dots */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isLight
            ? 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)'
            : 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Decorative network lines — схема связей истоков */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 400" aria-hidden="true">
        {/* Связи */}
        <line x1="120" y1="90"  x2="400" y2="195" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.8" opacity="0.18" strokeDasharray="4 6" />
        <line x1="400" y1="195" x2="680" y2="110" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.8" opacity="0.18" strokeDasharray="4 6" />
        <line x1="400" y1="195" x2="260" y2="315" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.8" opacity="0.18" strokeDasharray="4 6" />
        <line x1="400" y1="195" x2="590" y2="330" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.8" opacity="0.18" strokeDasharray="4 6" />
        <line x1="120" y1="90"  x2="260" y2="315" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.5" opacity="0.1" strokeDasharray="3 8" />
        <line x1="680" y1="110" x2="590" y2="330" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.5" opacity="0.1" strokeDasharray="3 8" />
        {/* Узлы */}
        <circle cx="400" cy="195" r="5.5" fill={isLight ? '#8a7050' : '#c4a67e'} opacity="0.55" />
        <circle cx="400" cy="195" r="11"  fill="none" stroke={isLight ? '#8a7050' : '#c4a67e'} strokeWidth="0.6" opacity="0.18" />
        <circle cx="120" cy="90"  r="3.5" fill={isLight ? '#ff64b4' : '#ff64b4'} opacity="0.55" />
        <circle cx="680" cy="110" r="3.5" fill={isLight ? '#00c8c8' : '#00c8c8'} opacity="0.55" />
        <circle cx="260" cy="315" r="3.5" fill={isLight ? '#f0a830' : '#f0a830'} opacity="0.55" />
        <circle cx="590" cy="330" r="3"   fill={isLight ? '#8b4dff' : '#8b4dff'} opacity="0.42" />
        {/* Метки */}
        <text x="120" y="79" textAnchor="middle" fill={isLight ? '#8a7050' : '#ff64b4'} fontSize="10" fontFamily="Inter,sans-serif" opacity="0.5">Петербург 1874</text>
        <text x="680" y="99" textAnchor="middle" fill={isLight ? '#8a7050' : '#00c8c8'} fontSize="10" fontFamily="Inter,sans-serif" opacity="0.5">Тифлис 1867</text>
        <text x="260" y="333" textAnchor="middle" fill={isLight ? '#8a7050' : '#f0a830'} fontSize="10" fontFamily="Inter,sans-serif" opacity="0.5">Украина 1869</text>
        <text x="400" y="213" textAnchor="middle" fill={isLight ? '#8a7050' : '#d4a857'} fontSize="11" fontWeight="bold" fontFamily="Inter,sans-serif" opacity="0.6">ЕХБ</text>
      </svg>
    </div>
  );
}

/* ─── Stats mini-row ─── */
const STATS = [
  { value: '23', label: 'узла' },
  { value: '27', label: 'связей' },
  { value: '5', label: 'маршрутов' },
  { value: '1867–', label: 'современность' },
];

/* ─── Shared site overlay authority (also used by other special overlays) ─── */
const OVERLAY_OWNER = 'special:konfessii-mindmap-launcher';
type SiteOverlayRuntime = {
  open(owner: string, options: {
    element: HTMLElement | null;
    opener: Element | null;
    focusTarget: Element | null;
    onRequestClose(): boolean;
    closeOnEscape: boolean;
    trapFocus: boolean;
    restoreFocus: boolean;
  }): unknown;
  close(owner: string, reason: string, options?: { restoreFocus?: boolean }): boolean;
  isOpen(owner: string): boolean;
};
function siteOverlayRuntime(): SiteOverlayRuntime | undefined {
  const site = window as typeof window & {
    OverlayRuntime?: SiteOverlayRuntime;
    SiteUtils?: { OverlayRuntime?: SiteOverlayRuntime };
  };
  return site.OverlayRuntime ?? site.SiteUtils?.OverlayRuntime;
}

/* ─── Main launcher ─── */
export default function MindMapLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const preloadMap = useCallback(() => {
    void import('./MindMap3D');
  }, []);

  const handleOpen = useCallback(() => {
    if (!siteOverlayRuntime()) {
      console.error('The 3D launcher requires the shared site OverlayRuntime');
      return;
    }
    setIsLoading(true);
    setIsOpen(true);
    // Loading screen shows for at least 1.8s for cinematic feel.
    setTimeout(() => setIsLoading(false), 1800);
  }, []);

  const handleClose = useCallback(() => {
    const runtime = siteOverlayRuntime();
    if (runtime?.isOpen(OVERLAY_OWNER)) runtime.close(OVERLAY_OWNER, 'close');
    setIsOpen(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const runtime = siteOverlayRuntime();
    if (!runtime) return;
    const element = document.getElementById('konfessii-mindmap-overlay');
    const focusTarget = element?.querySelector('button[title^="Закрыть 3D-карту"]') ?? null;
    runtime.open(OVERLAY_OWNER, {
      element,
      opener: document.activeElement,
      focusTarget,
      onRequestClose: () => { handleClose(); return false; },
      closeOnEscape: true,
      trapFocus: true,
      restoreFocus: true,
    });
    return () => {
      if (runtime.isOpen(OVERLAY_OWNER)) runtime.close(OVERLAY_OWNER, 'unmount', { restoreFocus: false });
    };
  }, [isOpen, handleClose]);

  const goldMain = isLight ? '#7c6540' : '#c4a67e';
  const goldLight = isLight ? '#a87e4a' : '#ddb87a';

  return (
    <>
      {/* ═══════════════════════════════════════════════════
          ТИЗЕР НА ГЛАВНОЙ СТРАНИЦЕ
          ═══════════════════════════════════════════════════ */}
      <section id="mindmap" className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-[2rem] border shadow-2xl"
            style={{
              borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(196,166,126,0.15)',
              boxShadow: isLight
                ? '0 32px 80px rgba(42,30,18,0.12)'
                : '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(196,166,126,0.06)',
            }}
          >
            <TeaserBackground isLight={isLight} />

            <div className="relative z-10 flex flex-col items-center px-6 py-20 text-center sm:px-12 sm:py-28 lg:py-32">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="section-badge mb-6"
              >
                <Network size={12} /> Интерактивный архив
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mb-4 font-black tracking-tighter"
                style={{
                  fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
                  lineHeight: 1.05,
                  color: isLight ? '#17171f' : '#f0ece6',
                }}
              >
                 Интерактивная 3D-карта{' '}
                 <span style={{ color: goldLight }}>истории ЕХБ</span>
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mx-auto mb-10 max-w-2xl text-[15px] leading-7"
                style={{ color: isLight ? 'rgba(23,23,23,0.6)' : 'rgba(240,238,235,0.55)' }}
              >
                 От Тифлиса 1867 до наших дней — исследуйте три истока, формирование союзов
                 и географию движения в интерактивном трёхмерном пространстве.
                 Выбирайте маршруты, изучайте личности и связи.
              </motion.p>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mb-10 flex flex-wrap justify-center gap-3 sm:gap-5"
              >
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 rounded-full border px-4 py-2"
                    style={{
                      borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
                      background: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.035)',
                    }}
                  >
                    <span className="text-sm font-black" style={{ color: goldLight }}>{s.value}</span>
                    <span className="text-[11px] font-medium" style={{ color: isLight ? 'rgba(23,23,23,0.5)' : 'rgba(240,238,235,0.4)' }}>{s.label}</span>
                  </div>
                ))}
              </motion.div>

              {/* CTA Button — пульсирующая золотая кнопка */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="relative inline-block"
              >
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.32, 0.55, 0.32] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 -z-10 rounded-full blur-2xl"
                  style={{ background: `radial-gradient(circle, ${goldMain}66, transparent 70%)` }}
                />
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: '0 16px 48px rgba(196,166,126,0.42)' }}
                  whileTap={{ scale: 0.97 }}
                  onMouseEnter={preloadMap}
                  onFocus={preloadMap}
                  onClick={handleOpen}
                  className="group relative inline-flex items-center gap-3 rounded-full font-bold text-[#1a1109] transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${goldMain}, ${goldLight}, ${goldMain})`,
                    padding: '1rem 2.5rem',
                    boxShadow: '0 8px 32px rgba(196,166,126,0.32), inset 0 1px 0 rgba(255,255,255,0.35)',
                    fontSize: '0.9375rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Sparkles size={18} className="transition-transform group-hover:rotate-12" />
                  Войти в 3D-карту
                  <Maximize2 size={15} className="opacity-60 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              </motion.div>

              {/* Hint */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 }}
                className="mt-5 text-[11px] font-medium"
                style={{ color: isLight ? 'rgba(23,23,23,0.35)' : 'rgba(240,238,235,0.3)' }}
              >
                Полноэкранный режим · вращение · маршруты · инспектор узлов
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FULL-SCREEN 3D MAP (lazy-loaded)
          ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="mindmap-fullscreen"
            id="konfessii-mindmap-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Интерактивная 3D-карта истории ЕХБ"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999]"
            style={{ background: '#050508' }}
          >
            {/* Close pill — top-center, не пересекается с инспектором (слева) и controls (справа) */}
            <motion.button
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 280, damping: 24 }}
              onClick={handleClose}
              className="group absolute left-1/2 top-4 z-[10001] -translate-x-1/2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70 backdrop-blur-xl transition-all hover:bg-white/15 hover:text-white active:scale-95"
              style={{
                background: 'rgba(5,5,12,0.7)',
                borderColor: 'rgba(196,166,126,0.22)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(196,166,126,0.04)',
              }}
              title="Закрыть 3D-карту (Esc)"
            >
              <X size={13} className="transition-transform group-hover:rotate-90" />
              Закрыть карту
              <kbd className="ml-1 hidden rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-mono font-normal text-white/45 sm:inline">Esc</kbd>
            </motion.button>

            {/* Loading screen */}
            <AnimatePresence>
              {isLoading && <LoadingScreen />}
            </AnimatePresence>

            {/* The actual 3D component */}
            <Suspense fallback={<LoadingScreen />}>
              <div className={`h-[100dvh] w-screen ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000`}>
                <MindMap3D />
              </div>
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
