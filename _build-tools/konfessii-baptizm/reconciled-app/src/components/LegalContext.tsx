import { motion } from 'framer-motion';
import { Gavel, ShieldAlert } from 'lucide-react';
import { legalRecords } from '../data/history/legal';
export default function LegalContext() {
  return (
    <section id="legal-context" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="section-badge mb-5 justify-center"><Gavel size={12} /> Правовой контекст</div>
          <h2 className="section-title">Законы, легализация и преследование</h2>
          <p className="section-subtitle mx-auto max-w-3xl">От частичного признания общин до законов, позволявших преследовать евангельских христиан как сектантов.</p>
        </motion.div>
        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-transparent via-brand-gold/35 to-transparent md:left-1/2" />
          <div className="space-y-8">
            {legalRecords.map((record, index) => {
              const alignRight = index % 2 === 0;
              return (
                <motion.article key={record.title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className={`relative md:flex ${alignRight ? 'md:justify-start' : 'md:justify-end'}`}>
                  <div className="absolute left-4 top-8 z-10 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-brand-gold/35 bg-black text-brand-gold md:left-1/2" style={{ boxShadow: '0 0 16px rgba(196,166,126,0.22)' }}><ShieldAlert size={14} /></div>
                   <div className="ml-10 w-[calc(100%-2.75rem)] overflow-hidden rounded-[1.375rem] border border-white/[0.08] bg-white/[0.025] p-4 transition-all hover:border-brand-gold/25 hover:bg-white/[0.04] hover:shadow-lg sm:ml-12 sm:w-[calc(100%-3rem)] sm:p-6 md:ml-0 md:w-[47%]" style={{ transition: 'border-color 0.28s, background 0.28s, box-shadow 0.28s' }}>
                     <div className="mb-3 flex items-center gap-3">
                       <span className="chip chip-accent font-mono">{record.year}</span>
                     </div>
                     <h3 className="mb-3 text-[1.0625rem] font-black leading-tight">{record.title}</h3>
                     <p className="mb-4 text-[0.8375rem] leading-[1.7] opacity-78">{record.summary}</p>
                     <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-[11.5px] leading-[1.6] opacity-68">{record.significance}</div>
                     <p className="mt-3 text-[10.5px] text-brand-gold/55">Источник: {record.source}</p>
                   </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
