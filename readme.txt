# Barber-Booth: Developer README

Welcome to the Barber-Booth developer documentation. This document provides a comprehensive overview of the application's architecture, core logic, AI services, and guidelines for modification. It is intended for developers and AI assistants to understand the codebase fully.

## 1. Project Overview

Barber-Booth is a web application that uses generative AI to provide users with a 360-degree preview of a new hairstyle. Users upload a front-facing photo of themselves, describe a hairstyle (or provide a reference image), and the application generates four images of them with that hairstyle from different angles (front, left, right, back). It can also generate a short 360° "turntable" video of the final look.

### Core Features:

*   **Image Upload & Editing:** Users can upload a photo from their device or take one with their camera. An integrated editor allows for cropping and rotation.
*   **AI Hairstyle Generation:** Leverages the Gemini API to apply a new hairstyle based on a text description or a reference image.
*   **360° View:** Generates images from four key angles for a complete preview using a single, efficient API call.
*   **Video Generation:** Creates a 360° "turntable" video preview of the final hairstyle using the Veo model.
*   **Generation History:** User sessions are saved to local storage, allowing them to review and restore previous looks.
*   **AI-Powered Suggestions:** Provides creative hairstyle ideas to inspire the user.

### Technology Stack:

*   **Frontend Framework:** React with TypeScript
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion
*   **AI Services:** Google Gemini API (`gemini-2.5-flash-image-preview` for images, `veo-2.0-generate-001` for video)
*   **Dependencies:** `react-image-crop`, `clsx`, `tailwind-merge`

---

## 2. File Structure

The project is structured as a single-page application with a clear separation of concerns.

```
.
├── components/
│   ├── CameraCapture.tsx       # Fullscreen component for taking photos with the device camera.
│   ├── Footer.tsx              # The application's footer.
│   ├── HistoryPanel.tsx        # Side panel to display and restore past generations.
│   ├── ImageEditor.tsx         # Modal for cropping and rotating uploaded images.
│   ├── PolaroidCard.tsx        # The main UI element for displaying images, their status, and actions.
│   ├── VideoPreview.tsx        # Component for displaying the generated video and its status.
│   └── ui/
│       └── draggable-card.tsx  # Draggable wrapper for the PolaroidCard, providing physics-based interactions.
├── hooks/
│   └── useLocalStorage.ts      # Custom hook for persisting state (e.g., history) to browser localStorage.
├── lib/
│   ├── albumUtils.ts           # Utility functions for image manipulation (creating/cropping a 4-up sheet, compressing images).
│   └── utils.ts                # General utility functions, primarily `cn` for merging Tailwind CSS classes.
├── services/
│   └── geminiService.ts        # The core of the application. Handles all communication with the Gemini API.
├── App.tsx                     # The main application component, managing state and orchestrating all UI and logic.
├── index.html                  # The HTML entry point, includes font links and the import map.
├── index.tsx                   # The React entry point, renders the App component into the DOM.
├── metadata.json               # Application metadata, including permissions for camera access.
└── readme.txt                  # This file.
```

---

## 3. Core Concepts & Logic (`App.tsx`)

`App.tsx` is the central orchestrator of the application. It manages the overall application state, user flow, and interactions between components.

### Application State (`appState`)

The application flow is controlled by the `appState` variable, which can be in one of three states:

1.  `'idle'`: The initial state. The user is prompted to upload a photo.
2.  `'image-uploaded'`: The user has uploaded and cropped their photo. They are now presented with input fields to describe the desired hairstyle.
3.  `'generating-results'`: The generation process has started. The UI transitions to show the four Polaroid cards, which update in real-time as images are generated.

### Key State Variables

*   `uploadedImage`: Stores the user's cropped, base64-encoded photo.
*   `hairstyleDescription`, `hairstyleReferenceImage`, etc.: Store the user's input for the desired hairstyle.
*   `generatedImages`: A `Record<string, GeneratedImage>` that holds the status (`pending`, `done`, `error`), URL, and potential error message for each of the four angles. This state is the single source of truth for the results display.
*   `isGenerating`: A boolean flag that indicates when the main generation sequence is running.
*   `videoStatus`, `videoUrl`: Manage the state and result of the video generation process.
*   `generationHistory`: An array of `HistoryItem` objects, persisted to local storage via the `useLocalStorage` hook.

### Data Flow & User Journey

1.  **Upload:** A user clicks the initial card (`appState: 'idle'`). This triggers `handleOpenUploadOptions`.
2.  **Edit:** After a file is selected or a photo is taken, the `ImageEditor` component is shown. Upon saving (`handleEditorSave`), the cropped image is stored in `uploadedImage`, and the state transitions to `appState: 'image-uploaded'`.
3.  **Describe:** The user provides a text description or uploads a reference image for the hairstyle.
4.  **Generate:** The user clicks "Generate Pro". This calls `runGenerationSequence`.
    *   `appState` becomes `'generating-results'`.
    *   The function makes a **single, efficient API call** to `generateFourUpImage` in `geminiService.ts`, requesting a complete 2x2 grid image. This method is faster and more cost-effective than generating each angle separately.
    *   Upon receiving the single grid image, the app calls the `cropFourUpSheet` utility from `lib/albumUtils.ts` to slice the image into four separate quadrants on the client-side.
    *   The state is then updated with the four cropped images, and the `PolaroidCard` components render the results simultaneously.
5.  **Display & Interact:** The results are shown in `PolaroidCard` components. Users can drag them around, regenerate individual angles, or download them.
6.  **Video (Optional):** If the user clicks "Bring to Life ✨", `handleGenerateVideoClick` is called, which invokes the `generateHairstyleVideo` service function. The `VideoPreview` component displays the progress and final result.
7.  **History:** Upon completion of a successful generation sequence, `saveToHistory` is called, which compresses the images and saves the entire session to local storage.

---

## 4. AI Service (`geminiService.ts`)

This file is the most critical part of the application's backend logic. It contains all the prompt engineering and API communication code.

### `generateFourUpImage`

This is the core function for image generation, optimized for speed and cost. Its primary responsibility is to construct a highly efficient and specific prompt for the Gemini `gemini-2.5-flash-image-preview` model to generate a single 2x2 grid containing all four required angles.

**Prompt Construction:**

The prompt is dynamically built based on best practices for image generation models to be direct, concise, and unambiguous.
*   **Direct Commands:** It uses a clear, imperative style (e.g., "Create a single...") rather than a conversational persona.
*   **Asset Definitions:** A clear "ASSET" key defines the role of the user's photo and the optional hairstyle reference image.
*   **Mandatory Rules:** Core instructions strictly command the model to preserve the user's identity, maintain hairstyle consistency across all four views, and ensure a high-quality, photorealistic output.
*   **Negative Prompt:** A "NEGATIVE PROMPT" section is included to explicitly instruct the model on what to avoid, such as borders, text, or facial distortion. This significantly improves the reliability and quality of the output.
*   This single-call approach ensures that all angles are generated within the same context, leading to superior consistency in lighting, color, and style compared to separate generation calls.

### `generateHairstyleVideo`

This function calls the `veo-2.0-generate-001` model.

**Prompt Engineering:**

The prompt is designed to create a "turntable" video.
*   It establishes the generated "front" view image as the source of truth for identity and hairstyle.
*   It describes the exact camera movement: a slow, smooth 360-degree horizontal rotation.
*   It reiterates the identity preservation and refinement rules.
*   It instructs the model to intelligently "in-paint" the sides and back of the hair.
*   It contains a **CRITICAL FRAMING RULE** to *not crop the head*, ensuring there is sufficient "headroom" in the video. This is crucial for a professional-looking result.

**Polling Mechanism:**

Video generation is an asynchronous operation. The function initiates the process with `ai.models.generateVideos`. It then enters a `while` loop, polling the `ai.operations.getVideosOperation` endpoint every 10 seconds until the operation is `done`. Progress messages are sent back to the UI during this time.

### `getHairstyleSuggestions`

This function provides AI-powered ideas. It calls the `gemini-2.5-flash` model with a prompt asking it to act as a stylist's assistant. It uses `responseMimeType: "application/json"` and a `responseSchema` to ensure the model returns a clean JSON array of strings, which is then parsed and sent to the UI.

---

## 5. How to Modify the Application

### Changing UI and Styles

*   **Layout & Components:** Most UI elements are located in the `components/` directory. For example, to change the action buttons on the image cards, edit `PolaroidCard.tsx`. To change the overall layout of the results screen, modify the JSX in the `'generating-results'` block within `App.tsx`.
*   **Styling:** All styling is done with Tailwind CSS. The `cn` utility from `lib/utils.ts` is used to merge classes conditionally.

### Changing AI Behavior (Prompt Engineering)

Almost all AI behavior can be modified by editing the prompts in `services/geminiService.ts`.

*   **To change the background of generated images:** Modify the "Consistency" rule in the `generateFourUpImage` prompt. For example, change `a simple, out-of-focus background` to `an outdoor park background`.
*   **To change the art style:** Add instructions to the main prompt in `generateFourUpImage`. For example, add `The final image should be in a vibrant, anime-inspired art style.` to the "Quality" rule.
*   **To adjust video speed:** Modify the prompt in `generateHairstyleVideo`. For example, change `a slow, smooth, continuous 360-degree horizontal rotation` to `a quick 2-second 360-degree rotation`.

### Updating Dependencies

The project uses an `importmap` in `index.html` to manage dependencies via `esm.sh`. To update a package, simply change the version number in the import map URL.

---

This comprehensive guide should provide a solid foundation for understanding, maintaining, and extending the Barber-Booth application. When in doubt, trace the data flow from the user interaction in `App.tsx` down to the API call in `geminiService.ts`.