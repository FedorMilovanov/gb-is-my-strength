import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Тонкая золотая полоса прогресса прокрутки в самом верху страницы.
 * Премиум-деталь, не отвлекает, но даёт понимание положения.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.4,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[2px] origin-left"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, transparent, rgba(196,166,126,0.85), rgba(220,190,140,1), rgba(196,166,126,0.85), transparent)',
        boxShadow: '0 0 12px rgba(196,166,126,0.45)',
      }}
    />
  );
}
