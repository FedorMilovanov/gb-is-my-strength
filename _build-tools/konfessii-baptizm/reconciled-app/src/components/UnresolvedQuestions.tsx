import { motion } from 'framer-motion';
import { AlertCircle, HelpCircle } from 'lucide-react';
import { unresolvedQuestionsV6 } from '../data/history/unresolved';
export default function UnresolvedQuestions() {
  return (
    <section id="unresolved" className="relative py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-500/24 bg-amber-500/10 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-amber-400"><HelpCircle size={12} /> Открытые вопросы</div>
          <h2 className="section-title">Нерешённые вопросы v6</h2>
          <p className="section-subtitle mx-auto max-w-3xl">Эти вопросы требуют дополнительной архивной работы, сверки с первичными источниками или обращения к специалистам.</p>
        </motion.div>
        <div className="space-y-2.5">
          {unresolvedQuestionsV6.map((question: string, i: number) => (
            <motion.div key={question} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.038 }} className="group relative overflow-hidden rounded-[1.1rem] border border-white/[0.07] bg-white/[0.022] p-4 transition-all hover:border-amber-500/28 hover:bg-white/[0.04]">
              <div className="absolute left-0 top-0 h-full w-[3px] rounded-full bg-gradient-to-b from-amber-500/70 to-amber-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="flex items-start gap-3 pl-1">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}><AlertCircle size={14} /></div>
                <p className="flex-1 text-[13px] leading-[1.68] opacity-82">{question}</p>
                <div className="mt-0.5 shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>v6</div>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-10 overflow-hidden rounded-[1.375rem] border border-amber-500/20 text-center" style={{ background: 'color-mix(in srgb, #f59e0b 5%, rgba(5,5,12,0.96))' }}>
          <div className="p-8">
            <p className="mb-2 text-[15px] font-black text-amber-400">Приглашаем к сотрудничеству</p>
            <p className="mx-auto max-w-2xl text-[13px] leading-[1.7] opacity-72">Если у вас есть доступ к архивам Пашкова в Бирмингеме, автобиографии Кальвейта 1913 года или другим первичным источникам — помогите уточнить эти вопросы.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
