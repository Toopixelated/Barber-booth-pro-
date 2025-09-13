import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generateFourUpImage, getHairstyleSuggestions } from '../services/geminiService';
import { mockGenerateContent } from '@google/genai';

// Mock the dependencies
jest.mock('../lib/albumUtils', () => ({
  resizeImageForApi: jest.fn(dataUrl => Promise.resolve(dataUrl)),
}));

describe('geminiService', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockGenerateContent.mockClear();
  });

  describe('generateFourUpImage', () => {
    const baseImage = { dataUrl: 'data:image/png;base64,base' };
    const referenceImage = 'data:image/png;base64,ref';

    it('should construct the prompt correctly with description and color', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'test-data' } }] } }],
      });

      await generateFourUpImage(baseImage, { description: 'a new style', hairColor: '#FF0000' });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const calledWith = mockGenerateContent.mock.calls[0][0];
      const promptText = calledWith.contents.parts.find((p: any) => p.text).text;

      expect(promptText).toContain('The hairstyle should be: "a new style"');
      expect(promptText).toContain('The final hair color MUST be exactly this hex code: #FF0000');
      expect(promptText).toContain('2x2 layout');
    });

    it('should construct the prompt correctly with only a hair color', async () => {
        mockGenerateContent.mockResolvedValue({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'test-data' } }] } }],
        });

        await generateFourUpImage(baseImage, { hairColor: '#00FF00' });

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const calledWith = mockGenerateContent.mock.calls[0][0];
        const promptText = calledWith.contents.parts.find((p: any) => p.text).text;

        expect(promptText).toContain("Dye the person's current hair to this exact color: #00FF00");
        expect(promptText).toContain("The hairstyle, length, and texture MUST NOT be changed");
      });

    it('should construct the prompt correctly with a reference image and modification', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'test-data' } }] } }],
      });

      await generateFourUpImage(baseImage, { referenceImage, referenceDescription: 'ref style', modification: 'make it shorter' });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const calledWith = mockGenerateContent.mock.calls[0][0];
      const promptText = calledWith.contents.parts.find((p: any) => p.text).text;
      const imageParts = calledWith.contents.parts.filter((p: any) => p.inlineData);

      expect(imageParts).toHaveLength(2); // base image + reference image
      expect(promptText).toContain('Apply the hairstyle from the second image provided');
      expect(promptText).toContain('It is described as: "ref style"');
      expect(promptText).toContain('Apply this modification: "make it shorter"');
    });

    it('should retry up to 3 times on 500 errors', async () => {
      // Fail twice with 500, then succeed
      mockGenerateContent
        .mockRejectedValueOnce(new Error('INTERNAL: "code":500'))
        .mockRejectedValueOnce(new Error('INTERNAL: "code":500'))
        .mockResolvedValue({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'success-data' } }] } }],
        });

      const result = await generateFourUpImage(baseImage, { description: 'test' });

      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
      expect(result).toBe('data:image/png;base64,success-data');
    });

    it('should fail after 3 retries', async () => {
      mockGenerateContent.mockRejectedValue(new Error('INTERNAL: "code":500'));

      await expect(generateFourUpImage(baseImage, { description: 'test' })).rejects.toThrow('The AI model failed to generate the 4-up grid. Details: INTERNAL: "code":500');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-500 errors', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Invalid request'));

      await expect(generateFourUpImage(baseImage, { description: 'test' })).rejects.toThrow('The AI model failed to generate the 4-up grid.');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if API returns text instead of an image', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'Sorry, I cannot fulfill this request.',
        candidates: [{ content: { parts: [{ text: 'Sorry, I cannot fulfill this request.' }] } }],
      });

      await expect(generateFourUpImage(baseImage, { description: 'test' })).rejects.toThrow('The AI model responded with text instead of an image');
    });

    it('should throw an error if no description, reference image, or color is provided', async () => {
      await expect(generateFourUpImage(baseImage, {})).rejects.toThrow('Either a hairstyle description, a reference image, or just a hair color must be provided.');
    });
  });

  describe('getHairstyleSuggestions', () => {
    it('should return an array of strings on success', async () => {
        const suggestions = ['style 1', 'style 2'];
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify(suggestions),
        });

        const result = await getHairstyleSuggestions('long hair');
        expect(result).toEqual(suggestions);
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const calledWith = mockGenerateContent.mock.calls[0][0];
        expect(calledWith.config.responseMimeType).toBe('application/json');
    });

    it('should return an empty array if query is empty', async () => {
        const result = await getHairstyleSuggestions('  ');
        expect(result).toEqual([]);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should return an empty array on API error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API error'));
        const result = await getHairstyleSuggestions('long hair');
        expect(result).toEqual([]);
    });

    it('should return an empty array on malformed JSON response', async () => {
        mockGenerateContent.mockResolvedValue({
            text: 'not a json array',
        });
        const result = await getHairstyleSuggestions('long hair');
        expect(result).toEqual([]);
    });

    it('should return an empty array if the response is not an array of strings', async () => {
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify([1, 2, 3]), // not an array of strings
        });
        const result = await getHairstyleSuggestions('long hair');
        expect(result).toEqual([]);
    });
  });
});
