// ============================================================
// CrashEffect — Screen Shake + Red Flash on Crash
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';

interface CrashEffectProps {
  multiplier: number;
}

const CrashEffect: React.FC<CrashEffectProps> = ({ multiplier }) => {
  return (
    <>
      {/* Red overlay flash */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 50 }}
        initial={{ backgroundColor: 'rgba(255, 0, 0, 0)' }}
        animate={{
          backgroundColor: [
            'rgba(255, 0, 0, 0)',
            'rgba(255, 0, 0, 0.15)',
            'rgba(255, 0, 0, 0.08)',
            'rgba(255, 0, 0, 0)',
          ],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />

      {/* Shatter lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 45 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.5 }}
      >
        <svg className="w-full h-full" viewBox="0 0 200 200">
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * 360;
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + Math.cos(rad) * 10;
            const y1 = 100 + Math.sin(rad) * 10;
            const x2 = 100 + Math.cos(rad) * 100;
            const y2 = 100 + Math.sin(rad) * 100;
            return (
              <motion.line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 100, 100, 0.6)"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
              />
            );
          })}
        </svg>
      </motion.div>

      {/* Shockwave ring */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-red-400/50 pointer-events-none"
        style={{ zIndex: 40 }}
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 15, opacity: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </>
  );
};

export default CrashEffect;