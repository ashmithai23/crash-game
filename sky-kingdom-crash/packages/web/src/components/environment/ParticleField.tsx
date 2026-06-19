// ============================================================
// ParticleField — Animated Background Particles
// ============================================================

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { WorldId } from '@sky-kingdom/shared';

interface ParticleFieldProps {
  world: WorldId;
  count: number;
  multiplier: number;
}

const PARTICLE_COLORS: Record<WorldId, string[]> = {
  low_sky: ['rgba(255,255,255,0.4)', 'rgba(135,206,235,0.3)'],
  cloud_layer: ['rgba(255,255,255,0.3)', 'rgba(200,216,232,0.3)'],
  storm_zone: ['rgba(255,255,255,0.2)', 'rgba(100,150,255,0.2)', 'rgba(255,200,50,0.1)'],
  stratosphere: ['rgba(255,255,255,0.5)', 'rgba(100,200,255,0.3)', 'rgba(200,100,255,0.2)'],
  space: ['rgba(255,255,255,0.6)', 'rgba(100,100,255,0.3)', 'rgba(200,150,255,0.2)'],
  cosmic_dimension: ['rgba(255,255,255,0.4)', 'rgba(200,100,255,0.3)', 'rgba(100,200,255,0.2)', 'rgba(255,200,100,0.2)'],
};

const ParticleField: React.FC<ParticleFieldProps> = ({ world, count, multiplier }) => {
  const colors = PARTICLE_COLORS[world] ?? PARTICLE_COLORS.low_sky;

  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 3 + Math.random() * 6,
      delay: Math.random() * 5,
      driftX: (Math.random() - 0.5) * 20,
    })),
    [count, colors],
  );

  // Speed multiplier for the particle animation
  const speedFactor = useMemo(() => {
    if (multiplier >= 100) return 3;
    if (multiplier >= 50) return 2;
    if (multiplier >= 25) return 1.5;
    if (multiplier >= 10) return 1.2;
    return 1;
  }, [multiplier]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
          }}
          animate={{
            y: [0, -100 - Math.random() * 200],
            x: [0, p.driftX],
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0.5],
          }}
          transition={{
            duration: p.duration / speedFactor,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

export default ParticleField;