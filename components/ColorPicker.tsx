/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useStore } from '../store';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Palette, Check, XCircle } from 'lucide-react';

const PRESET_COLORS = [
    { name: 'Royal Blue', color: '#1e40af' },
    { name: 'Fuchsia', color: '#be185d' },
    { name: 'Emerald', color: '#059669' },
    { name: 'Amber', color: '#eab308' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Purple', color: '#c026d3' },
    { name: 'Ruby Red', color: '#dc2626' },
    { name: 'Silver', color: '#d4d4d8' }
];

const ColorPicker = () => {
  const { hairColor, setHairColor } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(hairColor);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(hairColor);
  }, [hairColor]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isOpen && pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value.startsWith('#')) {
        value = '#' + value;
    }
    setInputValue(value);
    if (/^#([0-9a-f]{3}){1,2}$/i.test(value)) {
        setHairColor(value);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setHairColor('');
      setIsOpen(false);
  };

  return (
    <div className="relative mt-4" ref={pickerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-neutral-800 rounded-md border border-neutral-700 hover:bg-neutral-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-neutral-400" />
          <span className="font-medium text-sm">
            {hairColor ? `Hair Color: ${hairColor}` : 'Add Hair Color (Optional)'}
          </span>
        </div>
        <div className="flex items-center gap-2">
            {hairColor && (
                <button 
                    onClick={handleClear} 
                    className="text-neutral-500 hover:text-white"
                    aria-label="Clear color"
                >
                    <XCircle className="w-4 h-4" />
                </button>
            )}
            <div
              className="w-6 h-6 rounded-full border-2 border-neutral-600"
              style={{ backgroundColor: hairColor || 'transparent' }}
            />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          // FIX: Wrapped motion props in a spread object to resolve type error.
          <motion.div
            {...{
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 10 }
          }}
            className="absolute bottom-full left-0 w-full mb-2 z-20 bg-neutral-900 rounded-lg border border-neutral-700 shadow-xl max-h-96 overflow-y-auto scrollbar-thin"
          >
            <div className="p-4">
              <HexColorPicker color={hairColor} onChange={setHairColor} className="!w-full" />
              
              <div className="relative mt-4">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md py-2 pl-3 pr-3 text-white text-sm font-mono focus:ring-2 focus:ring-pink-500 outline-none"
                  maxLength={7}
                  placeholder="#e.g. ff0000"
                />
              </div>
              
              <div className="grid grid-cols-4 gap-2 mt-4">
                {PRESET_COLORS.map(({name, color}) => (
                  <button
                    key={color}
                    onClick={() => setHairColor(color)}
                    className="group flex flex-col items-center justify-center p-2 rounded-md hover:bg-neutral-800 transition-colors"
                    aria-label={`Select color ${name}`}
                  >
                      <div className={cn(
                        'w-8 h-8 rounded-full transition-transform group-hover:scale-110 relative border-2',
                        hairColor.toLowerCase() === color.toLowerCase() ? 'border-white' : 'border-neutral-700'
                      )}
                      style={{ backgroundColor: color }}>
                          {hairColor.toLowerCase() === color.toLowerCase() && (
                              <Check className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          )}
                      </div>
                      <span className="text-xs text-neutral-400 mt-1.5 group-hover:text-white">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ColorPicker;
