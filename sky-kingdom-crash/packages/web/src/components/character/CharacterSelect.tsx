// ============================================================
// CharacterSelect — Choose Your Character
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectCharacter } from '../../store/characterSlice';
import { Users } from 'lucide-react';
import type { CharacterId } from '@sky-kingdom/shared';

const CHARACTERS: Array<{
  id: CharacterId;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}> = [
  { id: 'baby_trump', name: 'Baby Trump', description: 'The dealmaker', rarity: 'legendary' },
  { id: 'baby_modi', name: 'Baby Modi', description: 'The visionary', rarity: 'epic' },
  { id: 'baby_boris', name: 'Baby Boris', description: 'The bulldozer', rarity: 'epic' },
  { id: 'baby_trudeau', name: 'Baby Trudeau', description: 'The diplomat', rarity: 'rare' },
  { id: 'baby_shinzo', name: 'Baby Shinzo', description: 'The strategist', rarity: 'common' },
];

const RARITY_COLORS = {
  common: { border: 'border-gray-500/40', text: 'text-gray-400', glow: 'shadow-gray-500/10' },
  rare: { border: 'border-blue-500/40', text: 'text-blue-400', glow: 'shadow-blue-500/10' },
  epic: { border: 'border-purple-500/40', text: 'text-purple-400', glow: 'shadow-purple-500/10' },
  legendary: { border: 'border-yellow-500/40', text: 'text-yellow-400', glow: 'shadow-yellow-500/10' },
};

const CharacterSelect: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedCharacter = useAppSelector((state) => state.character.selectedCharacter);
  const unlockedCharacters = useAppSelector((state) => state.character.unlockedCharacters);

  const handleSelect = (id: CharacterId) => {
    if (unlockedCharacters.includes(id)) {
      dispatch(selectCharacter(id));
    }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-skc-gold" />
        <span className="text-xs text-white/60 uppercase tracking-wider">Characters</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {CHARACTERS.map((char) => {
          const isSelected = selectedCharacter === char.id;
          const isUnlocked = unlockedCharacters.includes(char.id);
          const colors = RARITY_COLORS[char.rarity];

          return (
            <motion.button
              key={char.id}
              whileHover={isUnlocked ? { scale: 1.05 } : undefined}
              whileTap={isUnlocked ? { scale: 0.95 } : undefined}
              onClick={() => handleSelect(char.id)}
              disabled={!isUnlocked}
              className={`relative rounded-xl p-2 transition-all duration-200 ${
                isSelected
                  ? `bg-white/10 border-2 ${colors.border} ${colors.glow} shadow-lg`
                  : isUnlocked
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                  : 'bg-white/[0.02] border border-white/5 opacity-40 cursor-not-allowed'
              }`}
            >
              {/* Character Preview (simplified head circle) */}
              <div className="w-full aspect-square rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mb-1">
                <div className={`w-8 h-8 rounded-full ${
                  char.id === 'baby_trump' ? 'bg-gradient-to-br from-yellow-200 to-orange-300' :
                  char.id === 'baby_modi' ? 'bg-gradient-to-br from-orange-300 to-green-400' :
                  char.id === 'baby_boris' ? 'bg-gradient-to-br from-rose-200 to-rose-300' :
                  char.id === 'baby_trudeau' ? 'bg-gradient-to-br from-red-300 to-red-400' :
                  'bg-gradient-to-br from-blue-200 to-blue-300'
                }`} />
              </div>

              {/* Name */}
              <div className={`text-[10px] text-center truncate ${
                isSelected ? 'text-white font-medium' : 'text-white/50'
              }`}>
                {char.name.split(' ')[1]}
              </div>

              {/* Rarity indicator */}
              <div className={`text-[8px] text-center uppercase tracking-wider ${colors.text}`}>
                {char.rarity}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <motion.div
                  layoutId="selected-character"
                  className="absolute -top-1 -right-1 w-4 h-4 bg-skc-gold rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <svg className="w-2.5 h-2.5 text-skc-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}

              {/* Lock overlay */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default CharacterSelect;