// ============================================================
// MultiplierDisplay — Real-Time Multiplier View
// ============================================================
// Shows the current multiplier with:
//   - Large animated number
//   - Color changes based on threshold
//   - Scale pulse on each tick
//   - World-appropriate styling
// ============================================================

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '@sky-kingdom/shared';
import type { WorldId } from '@sky-kingdom/shared';

interface MultiplierDisplayProps {
  multiplier: number;
  state: GameState;
  world: WorldId;
}

function getMultiplierColor(multiplier: number): string {
  if (multiplier >= 100) return 'text-purple-300';
  if (multiplier >= 50) return 'text-purple-400';
  if (multiplier >= 25) return 'text-blue-400';
  if (multiplier >= 10) return 'text-cyan-400';
  if (multiplier >= 5) return 'text-yellow-300';
  if (multiplier >= 2) return 'text-green-400';
  return 'text-white';
}

function getMultiplierGlow(multiplier: number): string {
  if (multiplier >= 100) return '0 0 60px rgba(200,100,255,0.5)';
  if (multiplier >= 50) return '0 0 50px rgba(150,80,255,0.4)';
  if (multiplier >= 25) return '0 0 40px rgba(50,150,255,0.4)';
  if (multiplier >= 10) return '0 0 30px rgba(0,200,255,0.3)';
  if (multiplier >= 5) return '0 0 25px rgba(255,200,50,0.3)';
  if (multiplier >= 2) return '0 0 15px rgba(50,255,100,0.2)';
  return 'none';
}

const MultiplierDisplay: React.FC<MultiplierDisplayProps> = ({ multiplier, state, world }) => {
  const isActive = state === GameState.FLYING || state === GameState.LAUNCH;
  const isCrashed = state === GameState.CRASHED;
  const isWaiting = state === GameState.WAITING;

  const colors = useMemo(() => ({
    text: getMultiplierColor(multiplier),
    glow: getMultiplierGlow(multiplier),
  }), [multiplier]);

  const formattedMultiplier = useMemo(() => {
    if (multiplier >= 1000) {
      return `${(multiplier / 1000).toFixed(1)}K`;
    }
    return multiplier.toFixed(2);
  }, [multiplier]);

  if (isWaiting) {
    return (
      <div className="text-center">
        <div className="text-6xl font-bold text-white/20 font-mono">1.00x</div>
        <div className="text-lg text-white/30 mt-2">Waiting for next round</div>
      </div>
    );
  }

  if (isCrashed) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        <div className="text-7xl font-bold text-red-400 font-mono drop-shadow-[0_0_30px_rgba(255,50,50,0.5)]">
          CRASHED
        </div>
        <div className="text-4xl font-bold text-red-300/70 font-mono mt-2">
          @ {multiplier.toFixed(2)}x
        </div>
      </motion.div>
    );
  }

  return (
    <div className="text-center select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={isActive ? `live-${multiplier}` : 'inactive'}
          initial={isActive ? { scale: 0.9 } : false}
          animate={{
            scale: isActive ? [1, 1.03, 1] : 0.8,
            opacity: isActive ? 1 : 0.3,
          }}
          transition={{ duration: isActive ? 0.15 : 0.5 }}
          className={`text-7xl font-bold font-mono tracking-tight ${colors.text}`}
          style={{
            textShadow: colors.glow,
          }}
        >
          {formattedMultiplier}x
        </motion.div>
      </AnimatePresence>

      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          className="text-sm text-white/60 mt-2 tracking-widest uppercase"
        >
          {world.replace('_', ' ')}
        </motion.div>
      )}
    </div>
  );
};

export default MultiplierDisplay;