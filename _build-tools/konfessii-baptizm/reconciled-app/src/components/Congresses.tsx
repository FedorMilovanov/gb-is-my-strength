import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, Users, MapPin, BookOpen } from 'lucide-react';
import { congresses, pashkovArchive } from '../data/history/congresses';

export default function Congresses() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section id="congresses" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="section-badge mb-5 justify-center"><Users size={12} /> Съезды и конгрессы</div>
          <h2 className="section-title">Ключевые собрания</h2>
          <p className="section-subtitle mx-auto max-w-3xl">Съезды, конгрессы и конференции, определившие историю русского баптизма.</p>
        </motion.div>
        <div className="space-y-4">
          {congresses.map((congress, index) => {
            const isOpen = openId === congress.id;
            return (
              <motion.article key={congress.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }} className="bento-card overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : congress.id)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                  <div className="flex items-center gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.875rem] ring-1 ring-brand-gold/20" style={{ background: 'rgba(196,166,126,0.10)' }}><Calendar size={18} className="text-brand-gold" /></div>
                    <div>
                      <div className="flex items-center gap-2"><span className="font-mono text-[11px] font-bold tracking-wider text-brand-gold">{congress.date}</span><span className="flex items-center gap-1 text-[11px] opacity-45"><MapPin size={9} />{congress.place.split(',')[0]}</span></div>
                      <h3 className="mt-0.5 text-[1.0625rem] font-bold">{congress.title}</h3>
                    </div>
                  </div>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-all"><ChevronDown size={14} className={`text-brand-gold/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="border-t border-white/10 px-5 pb-5">
                        <p className="mb-4 text-sm leading-6 opacity-80">{congress.summary}</p>
                        <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-50">Ключевые факты</p>
                          <ul className="space-y-1.5">{congress.facts.map((fact: string, i: number) => (<li key={i} className="flex items-start gap-2 text-sm opacity-75"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" /><span>{fact}</span></li>))}</ul>
                        </div>
                        {congress.source && (<p className="text-xs opacity-50"><BookOpen size={10} className="mr-1 inline" />Источник: {congress.source}</p>)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-12 bento-card p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><BookOpen size={22} /></div>
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-bold">Архив Пашкова — 7 000–10 000 документов</h3>
              <p className="mb-3 text-sm leading-6 opacity-80">{pashkovArchive.summary}</p>
              <div className="flex flex-wrap gap-2">{pashkovArchive.copies.map((copy: string, i: number) => (<span key={i} className="chip">{copy}</span>))}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
