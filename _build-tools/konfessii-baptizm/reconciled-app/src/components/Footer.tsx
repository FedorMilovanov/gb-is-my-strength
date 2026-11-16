import { BookOpen, ExternalLink } from 'lucide-react';
import { BUILD_INFO } from '../buildInfo';
const sources = ['журнал «Баптист» (1907–1929)','«Братский вестник» (с 1945)','baptistru.info','baptist.org.ru','rusbaptist.stunda.org','pravenc.ru','mbchurch.ru','ГМИР (архив протоколов)','enc.rusdeutsch.ru','bigenc.ru','Coleman 2007'];
export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07]">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 0%, rgba(196,166,126,0.04), transparent 55%), radial-gradient(ellipse at 80% 0%, rgba(196,166,126,0.03), transparent 50%)' }} />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-5 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-[0.75rem] ring-1 ring-brand-gold/25" style={{ background: 'rgba(196,166,126,0.10)' }}><BookOpen size={16} className="text-brand-gold" /></div><span className="text-[0.9375rem] font-black tracking-tight">Карта русского баптизма</span></div>
            <p className="max-w-xl text-[13px] leading-7 opacity-58">Интерактивная энциклопедия истории евангельских христиан-баптистов в России: истоки, союзы, гонения, расколы и современность.</p>
            <p className="mt-4 max-w-xl text-[11.5px] leading-6 opacity-40">Савинский С.Н. и Wikipedia не используются как финальная опора. Исторические данные сверяются с первоисточниками, архивными материалами ГМИР и замечаниями А.В. Синичкина.</p>
            <div className="mt-5 flex items-center gap-3"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-gold/45">{BUILD_INFO.id}</span></div>
          </div>
          <div>
            <p className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.18em] text-brand-gold/70">Источники</p>
            <div className="flex flex-wrap gap-1.5">{sources.map((source) => (<span key={source} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:border-white/[0.14] hover:text-white/80">{source}<ExternalLink size={9} className="opacity-50" /></span>))}</div>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-7">
          <p className="text-[11px] opacity-40">© 2025–2026 Карта русского баптизма · v6</p>
          <div className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5 text-[11px] opacity-40"><span className="h-1 w-1 rounded-full bg-brand-gold" />Открытый исторический проект</span></div>
        </div>
      </div>
    </footer>
  );
}
