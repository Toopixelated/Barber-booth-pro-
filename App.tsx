/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react';
// FIX: Imported Variants type from framer-motion to resolve type error.
import { motion, AnimatePresence, Variants } from 'framer-motion';
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
import { Camera, FileImage, Wand2, Replace, Trash2, Share2, Download, History, Lightbulb, X, Cog, UploadCloud } from 'lucide-react';
import ColorPicker from './components/ColorPicker';
import toast from 'react-hot-toast';
import ShareMenu from './components/ShareMenu';
import LoadingSpinner from './components/LoadingSpinner';
import { attemptShare } from './lib/shareUtils';
import { getUpscaler } from './lib/upscaler';
import SettingsDialog from './components/SettingsDialog';
import { playSound } from './lib/audioUtils';
import UpscalingProgress from './components/UpscalingProgress';
import StandaloneUpscaler from './components/StandaloneUpscaler';

export type Angle = 'front' | 'left' | 'right' | 'back';
export const ANGLES: Angle[] = ['front', 'left', 'right', 'back'];

const angleCaptions: Record<Angle, string> = {
    front: 'Front',
    left: 'Left Side',
    right: 'Right Diagonal',
    back: 'Back',
};

const PROMPT_IDEAS = [
    "A vibrant, rainbow-colored mohawk", "Classic 1950s greaser pompadour", "Long, flowing elven braids with silver clasps",
    "A sharp, futuristic cyberpunk undercut", "Neon pink highlights on a short bob", "Messy, sun-bleached surfer hair",
    "Elegant Victorian-era updo with curls", "A fiery phoenix-inspired hairstyle", "Short, textured French crop",
    "Galaxy-themed hair with swirling blues and purples", "A sleek, high-fashion top knot", "Viking-style dreadlocks with beads",
];

// Input validation function
const validateInput = (text: string): string | null => {
    // Allows alphanumeric, spaces, and basic punctuation: . , ' " -
    const pattern = /^[a-zA-Z0-9\s.,'"-]*$/;
    if (!pattern.test(text)) {
        return "Only letters, numbers, and basic punctuation (.,'\"-) are allowed.";
    }
    return null;
};

function App() {
    const state = useStore();
    const isUpscaling = useStore(s => s.isUpscaling);
    const {
        setUploadedImage, setHairstyleDescription, setHairstyleReferenceImage,
        setHairstyleModification, setUseMasking, startGeneration, setAngleStatus,
        finishGeneration, addToHistory, setVideoStatus, setVideoUrl, setVideoProgress, setVideoError,
        openShareMenu, setComparisonSourceImage, setInstallPromptEvent, setUpscalingState, setUpscalingProgress
    } = useStore.getState();

    const [editingImage, setEditingImage] = useState<string | null>(null);
    const [editingImageType, setEditingImageType] = useState<'client' | 'reference' | null>(null);
    const [isUploadOptionsOpen, setIsUploadOptionsOpen] = useState(false);
    const [uploadTarget, setUploadTarget] = useState<'client' | 'reference' | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);
    const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const uploadAbortControllerRef = useRef<AbortController | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isStandaloneUpscalerOpen, setIsStandaloneUpscalerOpen] = useState(false);


    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [isHairstyleInputFocused, setIsHairstyleInputFocused] = useState(false);
    const [isSuggestionBoxManuallyClosed, setIsSuggestionBoxManuallyClosed] = useState(false);
    const [randomSuggestions, setRandomSuggestions] = useState<string[]>([]);
    const suggestionTimeoutRef = useRef<number | null>(null);
    
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [modificationError, setModificationError] = useState<string | null>(null);

    const clientImageInputRef = useRef<HTMLInputElement>(null);
    const hairstyleImageInputRef = useRef<HTMLInputElement>(null);

    // FIX: Explicitly typed cardVariants with Variants to fix type inference issue with the 'ease' property.
    const cardVariants: Variants = {
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                delay: i * 0.1,
                duration: 0.5,
                ease: [0.25, 1, 0.5, 1],
            },
        }),
    };

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPromptEvent(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, [setInstallPromptEvent]);

    useEffect(() => {
        const shuffled = [...PROMPT_IDEAS].sort(() => 0.5 - Math.random());
        setRandomSuggestions(shuffled.slice(0, 8));
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
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Unsupported file type. Please use JPG, PNG, or WEBP.');
            return;
        }

        setIsProcessingUpload(true);
        setUploadProgress(0);

        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;
        const { signal } = controller;

        const reader = new FileReader();
        signal.addEventListener('abort', () => reader.abort());

        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
        };
        reader.onloadend = () => {
            if (signal.aborted) {
                setIsProcessingUpload(false); return;
            }
            setUploadProgress(100);
            setTimeout(() => {
                setEditingImage(reader.result as string);
                setEditingImageType(type);
                setIsProcessingUpload(false);
            }, 300);
        };
        reader.onerror = () => {
            if (!signal.aborted) {
                toast.error("Failed to read the selected file.");
                setIsProcessingUpload(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleCancelUpload = () => {
        uploadAbortControllerRef.current?.abort();
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
        if (editingImageType === 'client') setUploadedImage(croppedImageUrl);
        else if (editingImageType === 'reference') setHairstyleReferenceImage(croppedImageUrl);
        setEditingImage(null); setEditingImageType(null); setUploadTarget(null);
    };
    const handleEditorCancel = () => {
        setEditingImage(null); setEditingImageType(null); setUploadTarget(null);
    };
    const handleOpenUploadOptions = (target: 'client' | 'reference') => {
        setUploadTarget(target); setIsUploadOptionsOpen(true);
    };
    const handleSelectFile = () => {
        if (uploadTarget === 'client') clientImageInputRef.current?.click();
        else hairstyleImageInputRef.current?.click();
        setIsUploadOptionsOpen(false);
    };
    const handleTakePhoto = () => {
        setIsUploadOptionsOpen(false); setIsCameraOpen(true);
    };
    const handleCameraCapture = (imageDataUrl: string) => {
        setIsCameraOpen(false); setEditingImage(imageDataUrl); setEditingImageType(uploadTarget);
    };
    const handleSuggestionClick = (suggestion: string) => {
        setHairstyleDescription(suggestion);
        setDescriptionError(null);
        setHairstyleReferenceImage(null);
        setHairstyleModification('');
        setAiSuggestions([]);
        setIsHairstyleInputFocused(false);
    };

    const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setHairstyleDescription(value);
        setDescriptionError(validateInput(value));
        setIsSuggestionBoxManuallyClosed(false);
    };

    const handleModificationChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setHairstyleModification(value);
        setModificationError(validateInput(value));
    };

    const saveToHistory = useCallback(async (finalGeneratedImages: Record<string, GeneratedImage>, finalVideoUrl?: string | null) => {
        if (!state.uploadedImage) return;
        try {
            const compressedUploadedImage = await compressImageForStorage(state.uploadedImage);
            const compressedReferenceImage = state.hairstyleReferenceImage ? await compressImageForStorage(state.hairstyleReferenceImage) : null;
            const compressedGeneratedImages: Record<string, GeneratedImage> = {};
            await Promise.all(ANGLES.map(async (angle) => {
                const img = finalGeneratedImages[angle];
                if (img?.status === 'done' && img.url) compressedGeneratedImages[angle] = { ...img, url: await compressImageForStorage(img.url) };
                else compressedGeneratedImages[angle] = img;
            }));
            const newHistoryItem: Omit<HistoryItem, 'id'> = {
                timestamp: Date.now(),
                uploadedImage: compressedUploadedImage,
                hairstyleDescription: state.hairstyleDescription,
                hairstyleReferenceImage: compressedReferenceImage,
                hairstyleModification: state.hairstyleModification,
                hairColor: state.hairColor,
                useMasking: state.hairstyleReferenceImage ? state.useMasking : false,
                generatedImages: compressedGeneratedImages,
                generatedVideoUrl: finalVideoUrl || undefined,
            };
            await addToHistory(newHistoryItem);
            toast.success('Saved to your account!');
            playSound('success');
        } catch (error) {
            console.error("Failed to save history item:", error);
            toast.error("Could not save to history.");
            playSound('error');
        }
    }, [state.uploadedImage, state.hairstyleDescription, state.hairstyleReferenceImage, state.hairstyleModification, state.hairColor, state.useMasking, addToHistory]);

    const runGenerationSequence = async () => {
        if (!state.uploadedImage || (!state.hairstyleDescription.trim() && !state.hairstyleReferenceImage && !state.hairColor.trim())) return;
        setComparisonSourceImage(state.uploadedImage);
        startGeneration();
        try {
            const fourUpSheetUrl = await generateFourUpImage(
                { dataUrl: state.uploadedImage! },
                {
                    description: state.hairstyleDescription, referenceImage: state.hairstyleReferenceImage,
                    modification: state.hairstyleModification, useMasking: state.hairstyleReferenceImage ? state.useMasking : false,
                    hairColor: state.hairColor,
                }
            );
            const croppedImages = await cropFourUpSheet(fourUpSheetUrl);
            const finalGeneratedImagesState: Record<string, GeneratedImage> = {};
            for (const angle of ANGLES) {
                if (croppedImages[angle]) {
                    setAngleStatus(angle, 'done', croppedImages[angle]);
                    finalGeneratedImagesState[angle] = { status: 'done', url: croppedImages[angle] };
                } else throw new Error(`Cropped image for angle '${angle}' was not found.`);
            }
            await saveToHistory(finalGeneratedImagesState);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(`Failed to generate 4-up grid:`, err); playSound('error');
            toast.error(`Generation failed: ${errorMessage}`);
            for (const angle of ANGLES) setAngleStatus(angle, 'error', undefined, errorMessage);
        } finally {
            finishGeneration();
        }
    };

    const handleRegenerateAll = async () => { if (state.isGenerating) return; await runGenerationSequence(); };

    const handleGenerateVideoClick = async () => {
        const frontImage = state.generatedImages['front'];
        if (frontImage?.status !== 'done' || !frontImage.url) { toast.error("Front image must be generated first."); return; }
        
        let descriptionForVideo: string;
        const { hairstyleDescription, hairColor } = state;

        if (hairstyleDescription.trim()) {
            descriptionForVideo = hairstyleDescription.trim();
            if (hairColor) {
                descriptionForVideo += ` with a vibrant ${hairColor} color`;
            }
        } else if (hairColor) {
            descriptionForVideo = `a new hairstyle dyed a vibrant ${hairColor} color`;
        } else {
            toast.error("A text description or color is required for video generation.");
            return;
        }
        
        setVideoStatus('generating'); setVideoUrl(null); setVideoError(''); setVideoProgress('Initializing video generation...');
        try {
            const finalVideoUrl = await generateHairstyleVideo({ dataUrl: frontImage.url }, descriptionForVideo, (progressMessage) => setVideoProgress(progressMessage));
            setVideoUrl(finalVideoUrl); setVideoStatus('done');
            await saveToHistory(state.generatedImages, finalVideoUrl);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown video error occurred.";
            setVideoError(errorMessage); setVideoStatus('error'); playSound('error');
        }
    };
    
    const handleDownloadFourUpSheet = async () => {
        if (isUpscaling) return; 
        setUpscalingState(true);
        let scale = 2;
        try {
            const imageData = ANGLES.reduce((acc, angle) => {
                const image = state.generatedImages[angle];
                if (image?.status === 'done' && image.url) acc[angle] = image.url;
                return acc;
            }, {} as Record<Angle, string>);
            if (Object.keys(imageData).length < ANGLES.length) { 
                toast.error("Please wait for all images to finish generating."); 
                setUpscalingState(false);
                return; 
            }
            const sheetDataUrl = await createFourUpSheet(imageData);
            const { instance: upscaler, scale: modelScale } = await getUpscaler(); 
            scale = modelScale;
            
            const upscaledSheet = await upscaler.upscale(sheetDataUrl, {
                output: 'base64', patchSize: 32, padding: 2,
                progress: (p) => {
                    setUpscalingProgress(p * 100);
                    // Yield to main thread to keep UI responsive, especially on slower devices.
                    return new Promise(resolve => setTimeout(resolve, 0));
                },
            });
            toast.success('Enhancement complete! Downloading...'); playSound('success');
            const link = document.createElement('a');
            link.href = upscaledSheet; link.download = 'barber-booth-pro-4-up-enhanced.jpg';
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch (error) {
            console.error("Error creating or enhancing 4-up sheet:", error);
            toast.error(`Error creating/enhancing sheet (${scale}x).`); playSound('error');
        } finally { 
            setUpscalingState(false);
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
            if (Object.keys(imageData).length < ANGLES.length) { toast.error("Please wait for all images to finish generating."); return; }
            const sheetDataUrl = await createFourUpSheet(imageData);
            await attemptShare({ url: sheetDataUrl, title: '4-Up Result', type: 'image' }, () => openShareMenu({ url: sheetDataUrl, title: '4-Up Result', type: 'image' }));
        } catch (error) {
            console.error("Error sharing 4-up sheet:", error);
            toast.error("Error creating 4-up sheet for sharing.");
        } finally { setIsSharing(false); }
    };

    const allImagesDone = ANGLES.every(angle => state.generatedImages[angle]?.status === 'done');
    const anyImageFailed = ANGLES.some(angle => state.generatedImages[angle]?.status === 'error');
    const showResultsActions = allImagesDone || anyImageFailed;

    const mainCardContent = () => {
        switch (state.appState) {
            case 'idle': return (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4 text-center"
                >
                    <Card onClick={() => handleOpenUploadOptions('client')} className="w-full max-w-sm aspect-square flex flex-col items-center justify-center cursor-pointer group hover:border-pink-500/50 transition-colors duration-300">
                        <motion.div {...{ initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { delay: 0.2, type: 'spring', stiffness: 260, damping: 20 } }}>
                            <Camera className="h-24 w-24 text-neutral-600 group-hover:text-pink-400 transition-colors inline-block" />
                            <p className="mt-4 text-xl font-semibold text-neutral-300 group-hover:text-white">AI Hairstyle Try-On</p>
                            <p className="text-sm text-neutral-500 px-4">upload a front view picture for best results</p>
                        </motion.div>
                    </Card>
                    <p className="text-neutral-500 text-sm">- OR -</p>
                    <Button
                        variant="secondary"
                        onClick={() => setIsStandaloneUpscalerOpen(true)}
                        className="bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border-purple-500/50 hover:from-purple-600/40 hover:to-indigo-600/40 hover:border-purple-500/80 transition-all duration-300 transform hover:scale-105"
                    >
                        <UploadCloud className="mr-2 h-4 w-4"/>
                        Dedicated Upscale Tool
                    </Button>
                </motion.div>
            );
            case 'image-uploaded': return (
                <motion.div {...{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }} className="w-full max-w-lg">
                    <div className="flex justify-center mb-6 relative group">
                        <img src={state.uploadedImage!} alt="Your photo" className="w-40 h-40 rounded-full object-cover border-4 border-neutral-700 shadow-lg" />
                        <button onClick={() => handleOpenUploadOptions('client')} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Replace className="w-8 h-8 text-white" />
                        </button>
                    </div>
                    <Card>
                        <CardContent className="p-4 sm:p-6 space-y-4">
                            <AnimatePresence>
                                {state.hairstyleReferenceImage && (
                                    <motion.div {...{ initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } }} className="relative group aspect-square w-full rounded-md overflow-hidden">
                                        <img src={state.hairstyleReferenceImage} alt="Hairstyle reference" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <Button onClick={() => handleOpenUploadOptions('reference')} variant="secondary" size="sm"><Replace className="mr-2 h-4 w-4" />Change</Button>
                                            <Button onClick={() => setHairstyleReferenceImage(null)} variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="relative">
                                <textarea
                                    value={state.hairstyleDescription}
                                    onChange={handleDescriptionChange}
                                    onFocus={() => { setIsHairstyleInputFocused(true); setIsSuggestionBoxManuallyClosed(false); }}
                                    onBlur={() => setTimeout(() => setIsHairstyleInputFocused(false), 200)}
                                    placeholder={state.hairstyleReferenceImage ? "Describe the reference hairstyle..." : "e.g., a neon pink mohawk"}
                                    className="w-full h-28 p-3 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all resize-none"
                                />
                                <button onClick={() => handleOpenUploadOptions('reference')} className="absolute bottom-2 right-2 p-2 rounded-full text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors" title="Upload Reference Image">
                                    <FileImage className="w-5 h-5"/>
                                </button>
                                {descriptionError && <p className="text-red-400 text-xs mt-1 px-1">{descriptionError}</p>}
                                <AnimatePresence>
                                {!isSuggestionBoxManuallyClosed && (isFetchingSuggestions || aiSuggestions.length > 0 || isHairstyleInputFocused && state.hairstyleDescription.length < 3) && (
                                    <motion.div {...{ initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } }} className="absolute top-full left-0 w-full bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-b-md shadow-lg z-10">
                                        <button onClick={() => setIsSuggestionBoxManuallyClosed(true)} className="absolute top-2 right-2 text-neutral-500 hover:text-white z-20 p-1 rounded-full hover:bg-neutral-700" aria-label="Close suggestions">
                                            <X className="w-4 h-4" />
                                        </button>
                                        <div className="max-h-60 overflow-y-auto scrollbar-thin">
                                            <p className="px-4 pt-3 pb-1 text-xs text-neutral-400 font-semibold uppercase tracking-wider sticky top-0 bg-neutral-800/90 backdrop-blur-sm">
                                                {aiSuggestions.length > 0 ? 'AI Suggestions' : 'Quick Ideas'}
                                            </p>
                                            {isFetchingSuggestions ? <LoadingSpinner className="p-4" /> : (aiSuggestions.length > 0 ? aiSuggestions : randomSuggestions).map(s => (
                                                <button key={s} onMouseDown={() => handleSuggestionClick(s)} className="flex items-center w-full text-left px-4 py-2 hover:bg-purple-600/50 text-sm">
                                                    {aiSuggestions.length > 0 ? <Wand2 className="w-4 h-4 mr-3 text-pink-400 flex-shrink-0"/> : <Lightbulb className="w-4 h-4 mr-3 text-yellow-400 flex-shrink-0"/>}
                                                    <span className="flex-grow">{s}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                            <AnimatePresence>
                                {state.hairstyleReferenceImage && (
                                    <motion.div {...{ initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } }} className="space-y-2 overflow-hidden">
                                        <textarea value={state.hairstyleModification} onChange={handleModificationChange} placeholder="Any modifications? (e.g., 'make it shorter', 'add blonde highlights')" className="w-full p-3 bg-neutral-800 rounded-md border border-neutral-700 focus:ring-2 focus:ring-pink-500 outline-none transition-all resize-none text-sm" rows={2} />
                                        {modificationError && <p className="text-red-400 text-xs px-1">{modificationError}</p>}
                                        <div className="flex items-center justify-between p-2 bg-neutral-800 rounded-md">
                                            <label htmlFor="masking-toggle" className="text-sm font-medium text-neutral-300">
                                                High-Fidelity Mode <p className="text-xs text-neutral-500">Best for precise style transfers.</p>
                                            </label>
                                            <button role="switch" aria-checked={state.useMasking} onClick={() => setUseMasking(!state.useMasking)} id="masking-toggle" className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", state.useMasking ? 'bg-pink-500' : 'bg-neutral-700')}>
                                                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", state.useMasking ? 'translate-x-6' : 'translate-x-1')} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <ColorPicker />
                        </CardContent>
                    </Card>
                    <div className="flex items-center justify-between mt-6">
                        <Button variant="ghost" onClick={() => setUploadedImage(null)}>Start Over</Button>
                        <Button onClick={runGenerationSequence} disabled={!state.uploadedImage || (!state.hairstyleDescription.trim() && !state.hairstyleReferenceImage && !state.hairColor.trim()) || state.isGenerating || !!descriptionError || !!modificationError} size="lg">
                            <Wand2 className="mr-2 h-5 w-5"/>
                            {state.isGenerating ? 'Generating...' : 'Generate Pro'}
                        </Button>
                    </div>
                </motion.div>
            );
            case 'generating-results': return (
                <motion.div {...{ initial: { opacity: 0 }, animate: { opacity: 1 } }} className="w-full max-w-screen-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {ANGLES.map((angle, index) => {
                            const result = state.generatedImages[angle];
                            return (
                                <motion.div
                                    key={angle}
                                    custom={index}
                                    variants={cardVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    <PolaroidCard
                                        angle={angle}
                                        caption={angleCaptions[angle]}
                                        status={result?.status ?? 'pending'}
                                        imageUrl={result?.url}
                                        error={result?.error}
                                        onRegenerate={handleRegenerateAll}
                                    />
                                </motion.div>
                            );
                        })}
                    </div>
                    <AnimatePresence>
                    {showResultsActions && (
                        <motion.div {...{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                            <Button variant="ghost" onClick={() => setUploadedImage(state.uploadedImage)}><Replace className="mr-2 h-4 w-4"/>New Style</Button>
                            {anyImageFailed ? (
                                 <Button onClick={handleRegenerateAll} size="lg" disabled={state.isGenerating}><Wand2 className="mr-2 h-4 w-4"/>{state.isGenerating ? 'Regenerating...' : 'Try Again'}</Button>
                            ) : (
                                <>
                                    <Button variant="secondary" onClick={handleDownloadFourUpSheet} disabled={isUpscaling}><Download className="mr-2 h-4 w-4"/>{isUpscaling ? 'Enhancing...' : 'Download 4-Up'}</Button>
                                    <Button variant="secondary" onClick={handleShareFourUpSheet} disabled={isSharing}><Share2 className="mr-2 h-4 w-4"/>{isSharing ? 'Sharing...' : 'Share 4-Up'}</Button>
                                </>
                            )}
                        </motion.div>
                    )}
                    </AnimatePresence>
                    {allImagesDone && !anyImageFailed && (
                         <div className="flex justify-center mt-6">
                            <Button onClick={handleGenerateVideoClick} size="lg" disabled={state.videoStatus === 'generating'}><Wand2 className="mr-2 h-4 w-4"/>{state.videoStatus === 'generating' ? 'Creating Video...' : 'Create 360° Video'}</Button>
                         </div>
                    )}
                    {state.videoStatus !== 'idle' && (
                         <motion.div className="mt-8 w-full max-w-xl mx-auto" {...{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}>
                            <VideoPreview status={state.videoStatus} progressMessage={state.videoProgress} videoUrl={state.videoUrl} error={state.videoError} onClear={() => setVideoStatus('idle')} />
                        </motion.div>
                    )}
                </motion.div>
            );
        }
    };

     return (
        <div className="bg-neutral-950 text-slate-100 min-h-screen font-sans antialiased pb-24">
            <input type="file" ref={clientImageInputRef} onChange={handleClientImageUpload} className="hidden" accept="image/png, image/jpeg, image/webp" />
            <input type="file" ref={hairstyleImageInputRef} onChange={handleHairstyleImageUpload} className="hidden" accept="image/png, image/jpeg, image/webp" />

            <header className="fixed top-0 left-0 right-0 bg-neutral-950/50 backdrop-blur-sm p-3 z-50 border-b border-neutral-800">
                <div className="max-w-screen-xl mx-auto flex justify-between items-center px-2 sm:px-4">
                    <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/80 to-purple-600/80 shadow-md overflow-hidden" role="img" aria-label="Barber Booth Pro Logo">
                            <span className="absolute text-4xl transform -rotate-[20deg] -translate-x-1.5 translate-y-0.5" aria-hidden="true">✂️</span>
                            <span className="absolute text-4xl transform rotate-[20deg] translate-x-1" aria-hidden="true">💈</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Barber <span className="text-pink-400">Booth</span> Pro</h1>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Settings" className="w-9 h-9">
                            <Cog className="h-5 w-5"/>
                        </Button>
                        <Button variant="secondary" onClick={() => useStore.getState().setHistoryPanelOpen(true)}>
                            <History className="h-4 w-4"/>
                            <span className="hidden sm:inline ml-2">History ({state.generationHistory.length})</span>
                            <span className="sm:hidden ml-1">({state.generationHistory.length})</span>
                        </Button>
                    </div>
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
            <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <StandaloneUpscaler isOpen={isStandaloneUpscalerOpen} onClose={() => setIsStandaloneUpscalerOpen(false)} />
            <AnimatePresence>
                {isUpscaling && <UpscalingProgress />}
            </AnimatePresence>
            
            <AnimatePresence>
                {isProcessingUpload && (
                    <motion.div {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
                        <div className="w-full max-w-xs text-center p-6 bg-neutral-900 rounded-lg border border-neutral-700">
                            <p className="text-lg font-semibold text-white mb-4">Processing Image...</p>
                            <div className="w-full bg-neutral-700 rounded-full h-2.5">
                                <motion.div
                                    className="bg-pink-500 h-2.5 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                    transition={{ ease: "linear", duration: 0.1 }}
                                />
                            </div>
                            <p className="text-white mt-2 font-mono">{uploadProgress}%</p>
                            <Button variant="ghost" onClick={handleCancelUpload} className="mt-6">Cancel</Button>
                        </div>
                    </motion.div>
                )}
                {editingImage && editingImageType && <ImageEditor imageSrc={editingImage} onSave={handleEditorSave} onCancel={handleEditorCancel} title={editingImageType === 'client' ? "Crop Your Photo" : "Crop Reference Image"} />}
                {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onCancel={() => setIsCameraOpen(false)} />}
            </AnimatePresence>

            <AnimatePresence>
                {isUploadOptionsOpen && (
                    <motion.div {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsUploadOptionsOpen(false)}>
                        <motion.div {...{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 20 } }} onClick={e => e.stopPropagation()} className="bg-neutral-900 rounded-xl p-6 w-full max-w-sm border border-neutral-700">
                            <h3 className="text-center font-semibold text-xl text-white mb-2">Choose Source</h3>
                            <p className="text-center text-sm text-neutral-400 mb-6">Select a photo to get started.</p>
                            <div className="grid grid-cols-1 gap-4">
                                <button onClick={handleSelectFile} className="group flex flex-col items-center justify-center p-6 bg-neutral-800 rounded-lg border border-neutral-700/80 hover:bg-neutral-700/60 hover:border-pink-500/50 transition-all duration-300 transform hover:-translate-y-1">
                                    <FileImage className="w-10 h-10 mb-3 text-pink-400 transition-transform group-hover:scale-110"/>
                                    <span className="font-semibold text-white">From File</span>
                                    <span className="text-xs text-neutral-400 mt-1">Choose from your device</span>
                                </button>
                                <button onClick={handleTakePhoto} className="group flex flex-col items-center justify-center p-6 bg-neutral-800 rounded-lg border border-neutral-700/80 hover:bg-neutral-700/60 hover:border-pink-500/50 transition-all duration-300 transform hover:-translate-y-1">
                                    <Camera className="w-10 h-10 mb-3 text-purple-400 transition-transform group-hover:scale-110"/>
                                    <span className="font-semibold text-white">Take Photo</span>
                                    <span className="text-xs text-neutral-400 mt-1">Use your camera</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;