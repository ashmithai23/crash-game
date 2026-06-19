// ============================================================
// RoundHistory — Recent Round Results Bar
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { useAppSelector } from '../../store/hooks';

const RoundHistory: React.FC = () => {
  const history = useAppSelector((state) => state.game.roundHistory);

  if (history.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Recent Results</div>
        <div className="text-center text-white/20 text-sm py-4">No rounds yet</div>
      </div>
    );
  }

  // Show last 10 rounds
  const recent = history.slice(0, 10);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Recent Results</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recent.map((round, idx) => (
          <motion.div
            key={`${round.roundNumber}-${idx}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-center min-w-[60px] ${
              round.crashMultiplier >= 2
                ? 'bg-green-500/10 border border-green-500/20'
                : round.crashMultiplier >= 1.5
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <div className={`text-xs font-mono font-bold ${
              round.crashMultiplier >= 2
                ? 'text-green-400'
                : round.crashMultiplier >= 1.5
                ? 'text-yellow-300'
                : 'text-red-400'
            }`}>
              {round.crashMultiplier.toFixed(2)}x
            </div>
            <div className="text-[9px] text-white/30 mt-0.5">#{round.roundNumber}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RoundHistory;