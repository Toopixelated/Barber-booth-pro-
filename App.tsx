/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateFourUpImage, getHairstyleSuggestions, generateHairstyleVideo } from './services/geminiService';
import PolaroidCard from './components/PolaroidCard';
import { createFourUpSheet, compressImageForStorage, cropFourUpSheet } from './lib/albumUtils';
import Footer from './components/Footer';
import ImageEditor from './components/ImageEditor';
import CameraCapture from './components/CameraCapture';
import { cn } from './lib/utils';
import HistoryPanel from './components/HistoryPanel';
import VideoPreview from './components/VideoPreview';
import { useStore, HistoryItem, GeneratedImage } from './store';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
// FIX: Added 'Download' to the import from lucide-react to fix usage error.
import { Camera, FileImage, Palette, Wand2, Replace, Trash2, Share2, Download, History } from 'lucide-react';
import ColorPicker from './components/ColorPicker';
import toast from 'react-hot-toast';
import ShareMenu from './components/ShareMenu';
import { attemptShare } from './lib/shareUtils';
// FIX: Imported the LoadingSpinner component to resolve reference error.
import LoadingSpinner from './components/LoadingSpinner';

export type Angle = 'front' | 'left' | 'right' | 'back';
export const ANGLES: Angle[] = ['front', 'left', 'right', 'back'];

const PROMPT_IDEAS = [
    "A vibrant, rainbow-colored mohawk", "Classic 1950s greaser pompadour", "Long, flowing elven braids with silver clasps",
    "A sharp, futuristic cyberpunk undercut", "Neon pink highlights on a short bob", "Messy, sun-bleached surfer hair",
    "Elegant Victorian-era updo with curls", "A fiery phoenix-inspired hairstyle", "Short, textured French crop",
    "Galaxy-themed hair with swirling blues and purples", "A sleek, high-fashion top knot", "Viking-style dreadlocks with beads",
];

function App() {
    const state = useStore();
    const {
        setUploadedImage, setHairstyleDescription, setHairstyleReferenceImage, setHairstyleReferenceDescription,
        setHairstyleModification, setUseMasking, setInputMode, startGeneration, setAngleStatus,
        finishGeneration, addToHistory, setVideoStatus, setVideoUrl, setVideoProgress, setVideoError,
        openShareMenu
    } = useStore.getState();

    const [editingImage, setEditingImage] = useState<string | null>(null);
    const [editingImageType, setEditingImageType] = useState<'client' | 'reference' | null>(null);
    const [isUploadOptionsOpen, setIsUploadOptionsOpen] = useState(false);
    const [uploadTarget, setUploadTarget] = useState<'client' | 'reference' | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);

    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [isHairstyleInputFocused, setIsHairstyleInputFocused] = useState(false);
    const [randomSuggestions, setRandomSuggestions] = useState<string[]>([]);
    const suggestionTimeoutRef = useRef<number | null>(null);

    const clientImageInputRef = useRef<HTMLInputElement>(null);
    const hairstyleImageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const shuffled = [...PROMPT_IDEAS].sort(() => 0.5 - Math.random());
        setRandomSuggestions(shuffled.slice(0, 3));
    }, []);

    useEffect(() => {
        if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
        if (isHairstyleInputFocused && state.hairstyleDescription.trim().length > 2) {
            suggestionTimeoutRef.current = window.setTimeout(async () => {
                setIsFetchingSuggestions(true);
                const suggestions = await getHairstyleSuggestions(state.hairstyleDescription);
                setAiSuggestions(suggestions);
                setIsFetchingSuggestions(false);
            }, 500);
        } else {
            setAiSuggestions([]);
        }
        return () => { if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current); };
    }, [state.hairstyleDescription, isHairstyleInputFocused]);

    const handleFileSelected = (file: File, type: 'client' | 'reference') => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditingImage(reader.result as string);
            setEditingImageType(type);
        };
        reader.readAsDataURL(file);
    };

    const handleClientImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFileSelected(e.target.files[0], 'client');
            e.target.value = "";
        }
    };

    const handleHairstyleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFileSelected(e.target.files[0], 'reference');
            e.target.value = "";
        }
    };
    
    const handleEditorSave = (croppedImageUrl: string) => {
        if (editingImageType === 'client') {
            setUploadedImage(croppedImageUrl);
        } else if (editingImageType === 'reference') {
            setHairstyleReferenceImage(croppedImageUrl);
        }
        setEditingImage(null);
        setEditingImageType(null);
        setUploadTarget(null);
    };

    const handleEditorCancel = () => {
        setEditingImage(null);
        setEditingImageType(null);
        setUploadTarget(null);
    };

    const handleOpenUploadOptions = (target: 'client' | 'reference') => {
        setUploadTarget(target);
        setIsUploadOptionsOpen(true);
    };

    const handleSelectFile = () => {
        if (uploadTarget === 'client') clientImageInputRef.current?.click();
        else hairstyleImageInputRef.current?.click();
        setIsUploadOptionsOpen(false);
    };

    const handleTakePhoto = () => {
        setIsUploadOptionsOpen(false);
        setIsCameraOpen(true);
    };

    const handleCameraCapture = (imageDataUrl: string) => {
        setIsCameraOpen(false);
        setEditingImage(imageDataUrl);
        setEditingImageType(uploadTarget);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setHairstyleDescription(suggestion);
        setInputMode('text');
        setHairstyleReferenceImage(null);
        setHairstyleReferenceDescription('');
        setHairstyleModification('');
        setAiSuggestions([]);
        setIsHairstyleInputFocused(false);
    };

    const saveToHistory = useCallback(async (finalGeneratedImages: Record<string, GeneratedImage>, finalVideoUrl?: string | null) => {
        if (!state.uploadedImage) return;

        try {
            const compressedUploadedImage = await compressImageForStorage(state.uploadedImage);
            const compressedReferenceImage = state.hairstyleReferenceImage ? await compressImageForStorage(state.hairstyleReferenceImage) : null;
            
            const compressedGeneratedImages: Record<string, GeneratedImage> = {};
            await Promise.all(ANGLES.map(async (angle) => {
                const img = finalGeneratedImages[angle];
                if (img?.status === 'done' && img.url) {
                    compressedGeneratedImages[angle] = { ...img, url: await compressImageForStorage(img.url) };
                } else {
                    compressedGeneratedImages[angle] = img;
                }
            }));

            const newHistoryItem: HistoryItem = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                uploadedImage: compressedUploadedImage,
                hairstyleDescription: state.hairstyleDescription,
                hairstyleReferenceImage: compressedReferenceImage,
                hairstyleReferenceDescription: state.hairstyleReferenceDescription,
                hairstyleModification: state.hairstyleModification,
                hairColor: state.hairColor,
                useMasking: state.hairstyleReferenceImage ? state.useMasking : false,
                generatedImages: compressedGeneratedImages,
                generatedVideoUrl: finalVideoUrl || undefined,
            };
            addToHistory(newHistoryItem);
            toast.success('Saved to history!');
        } catch (error) {
            console.error("Failed to save history item:", error);
            toast.error("Could not save to history.");
        }
    }, [state.uploadedImage, state.hairstyleDescription, state.hairstyleReferenceImage, state.hairstyleReferenceDescription, state.hairstyleModification, state.hairColor, state.useMasking, addToHistory]);

    const runGenerationSequence = async () => {
        if (!state.uploadedImage || (!state.hairstyleDescription.trim() && !state.hairstyleReferenceImage)) return;

        startGeneration();

        try {
            // Step 1: Generate the single 4-up image sheet
            const fourUpSheetUrl = await generateFourUpImage(
                { dataUrl: state.uploadedImage! },
                {
                    description: state.hairstyleDescription,
                    referenceImage: state.hairstyleReferenceImage,
                    referenceDescription: state.hairstyleReferenceDescription,
                    modification: state.hairstyleModification,
                    useMasking: state.hairstyleReferenceImage ? state.useMasking : false,
                    hairColor: state.hairColor,
                }
            );

            // Step 2: Crop the sheet into individual images
            const croppedImages = await cropFourUpSheet(fourUpSheetUrl);

            // Step 3: Update state for each angle with the cropped image
            const finalGeneratedImagesState: Record<string, GeneratedImage> = {};
            for (const angle of ANGLES) {
                if (croppedImages[angle]) {
                    setAngleStatus(angle, 'done', croppedImages[angle]);
                    finalGeneratedImagesState[angle] = { status: 'done', url: croppedImages[angle] };
                } else {
                    // This case should ideally not happen if cropping is successful
                    throw new Error(`Cropped image for angle '${angle}' was not found.`);
                }
            }
            
            await saveToHistory(finalGeneratedImagesState);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(`Failed to generate 4-up grid:`, err);
            // If the whole process fails, mark all angles as errored
            for (const angle of ANGLES) {
                setAngleStatus(angle, 'error', undefined, errorMessage);
            }
        } finally {
            finishGeneration();
        }
    };

    const handleRegenerateAll = async () => {
        if (state.isGenerating) return;
        await runGenerationSequence();
    };

    const handleGenerateVideoClick = async () => {
        const frontImage = state.generatedImages['front'];
        if (frontImage?.status !== 'done' || !frontImage.url) {
            toast.error("Front image must be generated first.");
            return;
        }

        const descriptionForVideo = state.hairstyleReferenceDescription.trim() || state.hairstyleDescription.trim();
        if (!descriptionForVideo) {
            toast.error("A text description is required for video generation.");
            return;
        }

        setVideoStatus('generating');
        setVideoUrl(null);
        setVideoError('');
        setVideoProgress('Initializing video generation...');

        try {
            const finalVideoUrl = await generateHairstyleVideo(
                { dataUrl: frontImage.url },
                descriptionForVideo,
                (progressMessage) => setVideoProgress(progressMessage)
            );
            setVideoUrl(finalVideoUrl);
            setVideoStatus('done');
            await saveToHistory(state.generatedImages, finalVideoUrl);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown video error occurred.";
            setVideoError(errorMessage);
            setVideoStatus('error');
        }
    };
    
    const handleDownloadFourUpSheet = async () => {
        setIsDownloading(true);
        try {
            const imageData = ANGLES.reduce((acc, angle) => {
                const image = state.generatedImages[angle];
                if (image?.status === 'done' && image.url) acc[angle] = image.url;
                return acc;
            }, {} as Record<Angle, string>);

            if (Object.keys(imageData).length < ANGLES.length) {
                toast.error("Please wait for all images to finish generating.");
                return;
            }

            const sheetDataUrl = await createFourUpSheet(imageData);
            const link = document.createElement('a');
            link.href = sheetDataUrl;
            link.download = 'barber-booth-pro-4-up.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            toast.error("Error creating 4-up sheet.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShareFourUpSheet = async () => {
        setIsSharing(true);
        try {
            const imageData = ANGLES.reduce((acc, angle) => {
                const image = state.generatedImages[angle];
                if (image?.status === 'done' && image.url) acc[angle] = image.url;
                return acc;
            }, {} as Record<Angle, string>);

            if (Object.keys(imageData).length < ANGLES.length) {
                toast.error("Please wait for all images to finish generating.");
                return;
            }

            const sheetDataUrl = await createFourUpSheet(imageData);
            await attemptShare(
                { url: sheetDataUrl, title: '4-Up Result', type: 'image' },
                () => openShareMenu({ url: sheetDataUrl, title: '4-Up Result', type: 'image' })
            );
        } catch (error) {
            console.error("Error sharing 4-up sheet:", error);
            toast.error("Error creating 4-up sheet for sharing.");
        } finally {
            setIsSharing(false);
        }
    };

    const allImagesDone = ANGLES.every(angle => state.generatedImages[angle]?.status === 'done');
    const anyImageFailed = ANGLES.some(angle => state.generatedImages[angle]?.status === 'error');
    const showResultsActions = allImagesDone || anyImageFailed;

    const mainCardContent = () => {
        switch (state.appState) {
            case 'idle':
                return (
                    <Card onClick={() => handleOpenUploadOptions('client')} className="w-full max-w-sm aspect-square flex flex-col items-center justify-center cursor-pointer group hover:border-pink-500/50 transition-colors duration-300">
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}>
                            <Camera className="h-24 w-24 text-neutral-600 group-hover:text-pink-400 transition-colors" />
                            <p className="mt-4 text-xl font-semibold text-neutral-300 group-hover:text-white">Upload Your Photo</p>
                            <p className="text-sm text-neutral-500">to get started</p>
                        </motion.div>
                    </Card>
                );
            case 'image-uploaded':
                return (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
                        <div className="flex justify-center mb-6 relative group">
                            <img src={state.uploadedImage!} alt="Your photo" className="w-40 h-40 rounded-full object-cover border-4 border-neutral-700 shadow-lg" />
                            <button onClick={() => handleOpenUploadOptions('client')} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Replace className="w-8 h-8 text-white" />
                            </button>
                        </div>

                        <Card>
                            <CardContent className="p-4 sm:p-6">
                                <div className="flex bg-neutral-800 p-1 rounded-md mb-4">
                                    <button onClick={() => setInputMode('text')} className={cn("w-1/2 py-2 text-sm font-semibold rounded-md transition-colors", state.inputMode === 'text' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:bg-neutral-700')}>
                                        Text Prompt
                                    </button>
                                    <button onClick={() => setInputMode('image')} className={cn("w-1/2 py-2 text-sm font-semibold rounded-md transition-colors", state.inputMode === 'image' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:bg-neutral-700')}>
                                        Reference Image
                                    </button>
                                </div>
                                
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={state.inputMode}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {state.inputMode === 'text' ? (
                                            <div className="relative">
                                                <textarea
                                                    value={state.hairstyleDescription}
                                                    onChange={e => setHairstyleDescription(e.target.value)}
                                                    onFocus={() => setIsHairstyleInputFocused(true)}
                                                    onBlur={() => setTimeout(() => setIsHairstyleInputFocused(false), 200)}
                                                    placeholder="e.g., a neon pink mohawk"
                                                    className="w-full h-28 p-3 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all resize-none"
                                                />
                                                <AnimatePresence>
                                                {(isFetchingSuggestions || aiSuggestions.length > 0 || isHairstyleInputFocused && state.hairstyleDescription.length < 3) && (
                                                     <motion.div 
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="absolute top-full left-0 w-full bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-b-md shadow-lg overflow-hidden z-10"
                                                     >
                                                        {isFetchingSuggestions ? <LoadingSpinner className="p-4" /> : 
                                                            (aiSuggestions.length > 0 ? aiSuggestions : randomSuggestions).map(s => (
                                                                <button key={s} onMouseDown={() => handleSuggestionClick(s)} className="block w-full text-left px-4 py-2 hover:bg-indigo-600/50 text-sm">
                                                                    {s}
                                                                </button>
                                                            ))
                                                        }
                                                    </motion.div>
                                                )}
                                                </AnimatePresence>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {state.hairstyleReferenceImage ? (
                                                    <div className="relative group aspect-square w-full rounded-md overflow-hidden">
                                                         <img src={state.hairstyleReferenceImage} alt="Hairstyle reference" className="w-full h-full object-cover"/>
                                                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                             <Button onClick={() => handleOpenUploadOptions('reference')} variant="secondary" size="sm"><Replace className="mr-2 h-4 w-4"/>Change</Button>
                                                             <Button onClick={() => setHairstyleReferenceImage(null)} variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Remove</Button>
                                                         </div>
                                                     </div>
                                                ) : (
                                                    <button onClick={() => handleOpenUploadOptions('reference')} className="w-full aspect-square flex flex-col items-center justify-center bg-neutral-800 rounded-md border-2 border-dashed border-neutral-700 hover:border-pink-500 transition-colors">
                                                        <FileImage className="w-8 h-8 text-neutral-500 mb-2"/>
                                                        <span className="text-sm font-semibold">Upload Reference</span>
                                                        <span className="text-xs text-neutral-500">Click or Drag & Drop</span>
                                                    </button>
                                                )}
                                                <textarea value={state.hairstyleReferenceDescription} onChange={e => setHairstyleReferenceDescription(e.target.value)} placeholder="Describe the hairstyle (optional but recommended)" className="w-full p-3 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 outline-none transition-all resize-none text-sm" rows={2}/>
                                                <textarea value={state.hairstyleModification} onChange={e => setHairstyleModification(e.target.value)} placeholder="Any modifications? (e.g., 'make it shorter', 'add blonde highlights')" className="w-full p-3 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 outline-none transition-all resize-none text-sm" rows={2}/>
                                                {state.hairstyleReferenceImage && (
                                                <div className="flex items-center justify-between p-2 bg-neutral-800 rounded-md">
                                                    <label htmlFor="masking-toggle" className="text-sm font-medium text-neutral-300">
                                                        High-Fidelity Mode
                                                        <p className="text-xs text-neutral-500">Best for precise style transfers.</p>
                                                    </label>
                                                    <button role="switch" aria-checked={state.useMasking} onClick={() => setUseMasking(!state.useMasking)} id="masking-toggle" className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", state.useMasking ? 'bg-indigo-600' : 'bg-neutral-700')}>
                                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", state.useMasking ? 'translate-x-6' : 'translate-x-1')} />
                                                    </button>
                                                </div>
                                                )}
                                            </div>
                                        )}
                                        <ColorPicker />
                                    </motion.div>
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                        <div className="flex items-center justify-between mt-6">
                            <Button variant="ghost" onClick={() => setUploadedImage(null)}>Start Over</Button>
                            <Button 
                                onClick={runGenerationSequence} 
                                disabled={!state.uploadedImage || (!state.hairstyleDescription.trim() && !state.hairstyleReferenceImage) || state.isGenerating}
                                size="lg"
                            >
                                <Wand2 className="mr-2 h-5 w-5"/>
                                {state.isGenerating ? 'Generating...' : 'Generate Pro'}
                            </Button>
                        </div>
                    </motion.div>
                );
            case 'generating-results':
                return (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-screen-xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            {ANGLES.map(angle => {
                                const result = state.generatedImages[angle];
                                return (
                                    <PolaroidCard
                                        key={angle}
                                        angle={angle}
                                        caption={angle.charAt(0).toUpperCase() + angle.slice(1)}
                                        status={result?.status ?? 'pending'}
                                        imageUrl={result?.url}
                                        error={result?.error}
                                        onRegenerate={() => { /* Implement single angle regeneration if needed */ }}
                                    />
                                );
                            })}
                        </div>
                        <AnimatePresence>
                        {showResultsActions && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
                            >
                                <Button variant="ghost" onClick={() => setUploadedImage(state.uploadedImage)}>
                                    <Replace className="mr-2 h-4 w-4"/>
                                    New Style
                                </Button>
                                {anyImageFailed ? (
                                     <Button onClick={handleRegenerateAll} size="lg" disabled={state.isGenerating}>
                                        <Wand2 className="mr-2 h-4 w-4"/>
                                        {state.isGenerating ? 'Regenerating...' : 'Try Again'}
                                     </Button>
                                ) : (
                                    <>
                                        <Button variant="secondary" onClick={handleDownloadFourUpSheet} disabled={isDownloading}>
                                            <Download className="mr-2 h-4 w-4"/>
                                            {isDownloading ? 'Downloading...' : 'Download 4-Up'}
                                        </Button>
                                        <Button variant="secondary" onClick={handleShareFourUpSheet} disabled={isSharing}>
                                            <Share2 className="mr-2 h-4 w-4"/>
                                            {isSharing ? 'Sharing...' : 'Share 4-Up'}
                                        </Button>
                                    </>
                                )}
                            </motion.div>
                        )}
                        </AnimatePresence>
                        {allImagesDone && !anyImageFailed && (
                             <div className="flex justify-center mt-6">
                                <Button onClick={handleGenerateVideoClick} size="lg" disabled={state.videoStatus === 'generating'}>
                                    <Wand2 className="mr-2 h-4 w-4"/>
                                    {state.videoStatus === 'generating' ? 'Creating Video...' : 'Create 360° Video'}
                                </Button>
                             </div>
                        )}

                        {state.videoStatus !== 'idle' && (
                             <motion.div
                                className="mt-8 w-full max-w-xl mx-auto"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <VideoPreview
                                    status={state.videoStatus}
                                    progressMessage={state.videoProgress}
                                    videoUrl={state.videoUrl}
                                    error={state.videoError}
                                    onClear={() => setVideoStatus('idle')}
                                />
                            </motion.div>
                        )}
                    </motion.div>
                );
        }
    };

     return (
        <div className="bg-neutral-950 text-slate-100 min-h-screen font-sans antialiased pb-24">
            {/* FIX: Add hidden file inputs for programmatic triggering */}
            <input
                type="file"
                ref={clientImageInputRef}
                onChange={handleClientImageUpload}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
            />
            <input
                type="file"
                ref={hairstyleImageInputRef}
                onChange={handleHairstyleImageUpload}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
            />

            <header className="fixed top-0 left-0 right-0 bg-neutral-950/50 backdrop-blur-sm p-3 z-50 border-b border-neutral-800">
                <div className="max-w-screen-xl mx-auto flex justify-between items-center px-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-2 rounded-lg">
                            <Palette className="w-6 h-6 text-white"/>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Barber <span className="text-pink-400">Booth</span> Pro</h1>
                    </div>
                    <Button variant="secondary" onClick={() => useStore.getState().setHistoryPanelOpen(true)}>
                        <History className="mr-2 h-4 w-4"/>
                        History ({state.generationHistory.length})
                    </Button>
                </div>
            </header>

            <main className="container mx-auto px-4 pt-28 flex flex-col items-center justify-start min-h-screen">
                <AnimatePresence mode="wait">
                    {mainCardContent()}
                </AnimatePresence>
            </main>

            <Footer />
            <HistoryPanel />
            <ShareMenu />

            <AnimatePresence>
                {editingImage && editingImageType && (
                    <ImageEditor
                        imageSrc={editingImage}
                        onSave={handleEditorSave}
                        onCancel={handleEditorCancel}
                        title={editingImageType === 'client' ? "Crop Your Photo" : "Crop Reference Image"}
                    />
                )}
                {isCameraOpen && (
                    <CameraCapture onCapture={handleCameraCapture} onCancel={() => setIsCameraOpen(false)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isUploadOptionsOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsUploadOptionsOpen(false)}>
                         <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-neutral-900 rounded-lg p-6 w-full max-w-xs space-y-4 border border-neutral-700">
                             <h3 className="text-center font-semibold text-lg">Upload Image</h3>
                            <Button onClick={handleSelectFile} variant="secondary" className="w-full"><FileImage className="mr-2 h-4 w-4"/>From File</Button>
                            <Button onClick={handleTakePhoto} variant="secondary" className="w-full"><Camera className="mr-2 h-4 w-4"/>Take Photo</Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// FIX: Added default export to make the component available for import in other files.
export default App;