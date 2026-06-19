// ============================================================
// CharacterSprite — Animated SVG Character
// ============================================================
// Renders the selected character with:
//   - Flight animations (flapping, boost, supersonic)
//   - Color effects per multiplier threshold
//   - Trail particles behind the character
//   - Glow effects at high multipliers
// ============================================================

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CharacterId, AnimationState, WorldId } from '@sky-kingdom/shared';

interface CharacterSpriteProps {
  characterId: CharacterId;
  animation: AnimationState;
  multiplier: number;
  world: WorldId;
  isFlying: boolean;
  showEffects: boolean;
  size?: number;
}

const CHARACTER_COLORS: Record<CharacterId, { primary: string; secondary: string; accent: string; skin: string }> = {
  baby_trump: { primary: '#1a1a3e', secondary: '#c41e3a', accent: '#e4c777', skin: '#f5d6b8' },
  baby_modi: { primary: '#1a5276', secondary: '#e67e22', accent: '#2ecc71', skin: '#d4a574' },
  baby_boris: { primary: '#2c3e50', secondary: '#e74c3c', accent: '#f1c40f', skin: '#f0c8a0' },
  baby_trudeau: { primary: '#c0392b', secondary: '#2c3e50', accent: '#ecf0f1', skin: '#e8c5a0' },
  baby_shinzo: { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560', skin: '#f0d5b0' },
};

function CharacterSVG({
  characterId,
  colors,
  isFlying,
  multiplier,
}: {
  characterId: CharacterId;
  colors: ReturnType<typeof getCharacterColors>;
  isFlying: boolean;
  multiplier: number;
}) {
  // Baby character in flight pose with cape
  const boostIntensity = Math.min((multiplier - 1) / 10, 1);

  return (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cape / Trail */}
      <motion.path
        d="M60 50 C40 65, 20 80, 25 110 C30 115, 40 110, 45 100 C50 115, 55 120, 60 130 C65 120, 70 115, 75 100 C80 110, 90 115, 95 110 C100 80, 80 65, 60 50Z"
        fill={colors.accent}
        opacity={0.6 + boostIntensity * 0.4}
        animate={isFlying ? {
          d: [
            "M60 50 C40 65, 20 80, 25 110 C30 115, 40 110, 45 100 C50 115, 55 120, 60 130 C65 120, 70 115, 75 100 C80 110, 90 115, 95 110 C100 80, 80 65, 60 50Z",
            "M60 50 C35 60, 15 75, 20 105 C25 112, 38 108, 42 95 C48 112, 55 118, 60 128 C65 118, 72 112, 78 95 C82 108, 95 112, 100 105 C105 75, 85 60, 60 50Z",
          ],
        } : undefined}
        transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Body */}
      <motion.rect
        x="35" y="50" width="50" height="45" rx="12"
        fill={colors.primary}
        animate={isFlying ? { y: [50, 48, 50] } : undefined}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Suit detail */}
      <rect x="40" y="65" width="40" height="3" rx="1.5" fill={colors.accent} opacity={0.5} />
      <rect x="42" y="72" width="36" height="2" rx="1" fill={colors.accent} opacity={0.3} />

      {/* Head */}
      <motion.circle
        cx="60" cy="35" r="22"
        fill={colors.skin}
        animate={isFlying ? { cy: [35, 33, 35] } : undefined}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Hair */}
      <motion.path
        d={characterId === 'baby_trump' ? "M38 30 Q45 12, 60 10 Q75 12, 82 30 Q75 25, 60 23 Q45 25, 38 30Z" : "M38 30 Q45 8, 60 6 Q75 8, 82 30 Q75 20, 60 18 Q45 20, 38 30Z"}
        fill={colors.secondary}
      />

      {/* Eyes */}
      <motion.g
        animate={isFlying ? { scaleY: [1, 0.2, 1] } : undefined}
        transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse", repeatDelay: 3 }}
      >
        <circle cx="50" cy="33" r="3.5" fill="white" />
        <circle cx="70" cy="33" r="3.5" fill="white" />
        <circle cx="51" cy="33" r="2" fill="#1a1a2e" />
        <circle cx="71" cy="33" r="2" fill="#1a1a2e" />
      </motion.g>

      {/* Mouth */}
      <motion.path
        d={isFlying ? "M55 42 Q60 46, 65 42" : "M55 40 Q60 43, 65 40"}
        stroke={colors.secondary}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Boots */}
      <ellipse cx="45" cy="94" rx="12" ry="5" fill={colors.secondary} />
      <ellipse cx="75" cy="94" rx="12" ry="5" fill={colors.secondary} />

      {/* Arms */}
      <motion.line
        x1="35" y1="58" x2="20" y2="50"
        stroke={colors.skin}
        strokeWidth="6"
        strokeLinecap="round"
        animate={isFlying ? { x2: [20, 15, 20], y2: [50, 45, 50] } : undefined}
        transition={{ duration: 0.3, repeat: Infinity, repeatType: "reverse" }}
      />
      <motion.line
        x1="85" y1="58" x2="100" y2="50"
        stroke={colors.skin}
        strokeWidth="6"
        strokeLinecap="round"
        animate={isFlying ? { x2: [100, 105, 100], y2: [50, 45, 50] } : undefined}
        transition={{ duration: 0.3, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Boost effect */}
      {boostIntensity > 0.1 && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: boostIntensity }}
        >
          <ellipse cx="60" cy="105" rx="6" ry="3" fill={colors.accent} opacity={0.6} />
          <ellipse cx="60" cy="112" rx="4" ry="2" fill={colors.accent} opacity={0.3} />
        </motion.g>
      )}
    </svg>
  );
}

function getCharacterColors(characterId: CharacterId, multiplier: number) {
  const base = CHARACTER_COLORS[characterId] ?? CHARACTER_COLORS.baby_trump;

  // Intensify colors at higher multipliers
  const intensity = Math.min(Math.max(multiplier / 10, 0), 1);

  return {
    ...base,
    accent: intensity > 0.5
      ? `oklch(75% ${0.15 + intensity * 0.1} ${intensity > 0.8 ? 300 : 50})`
      : base.accent,
    primary: intensity > 0.8
      ? '#0a0a1a'
      : base.primary,
  };
}

const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  characterId,
  animation,
  multiplier,
  world,
  isFlying,
  showEffects,
  size = 80,
}) => {
  const colors = useMemo(() => getCharacterColors(characterId, multiplier), [characterId, multiplier]);

  // Speed of float/wobble based on multiplier
  const wobbleSpeed = useMemo(() => {
    if (multiplier >= 100) return 0.8;
    if (multiplier >= 50) return 1.2;
    if (multiplier >= 25) return 1.5;
    if (multiplier >= 10) return 1.8;
    return 2.5;
  }, [multiplier]);

  return (
    <motion.div
      className="relative"
      style={{ width: size, height: size * 1.2 }}
      animate={
        isFlying
          ? {
              rotate: [0, world === 'storm_zone' ? 5 : 2, 0, world === 'storm_zone' ? -5 : -2, 0],
            }
          : {
              y: [0, -5, 0],
            }
      }
      transition={{
        rotate: {
          duration: wobbleSpeed,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        y: {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
    >
      <CharacterSVG
        characterId={characterId}
        colors={colors}
        isFlying={isFlying}
        multiplier={multiplier}
      />

      {/* Glow effect at high multipliers */}
      <AnimatePresence>
        {multiplier >= 10 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.3, scale: 1.2 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 -z-10 rounded-full blur-xl"
            style={{
              backgroundColor: colors.accent,
              filter: 'blur(20px)',
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CharacterSprite;