import { motion } from 'framer-motion';
import { Scale } from 'lucide-react';

const rows = [
  { aspect: 'Происхождение', rs: 'Преемник ВСЕХБ после распада СССР, официальный союз.', msc: 'Вырос из инициативного движения (1961), оформлен как СЦ ЕХБ в 1965.' },
  { aspect: 'Регистрация', rs: 'Церкви зарегистрированы и действуют в правовом поле.', msc: 'Принципиальный отказ от регистрации в советский период.' },
  { aspect: 'Численность', rs: '66 732 члена / 1 413 церквей по BWA.', msc: 'Отдельный корпус; прежние оценки требуют источниковой оговорки.' },
  { aspect: 'Издательская база', rs: 'Журнал «Братский вестник», семинарские материалы.', msc: 'Подпольные издания: «Христианин», «Вестник истины», бюллетени узников.' },
  { aspect: 'Модель взаимодействия', rs: 'Официальный диалог с государством и обществом.', msc: 'Акцент на независимость общин и церковную дисциплину.' },
];

export default function Comparison() {
  return (
    <section id="comparison" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12 text-center">
          <div className="section-badge mb-5 justify-center"><Scale size={12} /> Сравнение</div>
          <h2 className="section-title">РС ЕХБ и МСЦ ЕХБ</h2>
          <p className="section-subtitle mx-auto max-w-3xl">Нейтральный обзор двух ветвей, возникших после советского раскола 1960-х годов.</p>
        </motion.div>
        {/* Десктоп — таблица */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bento-card hidden md:block">
          <table className="premium-table">
            <thead><tr><th className="w-[22%]">Параметр</th><th className="w-[39%] text-blue-400">РС ЕХБ</th><th className="w-[39%] text-red-400">МСЦ ЕХБ</th></tr></thead>
            <tbody>{rows.map((row, i) => (<tr key={row.aspect} className={i % 2 === 0 ? '' : 'bg-white/[0.018]'}><td className="font-semibold text-white/85">{row.aspect}</td><td>{row.rs}</td><td>{row.msc}</td></tr>))}</tbody>
          </table>
        </motion.div>

        {/* Мобайл — стопка карточек, без скролла */}
        <div className="space-y-4 md:hidden">
          {rows.map((row, i) => (
            <motion.div
              key={row.aspect}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bento-card p-5"
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold/75">{row.aspect}</p>
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-400/20 bg-blue-400/[0.04] p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-blue-400">РС ЕХБ</p>
                  <p className="text-[12.5px] leading-5 text-white/80">{row.rs}</p>
                </div>
                <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-400">МСЦ ЕХБ</p>
                  <p className="text-[12.5px] leading-5 text-white/80">{row.msc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
