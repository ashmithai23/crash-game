// ============================================================
// Leaderboard — Top Players
// ============================================================

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useAppSelector } from '../../store/hooks';

interface LeaderboardEntry {
  userId: string;
  score: number;
}

const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: any) => {
      if (data?.leaderboard) {
        setEntries(data.leaderboard);
        setLoading(false);
      }
    };

    socket.on('LEADERBOARD_UPDATE', handler);

    // Initial fetch
    fetch('/api/leaderboard?limit=10')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setEntries(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => {
      socket.off('LEADERBOARD_UPDATE', handler);
    };
  }, [socket]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-300" />;
      case 3:
        return <Medal className="w-4 h-4 text-amber-600" />;
      default:
        return <span className="w-4 h-4 text-xs text-white/40 font-medium">{rank}</span>;
    }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-skc-gold" />
        <span className="text-xs text-white/60 uppercase tracking-wider">Leaderboard</span>
      </div>

      {loading && (
        <div className="text-center text-white/20 text-sm py-6">Loading...</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center text-white/20 text-sm py-6">
          No data yet
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.slice(0, 10).map((entry, idx) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 flex justify-center">
                  {getRankIcon(idx + 1)}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    Player {entry.userId.slice(0, 8)}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase">
                    Score
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-mono font-bold ${
                  entry.score > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {entry.score > 0 ? '+' : ''}{entry.score.toFixed(2)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;