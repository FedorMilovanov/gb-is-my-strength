import { motion } from 'framer-motion';
import { Archive, BookOpen, FileText, Globe, MapPin, Scale } from 'lucide-react';
import { primarySources, archiveLocations, sourceCorrections, foreignWorksFlaggedByVsehb } from '../data/history/sources';
import { confessionRecords } from '../data/history/theology';
import { congresses, pashkovArchive } from '../data/history/congresses';
import { legalRecords } from '../data/history/legal';

export default function Archives() {
  return (
    <section id="archives" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="section-badge mb-5 justify-center"><Archive size={12} /> Источники и архивы</div>
          <h2 className="section-title">Первоисточники и архивные находки</h2>
          <p className="section-subtitle mx-auto max-w-3xl">Критически важные документы, архивные коллекции и исправления предыдущих версий на основе v6.</p>
        </motion.div>
        <div className="mb-16 grid gap-6 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bento-card p-6">
            <div className="mb-4 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><BookOpen size={22} /></div><h3 className="text-lg font-bold">Первичные источники</h3></div>
            <ul className="space-y-2.5">{primarySources.map((source, i) => (<li key={i} className="flex items-start gap-2 text-sm opacity-80"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" /><span>{source}</span></li>))}</ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bento-card p-6">
            <div className="mb-4 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><MapPin size={22} /></div><h3 className="text-lg font-bold">Архивные локации</h3></div>
            <ul className="space-y-2.5">{archiveLocations.map((location, i) => (<li key={i} className="flex items-start gap-2 text-sm opacity-80"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" /><span>{location}</span></li>))}</ul>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16 bento-card overflow-hidden">
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2"><FileText className="text-brand-gold" size={18} /><h3 className="text-lg font-bold">Архив В. А. Пашкова</h3></div>
              <p className="mb-4 text-sm leading-6 opacity-80">{pashkovArchive.summary}</p>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-50">Микрофильмы в:</p>
                <ul className="space-y-1.5">{pashkovArchive.copies.map((copy, i) => (<li key={i} className="flex items-start gap-2 text-xs opacity-75"><Globe size={12} className="mt-0.5 shrink-0 text-brand-gold" /><span>{copy}</span></li>))}</ul>
              </div>
            </div>
            <div className="border-t border-white/10 p-6 md:border-l md:border-t-0">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-60">Ключевые съезды</h4>
              <div className="space-y-3">{congresses.map((congress) => (<div key={congress.id} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"><div className="mb-1 flex items-center justify-between"><span className="text-xs font-bold text-brand-gold">{congress.date}</span><span className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold text-brand-gold">{congress.place.split(',')[0]}</span></div><p className="text-sm font-semibold">{congress.title}</p><p className="mt-1 text-xs opacity-60">{congress.summary.slice(0, 80)}...</p></div>))}</div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bento-card p-6">
          <div className="mb-4 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-400"><FileText size={22} /></div><h3 className="text-lg font-bold">Исправления источников (v6)</h3></div>
          <div className="grid gap-4 md:grid-cols-2">{sourceCorrections.map((correction, i) => (<div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><div className="mb-2 flex items-center gap-2"><span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">Исправлено</span><span className="text-sm font-semibold">{correction.topic}</span></div><p className="mb-2 text-xs opacity-50 line-through">{correction.previous}</p><p className="text-sm opacity-80">{correction.corrected}</p><p className="mt-2 text-xs opacity-50">{correction.source}</p></div>))}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6 bento-card p-6">
          <div className="mb-4 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><Globe size={22} /></div><div><h3 className="text-lg font-bold">Зарубежные работы, отмеченные ВСЕХБ</h3><p className="text-xs opacity-55">В предисловии ВСЕХБ 1989 они упомянуты как недостаточно точные и требующие сверки.</p></div></div>
          <div className="flex flex-wrap gap-2">{foreignWorksFlaggedByVsehb.map((work) => (<span key={work} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs opacity-75">{work}</span>))}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6 bento-card p-6">
          <div className="mb-4 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><BookOpen size={22} /></div><div><h3 className="text-lg font-bold">Вероучительные тексты как источники</h3><p className="text-xs opacity-55">Исторические документы, которые важны не только для богословия, но и для реконструкции идентичности братства.</p></div></div>
          <div className="grid gap-4 md:grid-cols-3">{confessionRecords.map((record) => (<div key={record.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="font-mono text-xs text-brand-gold">{record.year}</p><h4 className="mt-1 text-sm font-bold">{record.title}</h4><p className="mt-1 text-xs opacity-55">{record.authorOrTranslator}</p><p className="mt-3 text-xs leading-5 opacity-70">{record.significance}</p></div>))}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6 bento-card p-6">
          <div className="mb-4 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><Scale size={22} /></div><div><h3 className="text-lg font-bold">Правовой контекст и легализация</h3><p className="text-xs opacity-55">Ключевые законы и акты, определявшие статус баптистских общин в Российской Империи.</p></div></div>
          <div className="grid gap-4 md:grid-cols-3">{legalRecords.map((record) => (<div key={record.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="font-mono text-xs text-brand-gold">{record.year}</p><h4 className="mt-1 text-sm font-bold">{record.title}</h4><p className="mt-2 text-sm leading-6 opacity-70">{record.summary}</p><p className="mt-2 text-xs leading-5 opacity-55 font-medium">{record.significance}</p><p className="mt-2 text-[10px] opacity-40">Источник: {record.source}</p></div>))}</div>
        </motion.div>
      </div>
    </section>
  );
}
