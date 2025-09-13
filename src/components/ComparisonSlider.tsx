/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  onClose: () => void;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ beforeImage, afterImage, onClose }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // This function calculates and sets the new slider position.
  // It's wrapped in useCallback because its identity is needed in the useEffect dependency array.
  const handleMove = useCallback((clientX: number) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  // This function is called when the drag interaction starts (mousedown or touchstart).
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default browser actions like text selection or page scrolling on touch.
    if (e.cancelable) e.preventDefault();
    isDragging.current = true;
    
    // For touch events, immediately update position on first touch
    if ('touches' in e) {
        handleMove(e.touches[0].clientX);
    }
  };

  // This function is called when the drag interaction ends.
  // Wrapped in useCallback for the useEffect dependency array.
  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // This effect sets up and tears down the global event listeners for dragging.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) handleMove(e.touches[0].clientX);
    };

    // We add listeners to the window so the slider continues to move even if the
    // cursor leaves the component's bounding box.
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    // The cleanup function removes the listeners when the component unmounts.
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleMove, handleDragEnd]);


  return (
    // FIX: Wrapped motion props in a spread object to resolve type error.
    <motion.div
      className="absolute inset-0 z-30"
      {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }}
    >
      <div 
        ref={containerRef}
        className="relative w-full h-full overflow-hidden select-none"
      >
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
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
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
        
        {/* Slider Handle */}
        <div 
          className="absolute top-0 bottom-0 w-14 -translate-x-1/2 cursor-ew-resize z-40"
          style={{ left: `${sliderPosition}%` }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
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
        </div>
      </div>
    </motion.div>
  );
};

export default ComparisonSlider;
