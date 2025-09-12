/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  onClose: () => void;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ beforeImage, afterImage, onClose }) => {
  const [sliderValue, setSliderValue] = useState([50]);

  return (
    <motion.div
      className="absolute inset-0 z-30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative w-full h-full overflow-hidden select-none">
        {/* Before Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${beforeImage})` }}
        />
        
        {/* After Image (clipped) */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${afterImage})`,
            clipPath: `polygon(0 0, ${sliderValue[0]}% 0, ${sliderValue[0]}% 100%, 0 100%)`
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-transform hover:bg-black/80 active:scale-95"
          aria-label="Close comparison"
        >
          <X className="h-5 w-5" />
        </button>
        
        <Slider.Root
          value={sliderValue}
          onValueChange={setSliderValue}
          max={100}
          step={0.1}
          className="absolute inset-0"
        >
          {/* Track is conceptually the whole slider area, but we don't need a visible bar */}
          <Slider.Track className="relative h-full w-full">
            <Slider.Range />
          </Slider.Track>
          {/* Thumb contains our custom handle and the vertical line */}
          <Slider.Thumb className="block h-full w-14 -translate-x-1/2 cursor-ew-resize focus:outline-none z-40">
            <div className="relative h-full w-full flex items-center justify-center">
                {/* Vertical Divider Line */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg" />
                {/* Draggable Handle */}
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-black/50 backdrop-blur-sm text-white shadow-xl">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="10 7 6 12 10 17" />
                        <polyline points="14 7 18 12 14 17" />
                    </svg>
                </div>
            </div>
          </Slider.Thumb>
        </Slider.Root>
      </div>
    </motion.div>
  );
};

export default ComparisonSlider;