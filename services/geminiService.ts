/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { GenerateContentResponse, Part, GenerateVideosOperation } from "@google/genai";
import type { Angle } from "../App";
import { resizeImageForApi } from "../lib/albumUtils";
import i18n from '../i18n/i18n';

// FIX: Check for both API_KEY and API_key to handle environment inconsistencies.
const API_KEY = process.env.API_KEY || (window as any).process?.env?.API_key;

if (!API_KEY) {
  throw new Error("API_KEY or API_key environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Helper Functions ---

function dataUrlToPart(dataUrl: string): Part {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error(i18n.t('error.invalid_data_url'));
    }
    const [, mimeType, data] = match;
    return { inlineData: { mimeType, data } };
}

function processGeminiResponse(response: GenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textResponse = response.text;
    console.error("API did not return an image. Response:", textResponse);
    throw new Error(i18n.t('error.model_text_response', { textResponse: textResponse || i18n.t('error.no_text_response') }));
}

async function callGeminiWithRetry(parts: Part[]): Promise<GenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
        } catch (error) {
            console.error(`Error calling Gemini API (Attempt ${attempt}/${maxRetries}):`, error);

            // Log request details on any failure for better debugging.
            console.error("Gemini API call failed. Request details (sensitive data omitted):");
            try {
                const requestDetails = {
                    model: 'gemini-2.5-flash-image-preview',
                    numberOfParts: parts.length,
                    partTypes: parts.map(p => {
                        if ('text' in p && p.text) return 'text';
                        if ('inlineData' in p && p.inlineData) return `inlineData (${p.inlineData.mimeType})`;
                        return 'unknown';
                    }),
                    promptTextLength: parts.find(p => 'text' in p && p.text)?.text.length,
                };
                console.error(JSON.stringify(requestDetails, null, 2));
            } catch (e) {
                console.error("Could not serialize request details for logging.");
            }
            
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isInternalError = errorMessage.includes('"code":500') || errorMessage.includes('INTERNAL');

            if (isInternalError && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`Internal error detected. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error(i18n.t('error.gemini_api_failed'));
}

interface GenerationOptions {
    description?: string;
    referenceImage?: string;
    referenceDescription?: string;
    modification?: string;
    useMasking?: boolean;
    hairColor?: string;
}


/**
 * Generates hairstyle suggestions based on user input.
 * @param query The user's typed input.
 * @returns A promise that resolves to an array of suggestion strings.
 */
export async function getHairstyleSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) {
        return [];
    }

    const prompt = `
You are a creative hair stylist's assistant. Based on the user's input, generate 5 diverse and trending hairstyle suggestions that expand on their idea.
Keep the suggestions concise and inspiring (e.g., "Vintage Hollywood Waves", "Cyberpunk Neon Undercut", "Sun-Kissed Beachy Bob").
Do not repeat the user's exact input.

User's input: "${query}"

Return ONLY a JSON array of 5 string suggestions.
`.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: 'A hairstyle suggestion'
                    }
                },
                temperature: 0.8,
            },
        });
        
        const jsonStr = response.text.trim();
        const suggestions = JSON.parse(jsonStr);

        if (Array.isArray(suggestions) && suggestions.every(s => typeof s === 'string')) {
            return suggestions;
        }
        
        console.error("Parsed suggestions are not in the expected format:", suggestions);
        return [];

    } catch (error) {
        console.error("Failed to get hairstyle suggestions:", error);
        return [];
    }
}


/**
 * Generates a single 2x2 grid image containing four views of the hairstyle.
 * @param baseImage The original user-provided image.
 * @param options An object containing generation options.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated 2x2 grid image.
 */
export async function generateFourUpImage(
    baseImage: { dataUrl: string },
    options: GenerationOptions
): Promise<string> {
    
    const parts: Part[] = [];
    let hairstyleInstructions = '';

    // Resize and add the base user photo
    const resizedBaseImage = await resizeImageForApi(baseImage.dataUrl);
    parts.push(dataUrlToPart(resizedBaseImage));

    // Hairstyle Source Logic
    if (!options.description?.trim() && !options.referenceImage && options.hairColor) {
        // Case 1: Only a color is provided.
        hairstyleInstructions = `Dye the person's current hair to this exact color: ${options.hairColor}. The hairstyle, length, and texture MUST NOT be changed. Only change the hair color.`;
    } else {
        // Case 2 & 3: Reference image or text description is provided.
        if (options.referenceImage) {
            const resizedReferenceImage = await resizeImageForApi(options.referenceImage);
            parts.push(dataUrlToPart(resizedReferenceImage));
            hairstyleInstructions = `Apply the hairstyle from the second image provided.`;
            if (options.referenceDescription?.trim()) {
                hairstyleInstructions += ` It is described as: "${options.referenceDescription.trim()}".`;
            }
            if (options.modification?.trim()) {
                hairstyleInstructions += ` Apply this modification: "${options.modification.trim()}".`;
            }
        } else if (options.description?.trim()) {
            hairstyleInstructions = `The hairstyle should be: "${options.description.trim()}".`;
        } else {
            throw new Error(i18n.t('error.no_input'));
        }
        
        // Append color if it exists, for cases 2 & 3.
        if (options.hairColor) {
            hairstyleInstructions += ` The final hair color MUST be exactly this hex code: ${options.hairColor}.`;
        }
    }

    const finalPrompt = `
Task: Edit the person in the first provided image to give them a new hairstyle.

Hairstyle Details:
${hairstyleInstructions}

Output Requirements:
Produce a single, high-quality image that showcases the new hairstyle from four distinct angles, arranged in a 2x2 layout. The background must be a simple, consistent studio setting for all views.

Views to include:
- Top-Left: Front view. The face must be an exact match to the original image.
- Top-Right: Left Side profile (a 90-degree turn from the front).
- Bottom-Left: Right Diagonal profile (a 45-degree turn from the front).
- Bottom-Right: Back view.

Critical Rules:
- Identity Preservation: The person's facial identity must be perfectly preserved in the front view.
- Consistency: The hairstyle, hair color, lighting, and background must be uniform across all four views.
- The final output must be a single image file without any borders, text, or watermarks. Do not include hands or shoulders.
    `.trim();
    
    parts.push({ text: finalPrompt });
    
    try {
        console.log(`Attempting to generate 4-up grid with prompt length: ${finalPrompt.length}`);
        const response = await callGeminiWithRetry(parts);
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`An unrecoverable error occurred during 4-up image generation.`, error);
        throw new Error(i18n.t('error.four_up_generation_failed', { errorMessage }));
    }
}


const progressMessages = [
    "progress.vision",
    "progress.camera",
    "progress.geometry",
    "progress.follicles",
    "progress.right_profile",
    "progress.back_view",
    "progress.left_profile",
    "progress.stitching",
    "progress.lighting",
    "progress.finalizing"
];


/**
 * Generates a 360-degree video of a hairstyle on a person.
 * @param hairstyleImage The AI-generated 'front' view image.
 * @param hairstyleDescription The text description of the desired hairstyle.
 * @param onProgress A callback function to report progress updates.
 * @returns A promise that resolves to the URL of the generated video.
 */
export async function generateHairstyleVideo(
    hairstyleImage: { dataUrl: string },
    hairstyleDescription: string,
    onProgress: (message: string) => void
): Promise<string> {
    const prompt = `
Create a seamless, photorealistic, 360-degree turntable video of the person in the provided image.

The new hairstyle is: "${hairstyleDescription}".

Cost & Quality Optimization:
- Duration: The video must be a quick, smooth rotation, approximately 3-4 seconds long.
- Resolution: Render at a high-quality standard definition (720p) for optimal web playback and cost.

Core Requirements:
- The rotation must start and end at the front-facing view.
- The person's facial identity from the source image must be perfectly preserved.
- The hairstyle must be rendered consistently from all angles.
- The final video must be a square (1:1 aspect ratio) and framed as a "head and shoulders" portrait.
- The background must be a simple, clean, out-of-focus studio setting.
- Do not crop any part of the head or hair.
`.trim();

    const resizedHairstyleImage = await resizeImageForApi(hairstyleImage.dataUrl);
    const match = resizedHairstyleImage.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error(i18n.t('error.invalid_data_url'));
    }
    const [, mimeType, data] = match;

    let operation: GenerateVideosOperation;
    try {
        onProgress(i18n.t(progressMessages[0]));
        console.log("Attempting to generate video with prompt:", prompt);
        operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: {
                imageBytes: data,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1
            }
        });
    } catch (error) {
        console.error("Failed to start video generation. Prompt used:", prompt, "Error:", error);
        throw new Error(i18n.t('error.video_initialization_failed'));
    }

    let progressIndex = 1;
    while (!operation.done) {
        onProgress(i18n.t(progressMessages[progressIndex % progressMessages.length]));
        progressIndex++;
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        try {
            operation = await ai.operations.getVideosOperation({ operation: operation });
        } catch (error) {
            console.error("Error while polling for video status:", error);
            throw new Error(i18n.t('error.video_status_check_failed'));
        }
    }

    if (operation.error) {
        console.error("Video generation operation failed. Prompt used:", prompt, "Error details:", operation.error);
        throw new Error(i18n.t('error.video_generation_failed', { code: operation.error.code, message: operation.error.message }));
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        console.error("Video generation finished but returned no URL. Prompt used:", prompt, "Final Operation State:", operation);
        throw new Error(i18n.t('error.no_video_url'));
    }

    onProgress(i18n.t('progress.downloading_video'));
    
    try {
        const response = await fetch(`${downloadLink}&key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(i18n.t('error.video_download_failed', { status: response.status }));
        }
        const blob = await response.blob();
        return URL.createObjectURL(blob); // More efficient way to handle video data

    } catch (error) {
        console.error("Failed to download or process video:", error);
        throw new Error(i18n.t('error.video_processing_failed'));
    }
}