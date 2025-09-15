/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect, useCallback, useState } from 'react';

interface InteractiveVideoPlayerProps {
  videoUrl: string;
}

const InteractiveVideoPlayer: React.FC<InteractiveVideoPlayerProps> = ({ videoUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startVideoTime = useRef(0);
  // FIX: Initialize useRef with null to provide an argument, resolving a potential type inference issue.
  const animationFrameId = useRef<number | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);

  // Precision scrubbing logic
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging.current || !videoRef.current || !containerRef.current) return;

    const deltaX = clientX - startX.current;
    const { duration } = videoRef.current;
    if (!duration || isNaN(duration)) return;

    // A full drag across the container equals one full rotation.
    // Make it feel a bit more sensitive by multiplying. Let's try 1.5x.
    const containerWidth = containerRef.current.offsetWidth;
    const rotationRatio = (deltaX / containerWidth) * 1.5;
    
    let newTime = startVideoTime.current + rotationRatio * duration;
    
    // Use modulo to loop the video time
    newTime = (duration + (newTime % duration)) % duration;

    // Use rAF for smoother updates
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
    
    animationFrameId.current = requestAnimationFrame(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
        }
    });

  }, []);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
    if (videoRef.current) {
      videoRef.current.pause();
      startVideoTime.current = videoRef.current.currentTime;
    }
  };

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => 'touches' in e && e.touches[0] && handleDragMove(e.touches[0].clientX);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
      if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [handleDragMove, handleDragEnd]);
  
  // Make sure video metadata is loaded to get duration
  useEffect(() => {
    const video = videoRef.current;
    const handleLoadedMetadata = () => {
      if (video) {
        video.currentTime = 0; // Start at the beginning
        setIsLoaded(true);
      }
    };
    if (video) {
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }
    return () => {
        if (video) {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
    }
  }, []);

  return (
    <div 
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative select-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
    >
        <video
            ref={videoRef}
            src={videoUrl}
            muted
            loop
            playsInline
            className="w-full h-full object-contain pointer-events-none" // pointer-events-none is crucial
        />
        {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-white text-sm">Loading interactive player...</p>
            </div>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
            Drag to Rotate
        </div>
    </div>
  );
};

export default InteractiveVideoPlayer;