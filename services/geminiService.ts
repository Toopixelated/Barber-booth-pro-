/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { useStore, HistoryItem } from '../store';

// =======================================================================================
// LIVE GEMINI API IMPLEMENTATION
// ---------------------------------------------------------------------------------------
// This service now communicates directly with the Google Gemini API from the client-side.
// - It uses the API_KEY from the environment variables.
// - History is still managed locally using localStorage for this client-only version.
// =======================================================================================

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const MOCK_HISTORY_STORAGE_KEY = 'mock_user_history';

// --- Helper Functions ---

/**
 * A simple delay function to simulate network/processing latency.
 * @param ms The number of milliseconds to wait.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Converts a data URL string into a format suitable for the Gemini API.
 * @param dataUrl The data URL (e.g., "data:image/jpeg;base64,...").
 * @returns An object with `mimeType` and `data` (base64 string).
 */
function dataUrlToGenerativePart(dataUrl: string) {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        throw new Error('Invalid data URL');
    }
    const [_, mimeType, data] = match;
    return {
        inlineData: {
            mimeType,
            data,
        },
    };
}

/**
 * Converts a Blob object to a Base64 data URL.
 * @param blob The blob to convert.
 * @returns A promise that resolves to the data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to read blob as data URL."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


// --- Interface Definitions ---

interface GenerationOptions {
    description?: string;
    referenceImage?: string | null;
    modification?: string;
    useMasking?: boolean;
    hairColor?: string;
}

/**
 * [LIVE] Fetches hairstyle suggestions from the Gemini API.
 * @param query The user's typed input.
 * @returns A promise that resolves to an array of suggestion strings.
 */
export async function getHairstyleSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) {
        return [];
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the user's idea "${query}", generate 5 creative and distinct hairstyle suggestions.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: "A single hairstyle suggestion."
                    },
                },
            },
        });

        const jsonStr = response.text.trim();
        const suggestions = JSON.parse(jsonStr);
        return suggestions;
    } catch (error) {
        console.error("Error fetching AI suggestions:", error);
        return []; // Return empty on error to prevent crash
    }
}


/**
 * [LIVE] Requests a 2x2 grid image from the Gemini API.
 * @param baseImage The original user-provided image.
 * @param options An object containing generation options.
 * @returns A promise that resolves to a base64-encoded data URL of the generated 2x2 grid image.
 */
export async function generateFourUpImage(
    baseImage: { dataUrl: string },
    options: GenerationOptions
): Promise<string> {
    const parts: any[] = [dataUrlToGenerativePart(baseImage.dataUrl)];
    let prompt: string;

    let hairstylePrompt: string;
    if (options.description) {
        hairstylePrompt = options.description;
        if (options.hairColor) {
            hairstylePrompt += ` with a vibrant ${options.hairColor} color`;
        }
    } else if (options.hairColor) {
        hairstylePrompt = `a new hairstyle dyed a vibrant ${options.hairColor} color`;
    } else {
        // This case should be prevented by the UI, but as a fallback:
        hairstylePrompt = "a new, fashionable hairstyle";
    }

    if (options.referenceImage) {
        parts.push(dataUrlToGenerativePart(options.referenceImage));
        // This prompt frames the task as a "style transfer" which is more accurate.
        prompt = `Task: Style Transfer Photo Edit
Subject: Edit the person in the first provided photo. Transfer the hairstyle from the second reference image onto them.
Style & Quality: A photorealistic, high-detail, studio-quality portrait. The lighting should be soft and even, mimicking a professional softbox setup. Shot on a DSLR with an 85mm portrait lens, f/1.8 aperture, with sharp focus on the person.
Output Requirements:
- A single, clean 2x2 grid image showing four distinct angles.
- Top-Left: Front view (head and shoulders portrait).
- Top-Right: Left side view (profile).
- Bottom-Left: Right three-quarters view (45-degree angle).
- Bottom-Right: Back view (180-degrees).
Critical Rules:
- The person's identity, facial features, and skin tone MUST be perfectly preserved across all views. This is an edit, not a replacement.
- The new hairstyle must be consistent in color, length, and texture across all four angles.
Negative Prompts: Do not add any text, borders, watermarks, or other artifacts. Avoid unnatural skin textures, distorted features, or blurry results.`;

        if (options.description) {
            prompt += `\nUse this description as a guide: "${options.description}".`;
        }
        if (options.modification) {
            prompt += `\nApply this specific modification to the reference style: "${options.modification}".`;
        }
    } else {
        // This is the prompt for text-only descriptions.
        prompt = `Task: Photo Edit
Subject: Edit the person in the first provided photo to give them a "${hairstylePrompt}" hairstyle.
Style & Quality: A photorealistic, high-detail, studio-quality portrait. The lighting should be soft and even, mimicking a professional softbox setup. Shot on a DSLR with an 85mm portrait lens, f/1.8 aperture, with sharp focus on the person.
Output Requirements:
- A single, clean 2x2 grid image showing four distinct angles.
- Top-Left: Front view (head and shoulders portrait).
- Top-Right: Left side view (profile).
- Bottom-Left: Right three-quarters view (45-degree angle).
- Bottom-Right: Back view (180-degrees).
Critical Rules:
- The person's identity, facial features, and skin tone MUST be perfectly preserved across all views. This is an edit, not a replacement.
- The new hairstyle must be consistent in color, length, and texture across all four angles.
Negative Prompts: Do not add any text, borders, watermarks, or other artifacts. Avoid unnatural skin textures, distorted features, or blurry results.`;
    }

    parts.push({ text: prompt });

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const { mimeType, data } = part.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    throw new Error("No image was generated by the model.");
}


/**
 * [LIVE] Requests a 360-degree video from the Gemini API.
 * @param hairstyleImage The AI-generated 'front' view image.
 * @param hairstyleDescription The text description of the desired hairstyle.
 * @param onProgress A callback function to report progress updates.
 * @returns A promise that resolves to the data URL of the generated video.
 */
export async function generateHairstyleVideo(
    hairstyleImage: { dataUrl: string },
    hairstyleDescription: string,
    onProgress: (message: string) => void
): Promise<string> {
    const imagePart = dataUrlToGenerativePart(hairstyleImage.dataUrl);

    const prompt = `Title: High-End Salon Hairstyle Showcase (Portrait)

Subject: A photorealistic, ultra high-fidelity video of the person from the input image, showcasing their new hairstyle: "${hairstyleDescription}". The person's face, identity, and features must be perfectly preserved.

Shot Type: A smooth, continuous 360-degree orbital shot (turntable view) of the person's head and shoulders. The video is framed vertically to fit a portrait aspect ratio. The rotation must start at the front view and complete one full 360-degree turn by the end of the video, creating a flawless loop.

Setting & Lighting: A clean, minimalist studio environment with a soft, neutral grey background. The lighting is a professional three-point setup (key, fill, and back light) designed to accentuate the hair's texture, volume, and color details with no harsh shadows.

Style & Aesthetics: Cinematic, professional color grading, sharp focus, extremely detailed, photorealistic, 720p resolution, 9:16 aspect ratio. The overall mood is sophisticated and high-fashion.

Negative Prompts: a bad video, blurry, grainy, distorted facial features, shaky camera movement, sudden cuts, flickering lights, watermarks, text overlays, unnatural skin texture, warped background, speech, sound effects, loud music, landscape orientation, horizontal video.`;

    onProgress("Initializing video generation...");
    let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001', // Using stable VEO 2 model to fix 404 error
        prompt: prompt,
        image: {
            imageBytes: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType,
        },
        config: {
            numberOfVideos: 1,
        }
    });

    const progressMessages = [
        "Briefing the AI director...",
        "Rendering 360° frames...",
        "Applying cinematic lighting...",
        "Encoding final video..."
    ];
    let progressIndex = 0;

    while (!operation.done) {
        onProgress(progressMessages[progressIndex % progressMessages.length]);
        progressIndex++;
        await delay(10000); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    onProgress("Finalizing and downloading...");

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed, but no download link was found.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video file. Status: ${response.status}`);
    }
    
    const videoBlob = await response.blob();
    return blobToDataUrl(videoBlob);
}

// --- Local Storage History Service ---

/**
 * [LOCAL] Fetches the user's entire generation history from localStorage.
 * @returns A promise that resolves to an array of HistoryItem objects.
 */
export async function getUserHistory(): Promise<HistoryItem[]> {
    await delay(500);
    const historyJson = localStorage.getItem(MOCK_HISTORY_STORAGE_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
}

/**
 * [LOCAL] Adds a new history item to localStorage.
 * @param item The HistoryItem data to add (without client-side ID).
 * @returns A promise that resolves to the newly created HistoryItem.
 */
export async function addHistoryItem(item: Omit<HistoryItem, 'id'>): Promise<HistoryItem> {
    await delay(300);
    const currentHistory = await getUserHistory();
    const newItem: HistoryItem = {
        ...item,
        id: crypto.randomUUID(),
    };
    const updatedHistory = [newItem, ...currentHistory];
    localStorage.setItem(MOCK_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    return newItem;
}

/**
 * [LOCAL] Updates an existing history item in localStorage.
 * @param id The ID of the history item to update.
 * @param updates A partial object of the HistoryItem with fields to update.
 * @returns A promise that resolves to the updated HistoryItem.
 */
export async function updateHistoryItem(id: string, updates: Partial<HistoryItem>): Promise<HistoryItem> {
    await delay(200);
    let currentHistory = await getUserHistory();
    let updatedItem: HistoryItem | null = null;
    
    const newHistory = currentHistory.map(item => {
        if (item.id === id) {
            updatedItem = { ...item, ...updates };
            return updatedItem;
        }
        return item;
    });

    if (!updatedItem) {
        throw new Error("Item not found");
    }

    localStorage.setItem(MOCK_HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    return updatedItem;
}


/**
 * [LOCAL] Clears the user's entire generation history from localStorage.
 */
export async function clearUserHistory(): Promise<void> {
    await delay(500);
    localStorage.removeItem(MOCK_HISTORY_STORAGE_KEY);
}