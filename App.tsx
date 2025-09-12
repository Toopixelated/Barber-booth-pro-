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
import { Camera, FileImage, Palette, Wand2, Replace, Trash2, Share2 } from 'lucide-react';
import ColorPicker from './components/ColorPicker';
import toast from 'react-hot-toast';
import ShareMenu from './components/ShareMenu';
import { attemptShare } from './lib/shareUtils';

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
            const fourUpImageUrl = await generateFourUpImage(
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
    
            const croppedImages = await cropFourUpSheet(fourUpImageUrl);
    
            const finalGeneratedImagesState: Record<string, GeneratedImage> = {};
            ANGLES.forEach(angle => {
                const url = croppedImages[angle];
                setAngleStatus(angle, url ? 'done' : 'error', url, url ? undefined : `Failed to crop ${angle} view.`);
                finalGeneratedImagesState[angle] = {
                    status: url ? 'done' : 'error',
                    url: url,
                    error: url ? undefined : `Failed to crop ${angle} view.`
                };
            });
    
            const allDone = Object.values(finalGeneratedImagesState).every(img => img.status === 'done');
            if (allDone) {
                await saveToHistory(finalGeneratedImagesState);
            }
    
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            ANGLES.forEach(angle => {
                setAngleStatus(angle, 'error', undefined, errorMessage);
            });
            console.error(`Failed to generate 4-up image:`, err);
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
    const hasHairstyleInput = !!(state.hairstyleDescription.trim() || state.hairstyleReferenceImage);
    const isGenerationDisabled = state.isGenerating || !hasHairstyleInput;

    return (
        <main className="bg-neutral-950 text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-40 relative overflow-x-hidden">
            <AnimatePresence>
                {isUploadOptionsOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setIsUploadOptionsOpen(false)}>
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-neutral-900 rounded-lg shadow-xl w-full max-w-xs border border-neutral-700 p-8 flex flex-col items-center gap-6">
                            <h2 className="text-2xl font-semibold text-center text-white">Choose Source</h2>
                            <div className="w-full flex flex-col gap-4">
                                <Button onClick={handleTakePhoto} variant="primary" className="w-full"><Camera className="mr-2 h-4 w-4"/>Take Photo</Button>
                                <Button onClick={handleSelectFile} variant="secondary" className="w-full"><FileImage className="mr-2 h-4 w-4"/>From Library</Button>
                            </div>
                            <Button onClick={() => setIsUploadOptionsOpen(false)} variant="ghost" className="mt-4">Cancel</Button>
                        </motion.div>
                    </motion.div>
                )}
                {isCameraOpen && <CameraCapture onCapture={handleCameraCapture} onCancel={() => { setIsCameraOpen(false); setUploadTarget(null); }} />}
                {editingImage && editingImageType && <ImageEditor imageSrc={editingImage} onSave={handleEditorSave} onCancel={handleEditorCancel} title={editingImageType === 'client' ? 'Edit Your Photo' : 'Edit Reference Image'} />}
            </AnimatePresence>

            <HistoryPanel />
            <ShareMenu />
            
            <div className="z-10 flex flex-col items-center w-full h-full flex-1 min-h-0">
                <header className="w-full max-w-6xl text-center my-10 px-4">
                    <h1 className="text-5xl md:text-7xl font-permanent-marker text-neutral-100 tracking-wider">Barber Booth Pro</h1>
                    <p className="text-neutral-300 mt-2 text-lg md:text-xl">Your personal AI hair salon.</p>
                </header>

                <AnimatePresence mode="wait">
                    <motion.div key={state.appState} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="w-full flex flex-col items-center">
                        {state.appState === 'idle' && (
                            <Card className="w-full max-w-sm cursor-pointer group" onClick={() => handleOpenUploadOptions('client')}>
                                <CardContent className="p-6 flex flex-col items-center justify-center aspect-square">
                                    <Camera className="w-16 h-16 text-neutral-400 group-hover:text-pink-400 transition-colors" />
                                    <p className="mt-4 text-xl font-semibold">Upload Your Photo</p>
                                    <p className="text-neutral-400 text-sm">Click here to start</p>
                                    <input ref={clientImageInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleClientImageUpload} />
                                </CardContent>
                            </Card>
                        )}

                        {state.appState === 'image-uploaded' && state.uploadedImage && (
                            <div className="w-full max-w-xl flex flex-col items-center gap-8">
                                <div className="relative group">
                                    <img src={state.uploadedImage} alt="Uploaded" className="w-48 h-48 object-cover rounded-full border-4 border-neutral-700 shadow-lg"/>
                                    <Button onClick={() => handleOpenUploadOptions('client')} variant="secondary" size="sm" className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Replace className="w-4 h-4 mr-2"/> Replace
                                    </Button>
                                </div>
                                <Card className="w-full p-6">
                                    <div className="flex bg-neutral-800 p-1 rounded-md mb-4">
                                        <button onClick={() => setInputMode('text')} className={cn("w-1/2 px-4 py-1.5 text-sm rounded transition-colors", state.inputMode === 'text' ? 'bg-indigo-600 text-white' : 'text-neutral-300 hover:bg-neutral-700/50')}>Text Prompt</button>
                                        <button onClick={() => setInputMode('image')} className={cn("w-1/2 px-4 py-1.5 text-sm rounded transition-colors", state.inputMode === 'image' ? 'bg-indigo-600 text-white' : 'text-neutral-300 hover:bg-neutral-700/50')}>Reference Image</button>
                                    </div>
                                    {state.inputMode === 'text' ? (
                                        <div className="space-y-4">
                                            <div className="relative w-full">
                                                <textarea value={state.hairstyleDescription} onFocus={() => setIsHairstyleInputFocused(true)} onBlur={() => setTimeout(() => setIsHairstyleInputFocused(false), 200)} onChange={(e) => setHairstyleDescription(e.target.value)} placeholder="e.g., 'a curly mohawk dyed bright blue'..." className="w-full h-24 p-3 pr-10 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-2 focus:ring-pink-500 placeholder:text-neutral-500" />
                                                {isFetchingSuggestions && (
                                                    <div className="absolute top-3 right-3">
                                                        <svg className="animate-spin h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {randomSuggestions.map(s => <button key={s} onClick={() => handleSuggestionClick(s)} className="text-xs px-3 py-1 bg-neutral-700 text-neutral-300 rounded-full hover:bg-neutral-600 transition-colors">{s}</button>)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {state.hairstyleReferenceImage ? (
                                                <div className="space-y-3">
                                                    <div className="relative group">
                                                        <img src={state.hairstyleReferenceImage} alt="Reference" className="w-full rounded-md object-cover max-h-48" />
                                                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button onClick={() => handleOpenUploadOptions('reference')} size="sm" variant="secondary"><Replace className="w-4 h-4 mr-1"/>Change</Button>
                                                            <Button onClick={() => setHairstyleReferenceImage(null)} size="sm" variant="destructive"><Trash2 className="w-4 h-4 mr-1"/>Remove</Button>
                                                        </div>
                                                    </div>
                                                    <textarea value={state.hairstyleReferenceDescription} onChange={(e) => setHairstyleReferenceDescription(e.target.value)} placeholder="Describe the haircut..." className="w-full h-20 p-3 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-2 focus:ring-pink-500 placeholder:text-neutral-500"/>
                                                    <textarea value={state.hairstyleModification} onChange={(e) => setHairstyleModification(e.target.value)} placeholder="Optional modifications..." className="w-full h-20 p-3 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-2 focus:ring-pink-500 placeholder:text-neutral-500"/>
                                                </div>
                                            ) : <div onClick={() => handleOpenUploadOptions('reference')} className="w-full h-24 border-2 border-dashed border-neutral-600 rounded-md flex items-center justify-center cursor-pointer hover:border-pink-500 hover:text-white transition-colors"><p>Drop image or click</p><input ref={hairstyleImageInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0], 'reference')} /></div>}
                                        </div>
                                    )}
                                    <ColorPicker />
                                </Card>
                                <div className="flex items-center gap-4">
                                    <Button onClick={() => setUploadedImage(null)} variant="secondary">Start Over</Button>
                                    <Button onClick={runGenerationSequence} disabled={isGenerationDisabled} variant="primary"><Wand2 className="mr-2 h-4 w-4"/>{state.isGenerating ? 'Generating...' : 'Generate Pro'}</Button>
                                </div>
                            </div>
                        )}

                        {state.appState === 'generating-results' && (
                            <div className="w-full max-w-6xl flex flex-col items-center">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
                                    {ANGLES.map((angle) => (
                                        <PolaroidCard
                                            key={angle}
                                            caption={angle.charAt(0).toUpperCase() + angle.slice(1)}
                                            status={state.generatedImages[angle]?.status || 'pending'}
                                            imageUrl={state.generatedImages[angle]?.url}
                                            error={state.generatedImages[angle]?.error}
                                            onRegenerate={handleRegenerateAll}
                                            angle={angle}
                                        />
                                    ))}
                                </div>
                                <div className="h-24 mt-8 flex items-center justify-center">
                                    {!state.isGenerating && allImagesDone && (
                                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap justify-center items-center gap-4">
                                            <Button onClick={handleDownloadFourUpSheet} disabled={isDownloading} variant="secondary">{isDownloading ? 'Creating...' : 'Download 4-Up'}</Button>
                                            <Button onClick={handleShareFourUpSheet} disabled={isSharing} variant="secondary"><Share2 className="mr-2 h-4 w-4"/>{isSharing ? 'Preparing...' : 'Share 4-Up'}</Button>
                                            <Button onClick={handleGenerateVideoClick} disabled={state.videoStatus === 'generating'} variant="primary">{state.videoStatus === 'generating' ? 'Animating...' : 'Bring to Life ✨'}</Button>
                                            <Button onClick={() => setUploadedImage(null)} variant="secondary">Start Over</Button>
                                        </motion.div>
                                    )}
                                </div>
                                {state.videoStatus !== 'idle' && (
                                    <motion.div className="w-full max-w-2xl mt-4" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
                                        <VideoPreview status={state.videoStatus} progressMessage={state.videoProgress} videoUrl={state.videoUrl} error={state.videoError} onClear={() => setVideoStatus('idle')} />
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            <Footer />
        </main>
    );
}

export default App;