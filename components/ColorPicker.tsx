
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useStore } from '../store';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Palette, Check } from 'lucide-react';

const PRESET_COLORS = [
  '#1e40af', // Royal Blue
  '#be185d', // Fuchsia
  '#059669', // Emerald Green
  '#eab308', // Amber
  '#f97316', // Orange
  '#c026d3', // Purple
  '#dc2626', // Red
  '#d4d4d8'  // Silver
];

const ColorPicker = () => {
  const { hairColor, setHairColor } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-neutral-800 rounded-md border border-neutral-700 hover:bg-neutral-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-neutral-400" />
          <span className="font-medium">
            {hairColor ? `Hair Color: ${hairColor}` : 'Add Hair Color (Optional)'}
          </span>
        </div>
        <div
          className="w-6 h-6 rounded-full border-2 border-neutral-600"
          style={{ backgroundColor: hairColor || 'transparent' }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full left-0 w-full mb-2 z-10 p-4 bg-neutral-900 rounded-lg border border-neutral-700 shadow-xl"
          >
            <HexColorPicker color={hairColor} onChange={setHairColor} className="!w-full" />

            <div className="grid grid-cols-8 gap-2 mt-4">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setHairColor(color)}
                  className={cn(
                    'w-full aspect-square rounded-full transition-transform hover:scale-110 relative border-2',
                    hairColor.toLowerCase() === color.toLowerCase() ? 'border-white' : 'border-neutral-700'
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                >
                    {hairColor.toLowerCase() === color.toLowerCase() && (
                        <Check className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    )}
                </button>
              ))}
            </div>
             <button
                onClick={() => setHairColor('')}
                className="w-full text-center text-sm text-neutral-400 hover:text-white mt-4"
            >
                Clear Color
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ColorPicker;
