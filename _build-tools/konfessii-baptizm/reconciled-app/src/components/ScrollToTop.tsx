import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 800);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleClick}
          aria-label="Наверх"
          title="Наверх"
          className="fixed bottom-[5.5rem] right-5 z-[94] grid h-11 w-11 place-items-center rounded-full border text-brand-gold backdrop-blur-2xl transition-colors hover:text-white"
          style={{
            background: 'rgba(5,5,12,0.72)',
            borderColor: 'rgba(196,166,126,0.30)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(196,166,126,0.08)',
          }}
        >
          <ArrowUp size={16} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
