/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { GenerateContentResponse, Part, GenerateVideosOperation } from "@google/genai";
import type { Angle } from "../App";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Helper Functions ---

function dataUrlToPart(dataUrl: string): Part {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error("Invalid data URL format. Expected 'data:image/...;base64,...'");
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
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

async function callGeminiWithRetry(parts: Part[]): Promise<GenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
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
    throw new Error("Gemini API call failed after all retries.");
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

    // First image is always the base user photo
    parts.push(dataUrlToPart(baseImage.dataUrl));

    // Hairstyle Source
    if (options.referenceImage) {
        parts.push(dataUrlToPart(options.referenceImage));
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
        throw new Error("Either a hairstyle description or a reference image must be provided.");
    }
    
    if (options.hairColor) {
        hairstyleInstructions += ` The final hair color MUST be exactly this hex code: ${options.hairColor}.`;
    }

    const finalPrompt = `
Task: Edit the person in the first provided image to give them a new hairstyle.

Hairstyle Details:
${hairstyleInstructions}

Output Requirements:
Generate a single, seamless 2x2 grid image showing the person with their new hairstyle from four different angles. The background should be a simple, consistent studio setting.

Grid Composition:
- Top-Left: Front view (must match the original face perfectly).
- Top-Right: Left Side profile (a 90-degree turn. From the camera's perspective, the subject's nose should be facing towards the left side of the screen).
- Bottom-Left: Right Diagonal profile (a 45-degree turn. From the camera's perspective, the subject's nose should be facing towards the right side of the screen, ensuring it's a distinct view from the left profile).
- Bottom-Right: Back view.

Critical Rules:
- Identity Preservation: The person's face must be an exact match to the original image.
- Consistency: The hairstyle, lighting, and background must be uniform across all four views.
- No Extras: Do not add borders, text, or watermarks. Do not include hands or shoulders.
    `.trim();
    
    parts.push({ text: finalPrompt });
    
    try {
        console.log(`Attempting to generate 4-up grid with prompt length: ${finalPrompt.length}`);
        const response = await callGeminiWithRetry(parts);
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`An unrecoverable error occurred during 4-up image generation.`, error);
        throw new Error(`The AI model failed to generate the 4-up grid. Details: ${errorMessage}`);
    }
}


const progressMessages = [
    "Briefing the AI stylist on your vision...",
    "Calibrating the virtual camera rig...",
    "Mapping your facial geometry in 3D...",
    "Simulating hair follicles strand by strand...",
    "Rendering the right profile view...",
    "Generating the view from the back...",
    "Painting in the left profile...",
    "Stitching the orbital path together...",
    "Applying cinematic lighting and color grade...",
    "Finalizing the 360° masterpiece..."
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

    const match = hairstyleImage.dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error("Invalid hairstyle image data URL format.");
    }
    const [, mimeType, data] = match;

    let operation: GenerateVideosOperation;
    try {
        onProgress(progressMessages[0]);
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
        throw new Error("The AI model failed to initialize the video generation process.");
    }

    let progressIndex = 1;
    while (!operation.done) {
        onProgress(progressMessages[progressIndex % progressMessages.length]);
        progressIndex++;
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        try {
            operation = await ai.operations.getVideosOperation({ operation: operation });
        } catch (error) {
            console.error("Error while polling for video status:", error);
            throw new Error("There was a problem checking the status of your video generation.");
        }
    }

    if (operation.error) {
        console.error("Video generation operation failed. Prompt used:", prompt, "Error details:", operation.error);
        throw new Error(`The video generation failed with code ${operation.error.code}: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        console.error("Video generation finished but returned no URL. Prompt used:", prompt, "Final Operation State:", operation);
        throw new Error("The AI model finished but did not provide a video URL.");
    }

    onProgress("Downloading final video...");
    
    try {
        const response = await fetch(`${downloadLink}&key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`Failed to download video file. Status: ${response.status}`);
        }
        const blob = await response.blob();
        return URL.createObjectURL(blob); // More efficient way to handle video data

    } catch (error) {
        console.error("Failed to download or process video:", error);
        throw new Error("There was an error retrieving the final video file.");
    }
}