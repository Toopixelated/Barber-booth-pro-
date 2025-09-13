/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Angle } from './App';

export type ImageStatus = 'pending' | 'done' | 'error';
export type VideoStatus = 'idle' | 'generating' | 'done' | 'error';

export interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

export interface HistoryItem {
    id: string;
    timestamp: number;
    uploadedImage: string;
    hairstyleDescription: string;
    hairstyleReferenceImage: string | null;
    hairstyleReferenceDescription: string;
    hairstyleModification: string;
    hairColor: string;
    generatedImages: Record<string, GeneratedImage>;
    generatedVideoUrl?: string;
    useMasking: boolean;
    isFavorite?: boolean;
}

interface AppState {
    // Inputs
    uploadedImage: string | null;
    hairstyleDescription: string;
    hairstyleReferenceImage: string | null;
    hairstyleReferenceDescription: string;
    hairstyleModification: string;
    useMasking: boolean;
    hairColor: string;
    inputMode: 'text' | 'image';

    // Generation State
    generatedImages: Record<string, GeneratedImage>;
    isGenerating: boolean;
    appState: 'idle' | 'image-uploaded' | 'generating-results';
    comparisonSourceImage: string | null; // Holds the "before" image for the current generation

    // Video State
    videoStatus: VideoStatus;
    videoUrl: string | null;
    videoProgress: string;
    videoError: string;

    // History
    generationHistory: HistoryItem[];

    // UI State
    isHistoryPanelOpen: boolean;
    isShareMenuOpen: boolean;
    shareContent: { url: string; type: 'image' | 'video'; title: string } | null;
    installPromptEvent: any | null;
    locale: string;
}

interface AppActions {
    // Input Actions
    setUploadedImage: (image: string | null) => void;
    setHairstyleDescription: (desc: string) => void;
    setHairstyleReferenceImage: (image: string | null) => void;
    setHairstyleReferenceDescription: (desc: string) => void;
    setHairstyleModification: (mod: string) => void;
    setUseMasking: (use: boolean) => void;
    setHairColor: (color: string) => void;
    setInputMode: (mode: 'text' | 'image') => void;
    resetInputs: () => void;
    
    // Generation Actions
    startGeneration: () => void;
    setAngleStatus: (angle: Angle, status: ImageStatus, url?: string, error?: string) => void;
    finishGeneration: () => void;
    setComparisonSourceImage: (image: string | null) => void;

    // Video Actions
    setVideoStatus: (status: VideoStatus) => void;
    setVideoUrl: (url: string | null) => void;
    setVideoProgress: (progress: string) => void;
    setVideoError: (error: string) => void;

    // History Actions
    addToHistory: (item: HistoryItem) => void;
    clearHistory: () => void;
    toggleFavorite: (id: string) => void;
    restoreFromHistory: (item: HistoryItem) => void;
    setHistory: (history: HistoryItem[]) => void;

    // UI Actions
    setHistoryPanelOpen: (isOpen: boolean) => void;
    openShareMenu: (content: { url: string; type: 'image' | 'video'; title: string }) => void;
    closeShareMenu: () => void;
    setInstallPromptEvent: (event: any | null) => void;
    setLocale: (locale: string) => void;
}

export const useStore = create<AppState & AppActions>()(
    persist(
        (set, get) => ({
            // Default State
            uploadedImage: null,
            hairstyleDescription: '',
            hairstyleReferenceImage: null,
            hairstyleReferenceDescription: '',
            hairstyleModification: '',
            useMasking: true,
            hairColor: '',
            inputMode: 'text',
            generatedImages: {},
            isGenerating: false,
            appState: 'idle',
            comparisonSourceImage: null,
            videoStatus: 'idle',
            videoUrl: null,
            videoProgress: '',
            videoError: '',
            generationHistory: [],
            isHistoryPanelOpen: false,
            isShareMenuOpen: false,
            shareContent: null,
            installPromptEvent: null,
            locale: 'en',
            
            // Actions
            setUploadedImage: (image) => {
                get().resetInputs();
                set({ 
                    uploadedImage: image, 
                    appState: image ? 'image-uploaded' : 'idle',
                    comparisonSourceImage: image, // Also set the source for potential immediate use
                });
            },
            setHairstyleDescription: (desc) => set({ hairstyleDescription: desc }),
            setHairstyleReferenceImage: (image) => set({ hairstyleReferenceImage: image }),
            setHairstyleReferenceDescription: (desc) => set({ hairstyleReferenceDescription: desc }),
            setHairstyleModification: (mod) => set({ hairstyleModification: mod }),
            setUseMasking: (use) => set({ useMasking: use }),
            setHairColor: (color) => set({ hairColor: color }),
            setInputMode: (mode) => set({ inputMode: mode }),
            resetInputs: () => set({
                hairstyleDescription: '',
                hairstyleReferenceImage: null,
                hairstyleReferenceDescription: '',
                hairstyleModification: '',
                hairColor: '',
                generatedImages: {},
                videoStatus: 'idle',
                videoUrl: null,
                videoError: '',
                videoProgress: '',
            }),
            
            startGeneration: () => {
                const initialImages: Record<string, GeneratedImage> = {};
                (['front', 'left', 'right', 'back'] as Angle[]).forEach(angle => { initialImages[angle] = { status: 'pending' }; });
                set({ 
                    isGenerating: true, 
                    appState: 'generating-results', 
                    videoStatus: 'idle', 
                    videoUrl: null, 
                    generatedImages: initialImages,
                });
            },
            setAngleStatus: (angle, status, url, error) => {
                set(state => ({
                    generatedImages: {
                        ...state.generatedImages,
                        [angle]: { status, url, error }
                    }
                }));
            },
            finishGeneration: () => set({ isGenerating: false }),
            setComparisonSourceImage: (image) => set({ comparisonSourceImage: image }),

            setVideoStatus: (status) => set({ videoStatus: status }),
            setVideoUrl: (url) => set({ videoUrl: url }),
            setVideoProgress: (progress) => set({ videoProgress: progress }),
            setVideoError: (error) => set({ videoError: error }),

            addToHistory: (item) => set(state => ({ generationHistory: [item, ...state.generationHistory].slice(0, 50) })),
            clearHistory: () => set({ generationHistory: [] }),
            toggleFavorite: (id) => set(state => ({
                generationHistory: state.generationHistory.map(item => 
                    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
                )
            })),
            restoreFromHistory: (item) => set({
                ...item,
                appState: 'generating-results',
                isHistoryPanelOpen: false,
                videoStatus: item.generatedVideoUrl ? 'done' : 'idle',
                videoUrl: item.generatedVideoUrl || null,
                inputMode: item.hairstyleReferenceImage ? 'image' : 'text',
                comparisonSourceImage: item.uploadedImage, // Ensure comparison source is restored
            }),
            setHistory: (history) => set({ generationHistory: history }),
            
            setHistoryPanelOpen: (isOpen) => set({ isHistoryPanelOpen: isOpen }),
            openShareMenu: (content) => set({ isShareMenuOpen: true, shareContent: content }),
            closeShareMenu: () => set({ isShareMenuOpen: false }),
            setInstallPromptEvent: (event) => set({ installPromptEvent: event }),
            setLocale: (locale) => set({ locale }),
        }),
        {
            name: 'barber-booth-pro-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ generationHistory: state.generationHistory }),
        }
    )
);