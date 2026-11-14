import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useTheme } from './ThemeContext';
function MinimalCross({ isLight }: { isLight: boolean }) {
  const mainColor = isLight ? '#1a1a22' : '#c4a67e';
  const glowColor = isLight ? 'rgba(100,90,70,0.10)' : 'rgba(196,166,126,0.14)';
  const shadowColor = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.55)';
  return (<motion.div className="relative h-20 w-16 sm:h-[96px] sm:w-20" initial={{ scale: 0.6, opacity: 0, y: -12 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 130, damping: 14, delay: 0.1 }}><div className="absolute -inset-6 rounded-full blur-3xl" style={{ background: glowColor }} /><svg viewBox="0 0 60 80" className="relative z-10 h-full w-full" style={{ filter: `drop-shadow(0 10px 28px ${shadowColor})` }} aria-hidden="true"><rect x="17" y="0" width="6" height="76" rx="2.5" fill={mainColor} /><rect x="2" y="24" width="36" height="6" rx="2.5" fill={mainColor} /><rect x="24" y="60" width="12" height="3" rx="1.5" fill={mainColor} transform="rotate(20 30 61)" /></svg></motion.div>);
}
export default function Hero() {
  const { theme } = useTheme(); const isLight = theme === 'light';
  const bg = isLight ? 'linear-gradient(175deg, #f8f5f0 0%, #f2ede6 60%, #f8f5f0 100%)' : 'linear-gradient(175deg, #08080e 0%, #0d0d16 60%, #08080e 100%)';
  const textColor = isLight ? '#17171f' : '#f0ece6'; const subtitleColor = isLight ? '#6a6560' : '#a8a49f'; const mutedColor = isLight ? '#a8a49f' : '#6a6560'; const goldMain = isLight ? '#7c6540' : '#c4a67e'; const goldLight = isLight ? '#a87e4a' : '#ddb87a';
  return (
    <section id="hero" className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0" style={{ background: bg }} />
      {!isLight && (<><motion.div className="pointer-events-none absolute -left-56 -top-56 h-[700px] w-[700px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(196,166,126,0.07), transparent 68%)' }} animate={{ x: [0, 48, -18, 0], y: [0, -28, 32, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} /><motion.div className="pointer-events-none absolute -bottom-56 -right-56 h-[560px] w-[560px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(138,80,130,0.06), transparent 68%)' }} animate={{ x: [0, -28, 38, 0], y: [0, 22, -36, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} /></>)}
      <div className="absolute inset-0" style={{ backgroundImage: isLight ? 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)' : 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.024) 1px, transparent 0)', backgroundSize: '52px 52px' }} />
      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-32 text-center sm:px-8 sm:pt-36 lg:px-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.06 }} className="mb-9 flex justify-center"><MinimalCross isLight={isLight} /></motion.div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.22 }} className="section-badge mb-10">Интерактивная карта истории</motion.div>
        <motion.h1 initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72, delay: 0.32 }} className="mb-7 font-black tracking-tighter" style={{ fontSize: 'clamp(2.8rem, 8vw, 6.4rem)', lineHeight: '0.96', color: textColor }}><span className="block">Карта</span><span className="block" style={{ color: goldLight }}>Русского Баптизма</span></motion.h1>
        <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.44 }} className="mb-3 text-xl font-light tracking-wide" style={{ color: subtitleColor }}>От истоков к современности</motion.p>
        <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.52 }} className="mx-auto mb-16 max-w-lg text-[13px] leading-relaxed" style={{ color: mutedColor }}>Молокане и штундисты · Тифлис 1867 · Пашковцы · ВСЕХБ · Совет Церквей · РС ЕХБ</motion.p>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.62, delay: 0.6 }} className="mx-auto mb-16 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[{ value: '1867', label: 'Начало' },{ value: '3', label: 'Истока' },{ value: '66.7K', label: 'членов РС ЕХБ' },{ value: '157', label: 'Лет истории' }].map((stat, i) => (<motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.46, delay: 0.7 + i * 0.07 }} className="stat-card items-center text-center" style={{ background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.038)', borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(196,166,126,0.12)', boxShadow: isLight ? '0 4px 20px rgba(42,30,18,0.06)' : '0 4px 20px rgba(0,0,0,0.22)' }}><div className="stat-card-value text-2xl sm:text-[1.875rem]" style={{ color: goldLight }}>{stat.value}</div><div className="stat-card-label" style={{ color: mutedColor }}>{stat.label}</div></motion.div>))}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 1.1 }} className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#origins" className="group inline-flex items-center gap-2.5 rounded-full font-semibold text-[#1a1a1a] transition-all duration-300 hover:scale-[1.04] hover:shadow-xl" style={{ background: `linear-gradient(135deg, ${goldMain}, ${goldLight})`, padding: '0.9rem 2rem', boxShadow: '0 8px 28px rgba(196,166,126,0.30)' }}>Начать путешествие<ChevronDown className="transition-transform group-hover:translate-y-0.5" size={17} /></a>
            <a href="#mindmap" className="group inline-flex items-center gap-2.5 rounded-full border font-semibold transition-all duration-300 hover:scale-[1.04]" style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(196,166,126,0.30)', background: isLight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.04)', color: textColor, padding: '0.9rem 1.75rem' }}>
              <span style={{ color: goldLight }}>3D-карта</span>
              <ChevronDown className="transition-transform group-hover:translate-y-0.5 -rotate-90" size={15} />
            </a>
          </div>
          <span className="text-[11px] font-medium tracking-wider" style={{ color: mutedColor }}>Прокрутите вниз · 17 разделов истории</span>
        </motion.div>
      </div>
    </section>
  );
}
