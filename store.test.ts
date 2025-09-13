import { useStore, HistoryItem } from './store';
import { act } from '@testing-library/react';

// Mock localStorage for the persist middleware
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Zustand Store', () => {
  const initialState = useStore.getState();

  beforeEach(() => {
    // Reset the store to its initial state before each test
    act(() => {
      useStore.setState(initialState);
    });
    localStorageMock.clear();
  });

  it('should set an uploaded image and reset inputs', () => {
    act(() => {
      useStore.getState().setHairstyleDescription('some old description');
      useStore.getState().setUploadedImage('new_image_url');
    });

    const state = useStore.getState();
    expect(state.uploadedImage).toBe('new_image_url');
    expect(state.appState).toBe('image-uploaded');
    // Check that inputs were reset
    expect(state.hairstyleDescription).toBe('');
  });

  it('should start generation correctly', () => {
    act(() => {
      useStore.getState().startGeneration();
    });

    const state = useStore.getState();
    expect(state.isGenerating).toBe(true);
    expect(state.appState).toBe('generating-results');
    expect(Object.keys(state.generatedImages)).toEqual(['front', 'left', 'right', 'back']);
    expect(state.generatedImages.front.status).toBe('pending');
  });

  it('should add an item to history and respect the limit', () => {
    // Add 51 items
    for (let i = 0; i < 51; i++) {
      act(() => {
        const newItem: HistoryItem = { id: `id-${i}`, timestamp: Date.now() } as HistoryItem;
        useStore.getState().addToHistory(newItem);
      });
    }

    const state = useStore.getState();
    expect(state.generationHistory).toHaveLength(50);
    // The first item should be the last one added
    expect(state.generationHistory[0].id).toBe('id-50');
    // The last item should be the second one added
    expect(state.generationHistory[49].id).toBe('id-1');
  });

  it('should clear the history', () => {
    act(() => {
      const newItem: HistoryItem = { id: 'id-1', timestamp: Date.now() } as HistoryItem;
      useStore.getState().addToHistory(newItem);
    });

    expect(useStore.getState().generationHistory).toHaveLength(1);

    act(() => {
      useStore.getState().clearHistory();
    });

    expect(useStore.getState().generationHistory).toHaveLength(0);
  });

  it('should restore state from a history item', () => {
    const historyItem: HistoryItem = {
      id: 'history-id-1',
      timestamp: 12345,
      uploadedImage: 'history_image.jpg',
      hairstyleDescription: 'a historic hairstyle',
      hairstyleReferenceImage: null,
      hairstyleReferenceDescription: '',
      hairstyleModification: '',
      hairColor: '#ff0000',
      generatedImages: { front: { status: 'done', url: 'history_front.jpg' } },
      generatedVideoUrl: 'history_video.mp4',
      useMasking: false,
      isFavorite: true,
    };

    act(() => {
      useStore.getState().restoreFromHistory(historyItem);
    });

    const state = useStore.getState();
    expect(state.uploadedImage).toBe('history_image.jpg');
    expect(state.hairstyleDescription).toBe('a historic hairstyle');
    expect(state.videoUrl).toBe('history_video.mp4');
    expect(state.appState).toBe('generating-results');
  });
});
