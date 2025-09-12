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
                contents: [{ parts }],
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                }
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
    const assetKeyLines: string[] = [];
    let hairstyleInstructions = '';

    // ASSET 1: Base Image
    parts.push(dataUrlToPart(baseImage.dataUrl));
    assetKeyLines.push(`- ASSET 1: The user's original photo. This is the source for the person's identity.`);

    // Hairstyle Source
    let hairstyleReferenceKey = '';
    if (options.referenceImage) {
        parts.push(dataUrlToPart(options.referenceImage));
        hairstyleReferenceKey = `ASSET ${parts.length}`;
        assetKeyLines.push(`- ${hairstyleReferenceKey}: An image showing the target hairstyle.`);

        hairstyleInstructions = `Apply the hairstyle from ${hairstyleReferenceKey}.`;
        if (options.referenceDescription?.trim()) {
            hairstyleInstructions += ` Description: "${options.referenceDescription.trim()}".`;
        }
        if (options.modification?.trim()) {
            hairstyleInstructions += ` Modification: "${options.modification.trim()}".`;
        }
    } else if (options.description?.trim()) {
        hairstyleInstructions = `The hairstyle should be: "${options.description.trim()}".`;
    } else {
        throw new Error("Either a hairstyle description or a reference image must be provided.");
    }
    
    if (options.hairColor) {
        hairstyleInstructions += `\n- The final hair color MUST be exactly this hex code: ${options.hairColor}.`;
    }

    const finalPrompt = `
**PRIMARY GOAL:** Create a single, seamless 2x2 grid image of the person from ASSET 1 with a new hairstyle.

**SUBJECT:** The person from ASSET 1.

**HAIRSTYLE INSTRUCTIONS:**
${hairstyleInstructions}

**GRID COMPOSITION:**
- Top-Left: Front view.
- Top-Right: Left side profile. A perfect 90-degree turn showing the subject's complete left side.
- Bottom-Left: Right three-quarter profile. A 45-degree turn showing the right side of the subject's face and head. **IMPORTANT: This view MUST be the mirror opposite of the top-right profile.**
- Bottom-Right: A direct view of the back of the head.

**MANDATORY RULES:**
1.  **Identity Preservation:** The subject's face MUST be an exact match to ASSET 1 in all views where it's visible. The lighting on the face must be consistent with the overall scene lighting.
2.  **Consistency:** The hairstyle, hair color, lighting, and a simple studio background MUST be perfectly uniform across all four views. The front and back views must be rendered under the exact same lighting conditions and against the same background as the side profiles.
3.  **Quality:** The output must be photorealistic.

**NEGATIVE PROMPT (AVOID THESE):**
- DO NOT add borders, lines, or spacing between grid images.
- DO NOT add text, labels, or watermarks.
- DO NOT distort facial features.
- DO NOT change the subject's ethnicity, gender, or apparent age.
- DO NOT include hands, shoulders, or any objects. Focus on the head and hairstyle.

**ASSET DEFINITIONS:**
${assetKeyLines.join('\n')}
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
You are an expert video generation AI specializing in photorealistic human portraits. Your task is to create a seamless 360-degree "turntable" video of a person with a new hairstyle, based on a provided source image.

**Source Image & Hairstyle:**
The input image shows the person from a direct front-facing view with their new hairstyle, which is described as: "${hairstyleDescription}". This front view is the PRIMARY source of truth for the person's identity and the hairstyle's appearance.

**Video Objective & Camera Work:**
-   **Movement:** Create a slow, smooth, continuous 360-degree horizontal rotation of the person's head. The movement should be a perfect "orbit" effect, as if the camera is circling the person.
-   **Sequence:** The video MUST start with the person facing the camera (matching the source image perfectly). It should then rotate smoothly to show their right profile, the back of their head, their left profile, and finally return seamlessly to the starting front view.
-   **Camera Angle:** Maintain a consistent eye-level or slightly elevated "portrait studio" camera angle throughout the rotation. Avoid any tilting, zooming, or shaky camera motion.

**Critical Requirements:**
1.  **Identity Preservation & Refinement:** The person's face, facial features, skin tone, and head shape MUST remain identical to the source image throughout the entire video. To account for potential AI distortion that can widen features, render the person's face and jawline with a very subtle slimming effect. The result should look natural and flattering, while remaining true to the person's identity. This is the most important rule.
2.  **Hairstyle Consistency & In-painting:**
    -   The hairstyle from the source image must be rendered realistically from all angles.
    -   You must intelligently "in-paint" or generate the sides and back of the hairstyle. The generated sides and back must be a logical and seamless continuation of the front view's style, length, color, and texture. For example, if the front shows a sharp fade, the back must also have a convincing fade. If it's long and curly, the back must reflect that volume and curl pattern.
3.  **Photorealism:** The final video must be indistinguishable from a real-world, high-quality studio video recording. Pay close attention to how light interacts with the hair from different angles.
4.  **Setting:** The background must be a clean, simple, out-of-focus studio or barbershop environment, consistent with the source image.
5.  **CRITICAL FRAMING AND COMPOSITION RULE: DO NOT CROP THE HEAD.**
    -   This is the most important artistic instruction. The framing must be a **"medium long shot" (also known as a "plan américain" or "cowboy shot")**, capturing the person from roughly the knees up. The overall feeling should be zoomed out, not a tight portrait.
    -   **ABSOLUTE REQUIREMENT FOR HEADROOM:** There MUST be a very large amount of empty space above the person's head. The highest point of the hair must not, under any circumstances, come close to the top edge of the video frame.
    -   **VERTICAL COMPOSITION:** To ensure proper headroom, the person's entire head (from chin to the top of the hair) should occupy **no more than 25%** of the total vertical height of the frame.
    -   **ZERO CROPPING TOLERANCE:** At no point during the 360-degree rotation should any part of the hair or head be cropped or exit the frame. This rule is absolute and must be followed precisely to accommodate hairstyles with significant volume. A failure to adhere to this headroom rule will ruin the video.
    -   **CENTERED SUBJECT:** The person must remain perfectly centered horizontally in the frame for the entire duration of the video.

**Output Requirements:**
- A single, perfectly looping, high-quality video file.
- Rendered at the highest possible resolution (ideally HD 1080p or higher).
- Sharp, clear, and free of compression artifacts.
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