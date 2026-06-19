// ============================================================
// EnvironmentBackground — Dynamic World Background
// ============================================================
// Changes the background gradient and effects based on the
// current world (low_sky → cloud_layer → storm_zone → etc.)
// ============================================================

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '@sky-kingdom/shared';
import type { WorldId } from '@sky-kingdom/shared';

interface EnvironmentBackgroundProps {
  world: WorldId;
  state: GameState;
}

const WORLD_CONFIG: Record<WorldId, {
  label: string;
  gradient: string[];
  stars: boolean;
  clouds: boolean;
  lightning: boolean;
  aurora: boolean;
  nebula: boolean;
}> = {
  low_sky: {
    label: 'Low Sky',
    gradient: ['#87CEEB', '#4A90D9', '#2E6DB4'],
    stars: false,
    clouds: true,
    lightning: false,
    aurora: false,
    nebula: false,
  },
  cloud_layer: {
    label: 'Cloud Layer',
    gradient: ['#C8D8E8', '#A0B8D0', '#7A9BB5'],
    stars: false,
    clouds: true,
    lightning: false,
    aurora: false,
    nebula: false,
  },
  storm_zone: {
    label: 'Storm Zone',
    gradient: ['#2C3E50', '#1A1A2E', '#16213E'],
    stars: false,
    clouds: true,
    lightning: true,
    aurora: false,
    nebula: false,
  },
  stratosphere: {
    label: 'Stratosphere',
    gradient: ['#0D0D2B', '#1B1B4B', '#2D1B69'],
    stars: true,
    clouds: false,
    lightning: false,
    aurora: true,
    nebula: false,
  },
  space: {
    label: 'Space',
    gradient: ['#000011', '#0A0A2E', '#0D0D3B'],
    stars: true,
    clouds: false,
    lightning: false,
    aurora: false,
    nebula: true,
  },
  cosmic_dimension: {
    label: 'Cosmic Dimension',
    gradient: ['#000000', '#1A0033', '#0D0040'],
    stars: true,
    clouds: false,
    lightning: false,
    aurora: false,
    nebula: true,
  },
};

function Stars({ count = 50 }: { count?: number }) {
  const stars = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 2,
      delay: Math.random() * 5,
      duration: 1.5 + Math.random() * 3,
    })),
    [count],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function LightningBolt() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.2, 0, 0.15, 0] }}
      transition={{
        duration: 0.3,
        repeat: Infinity,
        repeatDelay: 3 + Math.random() * 5,
      }}
    >
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <motion.path
          d="M55 0 L40 40 L55 40 L35 100 L65 35 L50 35 L65 0Z"
          fill="white"
          opacity={0.6}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.1, repeat: Infinity }}
        />
      </svg>
    </motion.div>
  );
}

function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute top-0 left-0 right-0 h-1/3 opacity-20"
        style={{
          background: 'linear-gradient(180deg, rgba(0,255,128,0.3) 0%, rgba(0,100,255,0.2) 40%, transparent 100%)',
          filter: 'blur(40px)',
        }}
        animate={{
          x: ['-10%', '10%', '-5%', '5%', '-10%'],
          opacity: [0.15, 0.25, 0.15, 0.2, 0.15],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function Nebula() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute top-1/4 right-1/4 w-1/2 h-1/2 rounded-full opacity-[0.12]"
        style={{
          background: 'radial-gradient(circle, rgba(150, 50, 255, 0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-1/3 h-1/3 rounded-full opacity-[0.08]"
        style={{
          background: 'radial-gradient(circle, rgba(0, 100, 255, 0.3) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
        animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}

const EnvironmentBackground: React.FC<EnvironmentBackgroundProps> = ({ world, state }) => {
  const config = WORLD_CONFIG[world] ?? WORLD_CONFIG.low_sky;
  const isCrashed = state === GameState.CRASHED;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          background: `linear-gradient(180deg, ${config.gradient[0]} 0%, ${config.gradient[1]} 50%, ${config.gradient[2]} 100%)`,
        }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      >
        {/* Crash overlay */}
        {isCrashed && (
          <motion.div
            className="absolute inset-0 bg-red-900/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 0.6 }}
          />
        )}
      </motion.div>

      {/* World-specific effects */}
      {config.stars && <Stars count={world === 'cosmic_dimension' ? 120 : 60} />}
      {config.lightning && <LightningBolt />}
      {config.aurora && <Aurora />}
      {config.nebula && <Nebula />}

      {/* Clouds (for lower worlds) */}
      {config.clouds && (
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute -bottom-10 left-0 right-0 h-1/4 opacity-40"
            style={{
              background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 70 Q50 30 100 50 Q150 20 200 45 Q250 25 300 40 Q350 30 400 50 L400 100 L0 100Z\' fill=\'white\' opacity=\'0.3\'/%3E%3C/svg%3E") repeat-x',
              backgroundSize: '400px 100px',
            }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute -bottom-10 left-0 right-0 h-1/4 opacity-30"
            style={{
              background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 70 Q50 30 100 50 Q150 20 200 45 Q250 25 300 40 Q350 30 400 50 L400 100 L0 100Z\' fill=\'white\' opacity=\'0.3\'/%3E%3C/svg%3E") repeat-x',
              backgroundSize: '400px 100px',
            }}
            animate={{ x: ['-50%', '0%'] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
};

export default EnvironmentBackground;