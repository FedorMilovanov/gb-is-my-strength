import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Landmark } from 'lucide-react';
import { organizations } from '../data/organizations';
export default function Organizations() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section id="organizations" className="relative py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center"><div className="section-badge mb-5 justify-center"><Landmark size={12} /> Союзы и объединения</div><h2 className="section-title">Ключевые организации</h2><p className="section-subtitle mx-auto max-w-3xl">От первого Союза баптистов 1884 года до современных организаций — история объединений, расколов и возрождений.</p></motion.div>
        <div className="space-y-3">
          {organizations.map((org: any, index: number) => { const isOpen = openIndex === index; return (
            <motion.div key={org.name} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.065 }} className="overflow-hidden rounded-[1.375rem] border transition-all duration-300" style={{ borderColor: isOpen ? `${org.color}40` : 'rgba(255,255,255,0.07)', background: isOpen ? `color-mix(in srgb, ${org.color} 5%, rgba(7,7,14,0.96))` : 'rgba(255,255,255,0.025)', boxShadow: isOpen ? `0 12px 44px rgba(0,0,0,0.32), 0 0 0 1px ${org.color}22` : 'none' }}>
              <button onClick={() => setOpenIndex(isOpen ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5" aria-expanded={isOpen}>
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="relative shrink-0">
                    <div className="h-3 w-3 rounded-full" style={{ background: org.color, boxShadow: `0 0 12px ${org.color}80, 0 0 0 3px ${org.color}22` }} />
                    {isOpen && <span className="absolute -inset-1.5 animate-ping rounded-full opacity-30" style={{ background: org.color }} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[1.0625rem] font-black">{org.name}</h3>
                      <span className="chip text-[10px]" style={{ fontFamily: 'var(--font-mono)', borderColor: `${org.color}35`, color: org.color, background: `${org.color}0d` }}>{org.years}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] opacity-50">{org.fullName}</p>
                  </div>
                </div>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300" style={{ borderColor: isOpen ? `${org.color}55` : 'rgba(255,255,255,0.10)', background: isOpen ? `${org.color}18` : 'rgba(255,255,255,0.04)' }}>
                  <ChevronDown size={14} style={{ color: isOpen ? org.color : 'rgba(240,238,235,0.5)' }} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              <AnimatePresence initial={false}>{isOpen && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden"><div className="border-t px-6 pb-6 pt-5" style={{ borderColor: `${org.color}20` }}><div className="grid gap-6 sm:grid-cols-2"><div className="space-y-4"><div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">Происхождение</p><p className="text-sm leading-6 opacity-82">{org.origin}</p></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">Численность</p><p className="font-mono text-xl font-black tracking-tight" style={{ color: org.color }}>{org.members}</p></div><div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">Позиция</p><p className="text-sm opacity-80">{org.position}</p></div></div><div className="space-y-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">Характеристики</p><ul className="space-y-1.5">{org.characteristics.map((c: string) => (<li key={c} className="flex items-start gap-2 text-sm leading-5 opacity-75"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: org.color }} />{c}</li>))}</ul></div>{org.keyLeaders.length > 0 && (<div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">Ключевые лидеры</p><div className="flex flex-wrap gap-1.5">{org.keyLeaders.map((l: string) => (<span key={l} className="chip">{l}</span>))}</div></div>)}{org.source && (<p className="text-[10px] opacity-45">Источник: {org.source}</p>)}</div></div></div></motion.div>)}</AnimatePresence>
            </motion.div>); })}
        </div>
      </div>
    </section>
  );
}
