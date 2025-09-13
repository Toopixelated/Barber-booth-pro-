/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as tf from '@tensorflow/tfjs';
import Upscaler from 'upscaler';

// This holds our singleton instance
let upscalerInstance: InstanceType<typeof Upscaler> | null = null;
let modelScale = 2; // Default fallback scale

// This function manages the singleton instance of the upscaler
export const getUpscaler = async (): Promise<{ instance: InstanceType<typeof Upscaler>; scale: number }> => {
    // If the instance already exists, return it
    if (upscalerInstance) {
        return { instance: upscalerInstance, scale: modelScale };
    }

    try {
        // Explicitly set the backend to WebGL for GPU acceleration.
        await tf.setBackend('webgl');
        // Wait for the backend to be ready
        await tf.ready();
        console.log('TensorFlow.js backend set to WebGL.');
    } catch (error) {
        console.warn('WebGL backend for TensorFlow.js not available, falling back to CPU.', error);
        // Fallback to CPU if WebGL is not available
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('TensorFlow.js backend set to CPU.');
    }

    try {
        // Define the model configuration directly, pointing to the correct model.json URL.
        const model = {
            path: 'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/models/x4/model.json',
            scale: 4,
        };
        modelScale = 4; // This model is 4x

        // Create a new Upscaler instance with the loaded model and TF.js backend
        upscalerInstance = new Upscaler({ model });
        console.log(`Upscaler.js initialized with ${modelScale}x ESRGAN-Slim model.`);

    } catch (modelError) {
        console.error('Failed to load ESRGAN-Slim model, falling back to default 2x model.', modelError);
        // If the dynamic import fails, fall back to the default built-in model
        modelScale = 2;
        upscalerInstance = new Upscaler();
        console.log('Upscaler.js initialized with default 2x model.');
    }

    return { instance: upscalerInstance, scale: modelScale };
};
