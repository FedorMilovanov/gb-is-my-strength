import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Search, UserRound } from 'lucide-react';
import { keyPersonCards } from '../data/history/persons';
export default function KeyFigures() {
  const [query, setQuery] = useState(''); const [openPerson, setOpenPerson] = useState<string | null>(null);
  const filtered = useMemo(() => { const n = query.trim().toLowerCase(); if (!n) return keyPersonCards; return keyPersonCards.filter((f) => [f.name, f.role, f.region, f.contribution, f.highlights.join(' ')].join(' ').toLowerCase().includes(n)); }, [query]);
  return (
    <section id="figures" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12 text-center"><div className="section-badge mb-5 justify-center"><UserRound size={12} /> Ключевые фигуры</div><h2 className="section-title">Люди, через которых шла история</h2><p className="section-subtitle mx-auto max-w-3xl">Пионеры, издатели, богословы, организаторы и лидеры разных этапов русского баптизма.</p></motion.div>
        <div className="mx-auto mb-8 flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 transition-all focus-within:border-brand-gold/35 focus-within:bg-white/[0.06]"><Search size={16} className="shrink-0 text-brand-gold/70" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя, роль или регион…" className="w-full bg-transparent text-[0.8375rem] outline-none placeholder:text-white/28" />{query && (<button onClick={() => setQuery('')} className="shrink-0 rounded-full p-1 text-white/35 hover:text-white/70">✕</button>)}</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((figure: any, index: number) => { const isOpen = openPerson === figure.name; return (
            <motion.article key={figure.name} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(index * 0.04, 0.22) }} className="flex flex-col overflow-hidden rounded-[1.375rem] border border-white/[0.08] bg-white/[0.025] transition-all duration-300 hover:border-white/[0.14] hover:bg-white/[0.04]">
              <div className="flex items-start gap-4 p-6 pb-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.875rem] ring-1 ring-brand-gold/20" style={{ background: 'rgba(196,166,126,0.10)' }}><UserRound size={20} className="text-brand-gold" /></div><div className="min-w-0"><h3 className="truncate text-[1.0625rem] font-black leading-tight">{figure.name}</h3><p className="mt-0.5 font-mono text-[11px] font-bold text-brand-gold">{figure.years}</p></div></div>
              <div className="px-6 pb-4"><span className="chip-accent chip text-[9px]">{figure.role}</span></div>
              <div className="px-6 pb-4"><p className="text-[0.8125rem] leading-[1.65] opacity-72">{figure.contribution}</p></div>
              {figure.highlights.length > 0 && (<div className="px-6 pb-4"><div className="space-y-1.5">{figure.highlights.slice(0, isOpen ? figure.highlights.length : 3).map((h: string) => (<p key={h} className="flex items-start gap-2 text-[11px] leading-5 opacity-65"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold/70" />{h}</p>))}</div></div>)}
              <div className="mx-6 mb-4 rounded-[0.875rem] border border-white/[0.08] bg-white/[0.04] p-4 text-[11px] leading-5 opacity-70"><p><span className="opacity-55">Регион:</span> {figure.region}</p>{figure.fate && <p className="mt-1.5"><span className="opacity-55">Судьба:</span> {figure.fate}</p>}{figure.source && (<p className="mt-1.5"><span className="text-brand-gold/75">{figure.source}</span></p>)}{figure.chronology.length > 0 && (<div className="mt-3"><p className="mb-1 opacity-55">Хронология:</p><ul className="space-y-1">{figure.chronology.slice(0, isOpen ? figure.chronology.length : 4).map((item: any) => (<li key={`${figure.name}-${item.year}`} className="flex items-start gap-2"><span className="shrink-0 font-mono text-brand-gold/75">{item.year}</span><span>{item.text}</span></li>))}</ul></div>)}</div>
              {(figure.highlights.length > 3 || figure.chronology.length > 4) && (<div className="mt-auto px-6 pb-5"><button onClick={() => setOpenPerson(isOpen ? null : figure.name)} className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/28 bg-brand-gold/[0.08] px-3.5 py-1.5 text-[11px] font-semibold text-brand-gold transition hover:bg-brand-gold/[0.14]">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{isOpen ? 'Свернуть досье' : 'Показать полное досье'}</button></div>)}
            </motion.article>); })}
        </div>
      </div>
    </section>
  );
}
