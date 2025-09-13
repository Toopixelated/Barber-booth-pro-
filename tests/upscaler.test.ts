/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// We will import these dynamically inside tests
// import * as tf from '@tensorflow/tfjs';
// import Upscaler from 'upscaler';
// import { getUpscaler } from '../lib/upscaler';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  setBackend: jest.fn().mockResolvedValue(undefined),
  ready: jest.fn().mockResolvedValue(undefined),
}));

// Mock Upscaler
jest.mock('upscaler', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    return {
      // We don't need to mock any methods for these tests
    };
  }),
}));

// Mock the dynamic import for the ESRGAN-Slim model
jest.mock('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/4x/+esm', () => ({
  __esModule: true, // This is important for ES modules
  default: jest.fn(),
}), { virtual: true });


describe('getUpscaler', () => {
  let getUpscaler: any;
  let tf: any;
  let Upscaler: any;

  beforeEach(async () => {
    // Reset modules before each test to ensure isolation
    jest.resetModules();
    // Re-import modules to get fresh mocks
    const upscalerModule = await import('../lib/upscaler');
    getUpscaler = upscalerModule.getUpscaler;
    tf = await import('@tensorflow/tfjs');
    Upscaler = (await import('upscaler')).default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with WebGL backend and ESRGAN-Slim model on first call', async () => {
    const { instance, scale } = await getUpscaler();

    expect(tf.setBackend).toHaveBeenCalledWith('webgl');
    expect(tf.ready).toHaveBeenCalledTimes(1);
    expect(Upscaler).toHaveBeenCalledWith({ model: expect.any(Function) });
    expect(scale).toBe(4);
    expect(instance).toBeTruthy();
  });

  it('should return the same instance on subsequent calls (singleton pattern)', async () => {
    const { instance: instance1 } = await getUpscaler();
    const { instance: instance2 } = await getUpscaler();

    expect(instance1).toBe(instance2);
    // Ensure initialization logic is not called again
    expect(tf.setBackend).toHaveBeenCalledTimes(1);
  });

  it('should fall back to CPU backend if WebGL initialization fails', async () => {
    // Simulate WebGL failure
    (tf.setBackend as jest.Mock).mockImplementationOnce(async (backend: string) => {
      if (backend === 'webgl') {
        throw new Error('WebGL not available');
      }
      return Promise.resolve();
    });

    const { instance, scale } = await getUpscaler();

    expect(tf.setBackend).toHaveBeenCalledWith('webgl');
    expect(tf.setBackend).toHaveBeenCalledWith('cpu');
    expect(tf.ready).toHaveBeenCalledTimes(1); // Once for CPU after WebGL failed
    expect(scale).toBe(4); // Should still load the 4x model
    expect(instance).toBeTruthy();
  });

  it('should fall back to the default 2x model if the ESRGAN-Slim model fails to load', async () => {
    // To test this, we need to reset modules and change the mock behavior for dynamic import
    jest.resetModules();
    jest.mock('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/4x/+esm', () => {
        throw new Error("Failed to load model");
    }, { virtual: true });

    const upscalerModule = await import('../lib/upscaler');
    const tf = await import('@tensorflow/tfjs');
    const Upscaler = (await import('upscaler')).default;
    const { instance, scale } = await upscalerModule.getUpscaler();

    expect(Upscaler).toHaveBeenCalledWith(); // Default constructor
    expect(scale).toBe(2);
    expect(instance).toBeTruthy();
  });

  it('should handle both WebGL and model loading failures gracefully', async () => {
    jest.resetModules();
    // Simulate WebGL failure
    jest.mock('@tensorflow/tfjs', () => ({
      setBackend: jest.fn().mockImplementation(async (backend: string) => {
        if (backend === 'webgl') {
          throw new Error('WebGL not available');
        }
      }),
      ready: jest.fn().mockResolvedValue(undefined),
    }));

    // Simulate model loading failure
    jest.mock('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/4x/+esm', () => {
        throw new Error("Failed to load model");
    }, { virtual: true });

    const upscalerModule = await import('../lib/upscaler');
    const tf = await import('@tensorflow/tfjs');
    const Upscaler = (await import('upscaler')).default;
    const { instance, scale } = await upscalerModule.getUpscaler();

    expect(tf.setBackend).toHaveBeenCalledWith('webgl');
    expect(tf.setBackend).toHaveBeenCalledWith('cpu');
    expect(Upscaler).toHaveBeenCalledWith(); // Default constructor
    expect(scale).toBe(2);
    expect(instance).toBeTruthy();
  });
});
