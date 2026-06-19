// ============================================================
// BettingControls — Place Bets, Auto Cashout, Dual Bet
// ============================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@sky-kingdom/shared';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  setBetAmount,
  setAutoCashoutMultiplier,
  toggleDualBet,
  setDualBetAmount,
  setDualAutoCashoutMultiplier,
} from '../../store/walletSlice';
import { useSocket } from '../../hooks/useSocket';
import { Coins, Zap, SplitSquareHorizontal, TrendingUp, LogIn } from 'lucide-react';

const BettingControls: React.FC = () => {
  const dispatch = useAppDispatch();
  const game = useAppSelector((state) => state.game);
  const wallet = useAppSelector((state) => state.wallet);
  const { placeBet, cashout } = useSocket();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const canBet = game.state === GameState.BETTING;
  const canCashout = game.state === GameState.FLYING && wallet.availableBalance > 0;
  const isLoggedIn = wallet.isConnected;

  const presetAmounts = [10, 25, 50, 100, 500];

  const handlePlaceBet = async () => {
    if (!canBet || !game.roundId || isSubmitting || wallet.betAmount <= 0) return;
    setIsSubmitting(true);

    try {
      const result = await placeBet(
        game.roundId,
        wallet.betAmount,
        wallet.autoCashoutMultiplier ?? undefined,
        wallet.dualBetEnabled ? wallet.dualBetAmount : undefined,
        wallet.dualAutoCashoutMultiplier ?? undefined,
      );

      if (!result.success) {
        console.error('Bet failed:', result.error);
      }
    } catch (err) {
      console.error('Bet error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashout = async () => {
    if (!canCashout || !game.roundId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // In a real implementation, the betId would be tracked per user
      const result = await cashout(game.roundId, 'current-bet-id');
      if (!result.success) {
        console.error('Cashout failed:', result.error);
      }
    } catch (err) {
      console.error('Cashout error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <LogIn className="w-8 h-8 text-skc-gold mx-auto mb-3" />
        <p className="text-white/60 text-sm">Connect wallet to place bets</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      {/* Balance Display */}
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wider">Balance</div>
          <div className="text-xl font-bold text-white">
            ${wallet.availableBalance.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/40 uppercase tracking-wider">Reserved</div>
          <div className="text-sm text-white/50">
            ${wallet.reservedBalance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Bet Amount */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-white/60 uppercase tracking-wider">Bet Amount</label>
          <span className="text-xs text-white/40">Min: $1</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={wallet.betAmount}
            onChange={(e) => dispatch(setBetAmount(Number(e.target.value)))}
            min={1}
            max={wallet.availableBalance}
            disabled={!canBet}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-skc-gold/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => dispatch(setBetAmount(Math.min(wallet.betAmount * 2, wallet.availableBalance)))}
            disabled={!canBet}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            2x
          </button>
          <button
            onClick={() => dispatch(setBetAmount(Math.max(1, wallet.betAmount / 2)))}
            disabled={!canBet}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            ½
          </button>
        </div>

        {/* Preset amounts */}
        <div className="flex gap-2 mt-2">
          {presetAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => dispatch(setBetAmount(amount))}
              disabled={!canBet}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                wallet.betAmount === amount
                  ? 'bg-skc-gold/20 text-skc-gold border border-skc-gold/30'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
              } disabled:opacity-50`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Auto Cashout */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-skc-gold" />
          <label className="text-xs text-white/60 uppercase tracking-wider">Auto Cashout</label>
        </div>
        <input
          type="number"
          value={wallet.autoCashoutMultiplier ?? ''}
          onChange={(e) => dispatch(setAutoCashoutMultiplier(e.target.value ? Number(e.target.value) : null))}
          placeholder="1.50x"
          step={0.1}
          min={1.01}
          disabled={!canBet}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-skc-gold/50 transition-colors placeholder:text-white/20 disabled:opacity-50"
        />
      </div>

      {/* Dual Bet Toggle */}
      <div>
        <button
          onClick={() => dispatch(toggleDualBet())}
          disabled={!canBet}
          className={`flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border transition-colors ${
            wallet.dualBetEnabled
              ? 'bg-skc-gold/10 border-skc-gold/30 text-skc-gold'
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
          } disabled:opacity-50`}
        >
          <SplitSquareHorizontal className="w-4 h-4" />
          <span className="text-sm font-medium">Dual Bet</span>
        </button>

        {wallet.dualBetEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-2 space-y-2"
          >
            <input
              type="number"
              value={wallet.dualBetAmount}
              onChange={(e) => dispatch(setDualBetAmount(Number(e.target.value)))}
              placeholder="Dual amount"
              min={1}
              disabled={!canBet}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-skc-gold/50 transition-colors placeholder:text-white/20 disabled:opacity-50"
            />
            <input
              type="number"
              value={wallet.dualAutoCashoutMultiplier ?? ''}
              onChange={(e) => dispatch(setDualAutoCashoutMultiplier(e.target.value ? Number(e.target.value) : null))}
              placeholder="Dual auto cashout: 2.50x"
              step={0.1}
              min={1.01}
              disabled={!canBet}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-skc-gold/50 transition-colors placeholder:text-white/20 disabled:opacity-50"
            />
          </motion.div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-2">
        {canBet ? (
          <button
            onClick={handlePlaceBet}
            disabled={isSubmitting || wallet.betAmount <= 0}
            className="w-full py-3.5 rounded-xl font-bold text-lg bg-gradient-to-r from-skc-gold to-skc-gold-dark text-skc-black hover:from-skc-gold-light hover:to-skc-gold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-skc-gold/20"
          >
            <span className="flex items-center justify-center gap-2">
              <Coins className="w-5 h-5" />
              {isSubmitting ? 'Placing Bet...' : 'Place Bet'}
            </span>
          </button>
        ) : canCashout ? (
          <button
            onClick={handleCashout}
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-bold text-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-green-500/20"
          >
            <span className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {isSubmitting ? 'Cashing Out...' : 'Cash Out'}
            </span>
          </button>
        ) : (
          <button
            disabled
            className="w-full py-3.5 rounded-xl font-bold text-lg bg-white/5 text-white/30 cursor-not-allowed"
          >
            {game.state === GameState.WAITING ? 'Waiting...' : 'Betting Closed'}
          </button>
        )}
      </div>
    </div>
  );
};

export default BettingControls;