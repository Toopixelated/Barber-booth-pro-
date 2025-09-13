/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@google/genai$': '<rootDir>/tests/mocks/google-genai.js',
    '^upscaler$': '<rootDir>/node_modules/upscaler/dist/node/upscalerjs/src/node/cjs/index.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
