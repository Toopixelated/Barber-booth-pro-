/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { Angle } from './App';
import toast from 'react-hot-toast';
import {
    getUserHistory,
    addHistoryItem,
    clearUserHistory,
    updateHistoryItem,
} from './services/geminiService';

export type ImageStatus = 'pending' | 'done' | 'error';
export type VideoStatus = 'idle' | 'generating' | 'done' | 'error';
export type HistoryFilterType = 'all' | 'favorites' | 'text' | 'image';

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
    hairstyleModification: string;
    hairColor: string;
    generatedImages: Record<string, GeneratedImage>;
    generatedVideoUrl?: string;
    useMasking: boolean;
    isFavorite?: boolean;
}

interface AppState {
    // Auth State
    currentUser: any | null; // Holds the Firebase user object
    idToken: string | null; // JWT token for backend authentication

    // Inputs
    uploadedImage: string | null;
    hairstyleDescription: string;
    hairstyleReferenceImage: string | null;
    hairstyleModification: string;
    useMasking: boolean;
    hairColor: string;

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
    isHistoryLoading: boolean;
    historyFilterType: HistoryFilterType;
    historyFilterDateRange: { start: string | null; end: string | null };

    // UI State & Settings
    isHistoryPanelOpen: boolean;
    isShareMenuOpen: boolean;
    shareContent: { url: string; type: 'image' | 'video'; title: string } | null;
    installPromptEvent: any | null;
    isSoundEnabled: boolean;
    isUpscaling: boolean;
    upscalingProgress: number;
}

interface AppActions {
    // Auth Actions
    setCurrentUser: (user: any, token: string | null) => void;
    logoutUser: () => void;

    // Input Actions
    setUploadedImage: (image: string | null) => void;
    setHairstyleDescription: (desc: string) => void;
    setHairstyleReferenceImage: (image: string | null) => void;
    setHairstyleModification: (mod: string) => void;
    setUseMasking: (use: boolean) => void;
    setHairColor: (color: string) => void;
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
    fetchHistory: () => Promise<void>;
    addToHistory: (item: Omit<HistoryItem, 'id'>) => Promise<void>;
    clearHistory: () => Promise<void>;
    toggleFavorite: (id: string) => Promise<void>;
    restoreFromHistory: (item: HistoryItem) => void;
    setHistory: (history: HistoryItem[]) => void;
    setHistoryFilterType: (filter: HistoryFilterType) => void;
    setHistoryFilterDateRange: (range: { start: string | null; end: string | null }) => void;

    // UI & Settings Actions
    setHistoryPanelOpen: (isOpen: boolean) => void;
    openShareMenu: (content: { url: string; type: 'image' | 'video'; title: string }) => void;
    closeShareMenu: () => void;
    setInstallPromptEvent: (event: any | null) => void;
    toggleSoundEnabled: () => void;
    setUpscalingState: (isUpscaling: boolean) => void;
    setUpscalingProgress: (progress: number) => void;
}

// Wrapper for localStorage to handle potential errors (e.g., in private browsing mode)
const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        try { return localStorage.getItem(name); } 
        catch (e) { console.warn(`Error reading localStorage key "${name}":`, e); return null; }
    },
    setItem: (name, value) => {
        try { localStorage.setItem(name, value); } 
        catch (e) { console.warn(`Error setting localStorage key "${name}":`, e); }
    },
    removeItem: (name) => {
        try { localStorage.removeItem(name); }
        catch (e) { console.warn(`Error removing localStorage key "${name}":`, e); }
    },
};

export const useStore = create<AppState & AppActions>()(
    persist(
        (set, get) => ({
            // Default State
            currentUser: null,
            idToken: null,
            uploadedImage: null,
            hairstyleDescription: '',
            hairstyleReferenceImage: null,
            hairstyleModification: '',
            useMasking: true,
            hairColor: '',
            generatedImages: {},
            isGenerating: false,
            appState: 'idle',
            comparisonSourceImage: null,
            videoStatus: 'idle',
            videoUrl: null,
            videoProgress: '',
            videoError: '',
            generationHistory: [],
            isHistoryLoading: true, // Start in loading state
            historyFilterType: 'all',
            historyFilterDateRange: { start: null, end: null },
            isHistoryPanelOpen: false,
            isShareMenuOpen: false,
            shareContent: null,
            installPromptEvent: null,
            isSoundEnabled: true,
            isUpscaling: false,
            upscalingProgress: 0,
            
            // Actions
            setCurrentUser: (user, token) => {
                set({ currentUser: user, idToken: token, isHistoryLoading: true });
                if (user && token) {
                    get().fetchHistory();
                } else {
                    set({ isHistoryLoading: false, generationHistory: [] }); // Clear history if no user
                }
            },
            logoutUser: () => set({ 
                currentUser: null, 
                idToken: null, 
                // Reset main state on logout
                appState: 'idle',
                uploadedImage: null,
                generatedImages: {},
                videoStatus: 'idle',
                videoUrl: null,
                hairstyleDescription: '',
                hairstyleReferenceImage: null,
                hairstyleModification: '',
                hairColor: '',
                generationHistory: [],
                isHistoryLoading: false,
            }),

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
            setHairstyleModification: (mod) => set({ hairstyleModification: mod }),
            setUseMasking: (use) => set({ useMasking: use }),
            setHairColor: (color) => set({ hairColor: color }),
            resetInputs: () => set({
                hairstyleDescription: '',
                hairstyleReferenceImage: null,
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

            fetchHistory: async () => {
                if (!get().idToken) return;
                set({ isHistoryLoading: true });
                try {
                    const history = await getUserHistory();
                    set({ generationHistory: history, isHistoryLoading: false });
                } catch (error) {
                    toast.error("Could not load your history from the cloud.");
                    console.error("History fetch error:", error);
                    set({ isHistoryLoading: false }); // Use cached history on error
                }
            },
            addToHistory: async (item) => {
                const tempId = crypto.randomUUID();
                const newItem: HistoryItem = { ...item, id: tempId, timestamp: Date.now() };
                const previousHistory = get().generationHistory;
                // Optimistic update
                set(state => ({ generationHistory: [newItem, ...state.generationHistory].slice(0, 50) }));
                try {
                    const savedItem = await addHistoryItem(item);
                    // Replace temp item with real one from server
                    set(state => ({
                        generationHistory: state.generationHistory.map(h => h.id === tempId ? savedItem : h)
                    }));
                } catch (error) {
                    toast.error("Failed to save to your account history.");
                    set({ generationHistory: previousHistory }); // Revert
                }
            },
            clearHistory: async () => {
                const previousHistory = get().generationHistory;
                if (previousHistory.length === 0) return;
                
                set({ generationHistory: [] }); // Optimistic update
                try {
                    await clearUserHistory();
                } catch (error) {
                    toast.error("Could not clear history from your account.");
                    set({ generationHistory: previousHistory }); // Revert
                }
            },
            toggleFavorite: async (id: string) => {
                const previousHistory = get().generationHistory;
                const itemToUpdate = previousHistory.find(item => item.id === id);
                if (!itemToUpdate) return;
                
                // Optimistic update
                const updatedHistory = previousHistory.map(item =>
                    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
                );
                set({ generationHistory: updatedHistory });
                
                try {
                    await updateHistoryItem(id, { isFavorite: !itemToUpdate.isFavorite });
                } catch (error) {
                    toast.error("Failed to update favorite status.");
                    set({ generationHistory: previousHistory }); // Revert
                }
            },
            restoreFromHistory: (item) => set({
                ...item,
                appState: 'generating-results',
                isHistoryPanelOpen: false,
                videoStatus: item.generatedVideoUrl ? 'done' : 'idle',
                videoUrl: item.generatedVideoUrl || null,
                comparisonSourceImage: item.uploadedImage, // Ensure comparison source is restored
            }),
            setHistory: (history) => set({ generationHistory: history }),
            setHistoryFilterType: (filter) => set({ historyFilterType: filter }),
            setHistoryFilterDateRange: (range) => set({ historyFilterDateRange: range }),
            
            setHistoryPanelOpen: (isOpen) => set({ isHistoryPanelOpen: isOpen }),
            openShareMenu: (content) => set({ isShareMenuOpen: true, shareContent: content }),
            closeShareMenu: () => set({ isShareMenuOpen: false }),
            setInstallPromptEvent: (event) => set({ installPromptEvent: event }),
            toggleSoundEnabled: () => set(state => ({ isSoundEnabled: !state.isSoundEnabled })),
            setUpscalingState: (isUpscaling) => {
                if (!isUpscaling) {
                    set({ isUpscaling, upscalingProgress: 0 }); // Reset progress on close
                } else {
                    set({ isUpscaling });
                }
            },
            setUpscalingProgress: (progress) => set({ upscalingProgress: progress }),
        }),
        {
            name: 'barber-booth-pro-storage',
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (state) => ({
                // Persist history as an offline cache, and user settings.
                generationHistory: state.generationHistory,
                isSoundEnabled: state.isSoundEnabled,
            }),
            onRehydrateStorage: () => {
                return (state) => {
                    if (state) {
                        // When rehydrating, we don't know if the user is logged in yet.
                        // We'll show the cached history, but mark it as loading
                        // until AuthGate confirms the user's status.
                        state.isHistoryLoading = true;
                    }
                };
            },
        }
    )
);