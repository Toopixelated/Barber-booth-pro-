/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { X, FileImage, Download, AlertTriangle, Camera } from 'lucide-react';
import { getUpscaler } from '../lib/upscaler';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import { cn } from '../lib/utils';
import ComparisonSlider from './ComparisonSlider';
import CameraCapture from './CameraCapture';
import { resizeImage } from '../lib/albumUtils';

interface StandaloneUpscalerProps {
  isOpen: boolean;
  onClose: () => void;
}

type UpscaleStatus = 'idle' | 'processing' | 'done' | 'error';

const StandaloneUpscaler: React.FC<StandaloneUpscalerProps> = ({ isOpen, onClose }) => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [status, setStatus] = useState<UpscaleStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(2);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Unsupported file type. Please use JPG, PNG, or WEBP.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setOriginalImage(result);
        setUpscaledImage(null);
        setStatus('idle');
        setError(null);
        handleUpscale(result);
      };
      reader.readAsDataURL(file);
      e.target.value = ""; // Reset input
    }
  };
  
  const handleCameraCapture = (imageDataUrl: string) => {
    setIsCameraOpen(false);
    setOriginalImage(imageDataUrl);
    setUpscaledImage(null);
    setStatus('idle');
    setError(null);
    handleUpscale(imageDataUrl);
  };

  const handleUpscale = async (imageUrl: string) => {
    if (!imageUrl) return;
    setStatus('processing');
    setProgress(0);
    setError(null);
    
    try {
        const { instance: upscaler, scale: modelScale } = await getUpscaler();
        setScale(modelScale);

        // Proactively resize image to prevent WebGL texture size errors.
        // 4096 is a common WebGL texture limit.
        const maxInputDimension = 4096 / modelScale;
        const resizedImageUrl = await resizeImage(imageUrl, maxInputDimension);

        const upscaledDataUrl = await upscaler.upscale(resizedImageUrl, {
            output: 'base64',
            patchSize: 32,
            padding: 2,
            progress: (p) => {
                setProgress(p * 100);
                // Yield to main thread to keep UI responsive
                return new Promise(resolve => setTimeout(resolve, 0));
            },
        });
        
        setUpscaledImage(upscaledDataUrl);
        setStatus('done');
        toast.success(`Enhancement complete! (${modelScale}x)`);
    } catch (err) {
        console.error("Enhancement failed:", err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Enhancement failed. ${errorMessage}`);
        setStatus('error');
        toast.error(`Enhancement failed.`);
    }
  };

  const handleDownload = () => {
    if (!upscaledImage) return;
    const link = document.createElement('a');
    link.href = upscaledImage;
    link.download = `enhanced-image-${scale}x.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleClose = () => {
    setOriginalImage(null);
    setUpscaledImage(null);
    setStatus('idle');
    setError(null);
    setProgress(0);
    setIsCameraOpen(false);
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4"
          aria-modal="true" role="dialog"
        >
          <AnimatePresence>
            {!isCameraOpen && (
              <motion.div
                key="dialog"
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-neutral-900 rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] border border-neutral-700 flex flex-col"
              >
                <header className="flex-shrink-0 p-4 flex items-center justify-between border-b border-neutral-800">
                  <h2 className="text-xl font-semibold text-white">Standalone Image Enhancer</h2>
                  <Button onClick={handleClose} variant="ghost" size="icon" aria-label="Close enhancer"><X className="h-4 w-4" /></Button>
                </header>
                
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />

                <div className="flex-grow p-4 relative overflow-hidden bg-black/20">
                    {!originalImage ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6">
                            <p className="text-2xl font-semibold text-white -mt-16 mb-4">Enhance Your Photos</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
                                <button onClick={() => fileInputRef.current?.click()} className="group flex flex-col items-center justify-center p-12 bg-neutral-800/50 rounded-lg border-2 border-dashed border-neutral-700 hover:border-pink-500/50 transition-all duration-300 transform hover:-translate-y-1">
                                    <FileImage className="w-16 h-16 mb-4 text-pink-400 transition-transform group-hover:scale-110"/>
                                    <span className="font-semibold text-white text-xl">Upload Image</span>
                                    <span className="text-sm text-neutral-400 mt-2">Choose from your device</span>
                                </button>
                                <button onClick={() => setIsCameraOpen(true)} className="group flex flex-col items-center justify-center p-12 bg-neutral-800/50 rounded-lg border-2 border-dashed border-neutral-700 hover:border-purple-500/50 transition-all duration-300 transform hover:-translate-y-1">
                                    <Camera className="w-16 h-16 mb-4 text-purple-400 transition-transform group-hover:scale-110"/>
                                    <span className="font-semibold text-white text-xl">Take Photo</span>
                                    <span className="text-sm text-neutral-400 mt-2">Use your camera</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full">
                            {status === 'processing' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50 backdrop-blur-sm">
                                    <div className="w-full max-w-xs text-center p-6">
                                        <LoadingSpinner />
                                        <h3 className="text-lg font-semibold text-white mt-6 mb-2">Enhancing...</h3>
                                        <div className="w-full bg-neutral-700 rounded-full h-2.5">
                                            <motion.div
                                                className="bg-pink-500 h-2.5 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ ease: "linear", duration: 0.1 }}
                                            />
                                        </div>
                                        <p className="text-white mt-2 font-mono">{Math.round(progress)}%</p>
                                    </div>
                                </div>
                            )}
                            {status === 'error' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50 text-center p-4">
                                    <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
                                    <p className="font-semibold text-red-400">Enhancement Failed</p>
                                    <p className="text-xs text-neutral-300 mt-1 max-w-md">{error}</p>
                                </div>
                            )}
                            {status === 'done' && upscaledImage ? (
                                <ComparisonSlider beforeImage={originalImage} afterImage={upscaledImage} onClose={() => {}} />
                            ) : (
                                <img src={originalImage} alt="Original" className="w-full h-full object-contain" />
                            )}
                        </div>
                    )}
                </div>

                <footer className={cn("flex-shrink-0 p-4 border-t border-neutral-800 flex items-center", status === 'done' ? 'justify-between' : 'justify-end')}>
                {status === 'done' && (
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <FileImage className="mr-2 h-4 w-4" />
                    Upload New Image
                    </Button>
                )}
                <div className="flex items-center gap-4">
                    <Button onClick={handleClose} variant="ghost">Close</Button>
                    <Button onClick={handleDownload} disabled={status !== 'done'}>
                        <Download className="mr-2 h-4 w-4" />
                        Download ({scale}x)
                    </Button>
                </div>
                </footer>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onCancel={() => setIsCameraOpen(false)} />}
        </>
      )}
    </AnimatePresence>
  );
};

export default StandaloneUpscaler;