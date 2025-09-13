import { http, HttpResponse } from 'msw';

// A base64 encoded 1x1 transparent PNG
const MOCK_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const handlers = [
  // Intercept the "generateContent" endpoint
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent', () => {
    // Respond with a mock success response
    return HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: MOCK_IMAGE_DATA_URL.split(',')[1], // Return only the base64 part
                },
              },
            ],
            role: 'model',
          },
        },
      ],
    });
  }),
];
