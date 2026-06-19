// ============================================================
// App — Main Application Layout
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { useAppSelector } from './store/hooks';
import { useSocket } from './hooks/useSocket';
import GameCanvas from './components/game/GameCanvas';
import BettingControls from './components/ui/BettingControls';
import RoundHistory from './components/ui/RoundHistory';
import Leaderboard from './components/ui/Leaderboard';
import CharacterSelect from './components/character/CharacterSelect';
import ChatPanel from './components/chat/ChatPanel';
import { Crown, Wifi, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  useSocket(); // Initialize WebSocket connection
  const connected = useAppSelector((state) => state.websocket.connected);
  const game = useAppSelector((state) => state.game);

  return (
    <div className="min-h-screen bg-skc-black text-white font-display overflow-hidden">
      {/* ─── Top Navigation ──────────────────────────────── */}
      <header className="relative z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-skc-gold to-skc-gold-dark flex items-center justify-center">
              <Crown className="w-5 h-5 text-skc-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gradient">Sky Kingdom</h1>
              <div className="text-[10px] text-white/30 uppercase tracking-widest -mt-0.5">Crash</div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-400 shadow-lg shadow-green-400/30' : 'bg-red-400'
            }`} />
            <span className="text-xs text-white/40">
              {connected ? 'Live' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
            <CharacterSelect />
            <Leaderboard />
            <RoundHistory />
          </div>

          {/* Center — Game Area */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <motion.div
              className="relative rounded-2xl overflow-hidden"
              style={{
                aspectRatio: '16/9',
                minHeight: '400px',
              }}
              layout
            >
              <GameCanvas />
            </motion.div>

            {/* Character Selection Quick Info */}
            <div className="mt-4">
              <ChatPanel />
            </div>
          </div>

          {/* Right Sidebar — Betting */}
          <div className="lg:col-span-1 space-y-4 order-3">
            <BettingControls />

            {/* Stats */}
            <div className="glass rounded-2xl p-4">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Round Stats</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">State</span>
                  <span className="text-white font-medium">{game.state}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Round</span>
                  <span className="text-white font-mono">#{game.roundNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Multiplier</span>
                  <span className="text-white font-mono font-bold">{game.currentMultiplier.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">World</span>
                  <span className="text-white/60 text-xs uppercase">{game.world.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Verified Fairness */}
            <div className="glass rounded-2xl p-4 text-center">
              <div className="text-xs text-white/30 uppercase tracking-wider mb-2">
                🔒 Provably Fair
              </div>
              <p className="text-[10px] text-white/20 leading-relaxed">
                Every round uses SHA-512 cryptographic commitment.
                Server seeds are revealed after each round for independent verification.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Status bar */}
      <footer className="border-t border-white/5 py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-[10px] text-white/20">
          <span>Sky Kingdom Crash v1.0</span>
          <div className="flex items-center gap-4">
            <span>House Edge: 1%</span>
            <span>Max Multiplier: 1,000,000x</span>
            <a href="/api/health" className="hover:text-white/40 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;