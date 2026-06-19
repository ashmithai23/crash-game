// ============================================================
// GameCanvas — Main Visual Game Area
// ============================================================
// Renders the flying character, environments, particles,
// multiplier display, and crash effects.
// ============================================================

import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '@sky-kingdom/shared';
import { useAppSelector } from '../../store/hooks';
import CharacterSprite from '../character/CharacterSprite';
import EnvironmentBackground from '../environment/EnvironmentBackground';
import ParticleField from '../environment/ParticleField';
import MultiplierDisplay from './MultiplierDisplay';
import CrashEffect from './CrashEffect';

const GameCanvas: React.FC = () => {
  const game = useAppSelector((state) => state.game);
  const character = useAppSelector((state) => state.character);

  const isCrashState = game.state === GameState.CRASHED;
  const isFlyingState = game.state === GameState.FLYING || game.state === GameState.LAUNCH;
  const isWaitingState = game.state === GameState.WAITING;

  // Calculate character position based on multiplier and elapsed time
  const characterPosition = useMemo(() => {
    if (isWaitingState) {
      return { x: 50, y: 70 }; // Bottom center when waiting
    }

    // Character moves upward (y decreases) as multiplier increases
    const progress = Math.min(game.currentMultiplier / 100, 1);
    const startY = 75;
    const endY = 5;
    const y = startY - (startY - endY) * progress;

    // Slight horizontal sway based on world
    const swayAmount = game.world === 'storm_zone' ? 3 : 1;
    const sway = Math.sin(game.elapsed / 500) * swayAmount;

    // Scale: slightly larger when waiting, small when flying high
    const scale = 0.8 + (1 - progress) * 0.4;

    return { x: 50 + sway, y: Math.max(5, y), scale };
  }, [game.currentMultiplier, game.elapsed, game.world, isWaitingState]);

  // Flying state progress for animations
  const flightProgress = useMemo(() => {
    if (game.currentMultiplier <= 1) return 0;
    return Math.min(game.currentMultiplier / 1000, 1);
  }, [game.currentMultiplier]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      {/* Environment Background */}
      <EnvironmentBackground world={game.world} state={game.state} />

      {/* Particle Field */}
      <ParticleField
        world={game.world}
        count={game.world === 'cosmic_dimension' ? 80 : 40}
        multiplier={game.currentMultiplier}
      />

      {/* Multiplier Display — Center / Top */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <MultiplierDisplay
          multiplier={game.currentMultiplier}
          state={game.state}
          world={game.world}
        />
      </div>

      {/* Character */}
      <div
        className="absolute transition-all duration-300 ease-out pointer-events-none"
        style={{
          left: `${characterPosition.x}%`,
          top: `${characterPosition.y}%`,
          transform: `translate(-50%, -50%) scale(${characterPosition.scale})`,
          zIndex: 10,
        }}
      >
        <CharacterSprite
          characterId={character.selectedCharacter}
          animation={character.animationState}
          multiplier={game.currentMultiplier}
          world={game.world}
          isFlying={isFlyingState}
          showEffects={true}
        />
      </div>

      {/* Crash Effect */}
      <AnimatePresence>
        {isCrashState && (
          <CrashEffect multiplier={game.crashMultiplier ?? 0} />
        )}
      </AnimatePresence>

      {/* Waiting State Overlay */}
      <AnimatePresence>
        {isWaitingState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-skc-black/30 backdrop-blur-sm"
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient animate-pulse-gold">
                NEXT ROUND
              </div>
              <div className="mt-2 text-white/40 text-sm">
                Preparing for launch...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* World Indicator — Bottom Left */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="glass px-3 py-1.5 rounded-full">
          <span className="text-xs text-white/60 uppercase tracking-wider">
            {game.world.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Round Number — Bottom Right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="glass px-3 py-1.5 rounded-full">
          <span className="text-xs text-white/60">
            Round #{game.roundNumber}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;