/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import ReactSlider from 'react-slider';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  onClose: () => void;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ beforeImage, afterImage, onClose }) => {
  const [sliderValue, setSliderValue] = useState(50);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // This effect ensures we don't render the slider until its container has a real width,
  // preventing the React #525 error. useEffect runs after the browser has painted,
  // making it more resilient to timing issues with animations and React's Strict Mode.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Using ResizeObserver is the most robust way to wait for an element to have dimensions.
    const observer = new ResizeObserver(entries => {
      // Once we have a width, we can render the slider.
      if (entries[0]?.contentRect.width > 0) {
        setIsReady(true);
        // We only need the first observation, so we can disconnect.
        observer.disconnect();
      }
    });

    observer.observe(container);
    
    // Cleanup the observer when the component unmounts.
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={containerRef}
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
            clipPath: `polygon(0 0, ${sliderValue}% 0, ${sliderValue}% 100%, 0 100%)`
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

        {/* Slider Logic - Renders only when container is ready */}
        {isReady && (
          <div className="absolute inset-0">
            {/* Vertical Divider Line, moved by the thumb */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg pointer-events-none"
              style={{ left: `${sliderValue}%`, transform: 'translateX(-50%)' }}
            />
            
            <ReactSlider
              value={sliderValue}
              onChange={(value) => setSliderValue(value)}
              className="absolute inset-y-0 w-full h-full"
              thumbClassName="z-40 focus:outline-none"
              trackClassName="hidden"
              renderThumb={(props) => (
                <div {...props} className="absolute h-full -translate-x-1/2 top-0 flex items-center">
                  <div className="flex h-14 w-14 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-black/50 backdrop-blur-sm text-white shadow-xl">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="10 7 6 12 10 17" />
                        <polyline points="14 7 18 12 14 17" />
                      </svg>
                  </div>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ComparisonSlider;