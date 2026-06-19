// ============================================================
// AdminPanel — Game Administration Dashboard
// ============================================================

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Activity,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface ServerStatus {
  gameState: string;
  round: {
    roundId: string;
    roundNumber: number;
    state: string;
    currentMultiplier: number;
    crashMultiplier: number;
    activePlayers: number;
    totalBets: number;
    totalPayouts: number;
  } | null;
  onlineUsers: number;
  uptime: number;
}

const AdminPanel: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/status', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError(data.error ?? 'Failed to fetch status');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 text-skc-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchStatus}
          className="mt-4 px-4 py-2 bg-white/5 rounded-xl text-sm text-white/60 hover:bg-white/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-skc-gold" />
          <h2 className="text-xl font-bold text-gradient">Admin Dashboard</h2>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl text-xs text-white/50 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/40 uppercase">Game State</span>
          </div>
          <div className="text-lg font-bold">{status?.gameState ?? 'N/A'}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/40 uppercase">Online</span>
          </div>
          <div className="text-lg font-bold">{status?.onlineUsers ?? 0}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-skc-gold" />
            <span className="text-xs text-white/40 uppercase">Total Bets</span>
          </div>
          <div className="text-lg font-bold">
            ${Number(status?.round?.totalBets ?? 0).toFixed(2)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/40 uppercase">Payouts</span>
          </div>
          <div className="text-lg font-bold">
            ${Number(status?.round?.totalPayouts ?? 0).toFixed(2)}
          </div>
        </motion.div>
      </div>

      {/* Current Round Details */}
      {status?.round && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-4"
        >
          <h3 className="text-sm font-medium text-white/80 mb-4">Current Round</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-white/30">Round ID</div>
              <div className="text-sm font-mono text-white/70 mt-1">
                {status.round.roundId}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/30">Number</div>
              <div className="text-sm font-bold mt-1">#{status.round.roundNumber}</div>
            </div>
            <div>
              <div className="text-xs text-white/30">State</div>
              <div className="text-sm font-medium mt-1">{status.round.state}</div>
            </div>
            <div>
              <div className="text-xs text-white/30">Active Players</div>
              <div className="text-sm font-medium mt-1">{status.round.activePlayers}</div>
            </div>
            <div>
              <div className="text-xs text-white/30">Current Multiplier</div>
              <div className="text-sm font-mono font-bold text-skc-gold mt-1">
                {status.round.currentMultiplier.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="text-xs text-white/30">Crash Point</div>
              <div className="text-sm font-mono font-bold mt-1 text-red-400">
                {status.round.crashMultiplier.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="text-xs text-white/30">Total Bets</div>
              <div className="text-sm font-mono mt-1">
                ${status.round.totalBets.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/30">Total Payouts</div>
              <div className="text-sm font-mono mt-1">
                ${status.round.totalPayouts.toFixed(2)}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Server Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass rounded-2xl p-4"
      >
        <h3 className="text-sm font-medium text-white/80 mb-4">Server Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-white/30">Uptime</div>
            <div className="text-sm mt-1">{formatUptime(status?.uptime ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-white/30">Version</div>
            <div className="text-sm mt-1">1.0.0</div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 hover:bg-red-500/20 transition-colors">
          Emergency Stop
        </button>
        <button className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-400 hover:bg-yellow-500/20 transition-colors">
          Maintenance Mode
        </button>
        <button className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400 hover:bg-green-500/20 transition-colors">
          Force Restart Round
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;