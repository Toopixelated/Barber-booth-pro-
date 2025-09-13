/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useTransition } from 'react';
import { cn } from '../lib/utils';
import type { Angle } from '../App';
import { Card } from './ui/card';
import LoadingSpinner from './LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Download, Repeat, AlertTriangle, GitCompareArrows, Share2 } from 'lucide-react';
import { useStore } from '../store';
import { attemptShare } from '../lib/shareUtils';
import ComparisonSlider from './ComparisonSlider';
import toast from 'react-hot-toast';
import { getUpscaler } from '../lib/upscaler';

type ImageStatus = 'pending' | 'done' | 'error';

interface ResultCardProps {
    imageUrl?: string;
    caption: string;
    status: ImageStatus;
    error?: string;
    onRegenerate: () => void;
    angle: Angle;
}

const PENDING_MESSAGES = [
    "Briefing the AI stylist...",
    "Analyzing facial structure...",
    "Selecting color palette...",
    "Simulating hair texture...",
    "Rendering the initial look...",
    "Applying realistic lighting...",
    "Adding final touches...",
    "Perfecting the details..."
];

const ErrorDisplay = ({ message }: { message?: string }) => {
    const userFriendlyMessage = message?.split('Details:')[0].trim() || 'An unknown error occurred.';
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 text-red-400">
            <AlertTriangle className="h-10 w-10" />
            <p className="mt-2 text-sm font-semibold">Generation Failed</p>
            <p className="mt-1 text-xs text-neutral-400 px-2 leading-snug">{userFriendlyMessage}</p>
        </div>
    );
};

const PolaroidCard: React.FC<ResultCardProps> = ({ imageUrl, caption, status, error, onRegenerate, angle }) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(PENDING_MESSAGES[0]);
    const [isComparing, setIsComparing] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [, startTransition] = useTransition();
    const { comparisonSourceImage, openShareMenu } = useStore();

    useEffect(() => {
        if (status === 'done' && imageUrl) setIsImageLoaded(false);
        // Turn off comparison if the image is regenerated
        if (status === 'pending') {
            startTransition(() => {
                setIsComparing(false);
            });
        }
    }, [imageUrl, status]);

    useEffect(() => {
        let intervalId: number | undefined;
        if (status === 'pending') {
            setLoadingMessage(PENDING_MESSAGES[0]); 
            intervalId = window.setInterval(() => {
                setLoadingMessage(prevMessage => {
                    const currentIndex = PENDING_MESSAGES.indexOf(prevMessage);
                    const nextIndex = (currentIndex + 1) % PENDING_MESSAGES.length;
                    return PENDING_MESSAGES[nextIndex];
                });
            }, 2500);
        }
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [status]);

    const handleDownload = async () => {
        if (!imageUrl || isUpscaling) return;
        setIsUpscaling(true);
        let scale = 2; // default
        const toastId = toast.loading('Preparing download...');
        try {
            const { instance: upscaler, scale: modelScale } = await getUpscaler();
            scale = modelScale;
            toast.loading(`Upscaling image (${scale}x)... (0%)`, { id: toastId });
            
            const upscaledDataUrl = await upscaler.upscale(imageUrl, {
                output: 'base64',
                patchSize: 64,
                padding: 2,
                progress: (progress) => {
                    toast.loading(`Upscaling... ${Math.round(progress * 100)}%`, { id: toastId });
                }
            });
            toast.success('Upscaling complete!', { id: toastId });
            
            const link = document.createElement('a');
            link.href = upscaledDataUrl;
            link.download = `barber-booth-pro-${angle}-upscaled.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            toast.error(`Upscaling failed (${scale}x). Downloading original.`, { id: toastId });
            console.error("Upscaling failed:", error);
            // Fallback to downloading original image
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `barber-booth-pro-${angle}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsUpscaling(false);
        }
    };
    
    const handleCompare = () => {
        if(comparisonSourceImage && imageUrl) {
            startTransition(() => {
                setIsComparing(prev => !prev);
            });
        }
    };
    
    const handleShare = () => {
        if (!imageUrl) return;
        attemptShare(
            { url: imageUrl, title: caption, type: 'image' },
            () => openShareMenu({ url: imageUrl, title: caption, type: 'image' })
        );
    };

    const borderClass = status === 'error' ? 'border-red-500/50' : (status === 'done' ? 'border-green-500/50' : 'border-neutral-800');

    return (
        <Card className={cn('aspect-[3/4] w-full flex flex-col transition-all border', borderClass)}>
            <div className="w-full bg-neutral-900 flex-grow relative overflow-hidden rounded-t-lg group">
                {status === 'pending' && <LoadingSpinner className="h-full" message={loadingMessage}/>}
                {status === 'error' && <ErrorDisplay message={error} />}

                {status === 'done' && imageUrl && (
                    // FIX: Wrapped motion props in a spread object to resolve type error.
                    <motion.img
                        key={imageUrl}
                        src={imageUrl}
                        alt={caption}
                        onLoad={() => setIsImageLoaded(true)}
                        {...{
                        initial: { opacity: 0.5, filter: 'saturate(0)' },
                        animate: { opacity: isImageLoaded ? 1 : 0.5, filter: isImageLoaded ? 'saturate(1)' : 'saturate(0)' },
                        transition: { duration: 1.5, ease: 'easeOut' }
                    }}
                        className="w-full h-full object-cover"
                    />
                )}
                
                <AnimatePresence>
                    {isComparing && comparisonSourceImage && imageUrl && (
                        <ComparisonSlider 
                            beforeImage={comparisonSourceImage} 
                            afterImage={imageUrl}
                            onClose={() => startTransition(() => setIsComparing(false))}
                        />
                    )}
                </AnimatePresence>

                {(status === 'done' || status === 'error') && (
                    <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                        <Button onClick={() => onRegenerate()} size="icon" variant="secondary" title="Regenerate"><Repeat className="w-4 h-4"/></Button>
                        {status === 'done' && <Button onClick={handleShare} size="icon" variant="secondary" title="Share"><Share2 className="w-4 h-4"/></Button>}
                        {status === 'done' && <Button onClick={handleDownload} size="icon" variant="secondary" title="Download" disabled={isUpscaling}><Download className="w-4 h-4"/></Button>}
                        {status === 'done' && angle === 'front' && <Button onClick={handleCompare} size="icon" variant={isComparing ? 'primary' : 'secondary'} title={isComparing ? 'Close Comparison' : 'Compare'}><GitCompareArrows className="w-4 h-4"/></Button>}
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 p-3 text-center border-t border-neutral-800">
                <p className="font-semibold text-sm truncate text-neutral-200">{caption}</p>
            </div>
        </Card>
    );
};

export default PolaroidCard;
