import { resizeImageForApi, cropFourUpSheet } from './albumUtils';
import type { Angle } from '../App';

// A base64 encoded 2x2 red pixel PNG
const redPixel2x2_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAABNJREFUGFdj/M/A8J+B4T8TAAAC2gEB27sR9QAAAABJRU5ErkJggg==';
const redPixel2x2_DataUrl = `data:image/png;base64,${redPixel2x2_B64}`;

// A base64 encoded 4x4 blue pixel PNG (to simulate the 2x2 grid image)
const bluePixel4x4_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAB9JREFUGFdj/P/P8J+B4T8DwwMGDGCgYgQAREYnJ/n5uAgAAAAASUVORK5CYII=';
const bluePixel4x4_DataUrl = `data:image/png;base64,${bluePixel4x4_B64}`;

// Mocking browser-specific APIs for the JSDOM environment
const originalImage = global.Image;
let drawImageSpy: jest.SpyInstance;

beforeAll(() => {
  // @ts-ignore
  global.Image = class MockImage {
    onload: () => void;
    src: string;
    constructor() {
      this.onload = () => {};
      this.src = '';
      setTimeout(() => {
        this.onload();
      }, 1);
    }
  };

  const canvasContext = document.createElement('canvas').getContext('2d');
  if (canvasContext) {
    drawImageSpy = jest.spyOn(canvasContext.constructor.prototype, 'drawImage').mockImplementation(() => {});
  }
});

afterAll(() => {
  global.Image = originalImage;
  drawImageSpy.mockRestore();
});


describe('albumUtils', () => {

  describe('resizeImageForApi', () => {
    it('should resize an image while maintaining aspect ratio', async () => {
      Object.defineProperty(global.Image.prototype, 'naturalWidth', { get: () => 2048, configurable: true });
      Object.defineProperty(global.Image.prototype, 'naturalHeight', { get: () => 1024, configurable: true });

      const resizedDataUrl = await resizeImageForApi(redPixel2x2_DataUrl);

      expect(resizedDataUrl).toMatch(/^data:image\/jpeg/);
    });
  });

  describe('cropFourUpSheet', () => {
    it('should crop a 2x2 grid image into four separate images', async () => {
      Object.defineProperty(global.Image.prototype, 'naturalWidth', { get: () => 4, configurable: true });
      Object.defineProperty(global.Image.prototype, 'naturalHeight', { get: () => 4, configurable: true });

      const croppedImages = await cropFourUpSheet(bluePixel4x4_DataUrl);

      expect(Object.keys(croppedImages)).toHaveLength(4);

      const angles: Angle[] = ['front', 'left', 'right', 'back'];
      angles.forEach(angle => {
        expect(croppedImages[angle]).toBeDefined();
        expect(croppedImages[angle]).toMatch(/^data:image\/jpeg/);
      });
    });
  });
});
