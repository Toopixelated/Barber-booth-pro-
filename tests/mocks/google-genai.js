const mockGenerateContent = jest.fn();
const GoogleGenAI = jest.fn().mockImplementation(() => ({
  models: {
    generateContent: mockGenerateContent,
  },
}));
module.exports = {
    GoogleGenAI,
    mockGenerateContent,
    Type: {
        ARRAY: 'ARRAY',
        STRING: 'STRING',
    },
    Modality: {
        IMAGE: 'IMAGE',
        TEXT: 'TEXT',
    }
};
