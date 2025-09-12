
# Barber-Booth: Developer README

Welcome to the Barber-Booth developer documentation. This document provides a comprehensive overview of the application's architecture, core logic, AI services, and guidelines for modification. It is intended for developers and AI assistants to understand the codebase fully.

## 1. Project Overview

Barber-Booth is a web application that uses generative AI to provide users with a 360-degree preview of a new hairstyle. Users upload a front-facing photo of themselves, describe a hairstyle (or provide a reference image), and the application generates four images of them with that hairstyle from different angles (front, left, right, back). It can also generate a short 360° "turntable" video of the final look.

### Core Features:

*   **Image Upload & Editing:** Users can upload a photo from their device or take one with their camera. An integrated editor allows for cropping and rotation.
*   **AI Hairstyle Generation:** Leverages the Gemini API to apply a new hairstyle based on a text description or a reference image.
*   **360° View:** Generates images from four key angles for a complete preview.
*   **Contextual Consistency:** Previously generated images are used as context to ensure consistency in subsequent generations.
*   **Video Generation:** Creates a 360° "turntable" video preview of the final hairstyle using the Veo model.
*   **Generation History:** User sessions are saved to local storage, allowing them to review and restore previous looks.
*   **Undo/Redo:** Allows undoing and redoing individual angle regenerations within a session.
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
│   ├── albumUtils.ts           # Utility functions for image manipulation (creating a 4-up sheet, compressing images).
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
*   `undoStacks`, `redoStacks`: Records of previous states for each `PolaroidCard`, enabling undo/redo functionality for regenerations.

### Data Flow & User Journey

1.  **Upload:** A user clicks the initial Polaroid card (`appState: 'idle'`). This triggers `handleOpenUploadOptions`.
2.  **Edit:** After a file is selected or a photo is taken, the `ImageEditor` component is shown. Upon saving (`handleEditorSave`), the cropped image is stored in `uploadedImage`, and the state transitions to `appState: 'image-uploaded'`.
3.  **Describe:** The user provides a text description or uploads a reference image for the hairstyle.
4.  **Generate:** The user clicks "Generate". This calls `runGenerationSequence`.
    *   `appState` becomes `'generating-results'`.
    *   The `generatedImages` state is initialized with all angles set to `'pending'`.
    *   The function iterates through the `ANGLES` array (`['front', 'left', 'right', 'back']`).
    *   In each iteration, it calls `generateAngleImage` from `geminiService.ts`.
    *   Crucially, it passes an array of *already successful* generations as context to the next call, ensuring consistency.
    *   As each image is returned, the `generatedImages` state is updated for that specific angle, causing the corresponding `PolaroidCard` to re-render.
5.  **Display & Interact:** The results are shown in `PolaroidCard` components. Users can drag them around, regenerate individual angles, or download them.
6.  **Video (Optional):** If the user clicks "Bring to Life ✨", `handleGenerateVideoClick` is called, which invokes the `generateHairstyleVideo` service function. The `VideoPreview` component displays the progress and final result.
7.  **History:** Upon completion of a successful generation sequence, `saveToHistory` is called, which compresses the images and saves the entire session to local storage.

---

## 4. AI Service (`geminiService.ts`)

This file is the most critical part of the application's backend logic. It contains all the prompt engineering and API communication code.

### `generateAngleImage`

This is the workhorse function for image generation. Its primary responsibility is to construct a highly detailed and specific prompt for the Gemini `gemini-2.5-flash-image-preview` model.

**Prompt Construction:**

The prompt is dynamically built based on the inputs. It uses a clear "ASSET KEY" system to define the role of each image provided to the model.

1.  **ASSET 1 (SOURCE PERSON):** The user's uploaded photo. This is defined as the absolute source of truth for the person's identity.
2.  **CONTEXT Assets:** Any previously generated images from other angles. These are used to maintain hairstyle and lighting consistency.
3.  **HAIRSTYLE REFERENCE Asset:** If the user uploaded a reference image, it's included here.

The prompt text then gives the model a series of critical instructions:
*   **Preserve Identity & Refine:** This is the most important rule. It instructs the model to perfectly replicate the face from ASSET 1. It also includes a clever instruction for a "subtle slimming effect" to counteract a common generative model artifact where faces can appear slightly wider.
*   **Hairstyle Source:** It explicitly tells the model to ONLY use the hairstyle from the reference image and to IGNORE the face of the person in that image.
*   **Output Angle:** It uses the `getAngleDescription` helper to provide precise instructions on how the person should be posed for the target angle (e.g., for 'left', it specifies a 45-degree turn and that the right eye should not be visible).
*   **Masking Mode:** If `useMasking` is true (an option when using a reference image), a completely different, more precise prompt is used. This prompt instructs the model to perform a "masked image modification," replacing *only* the hair and defining the rest of the image as a "PROTECTED REGION." This leads to higher fidelity results.

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
*   **Styling:** All styling is done with Tailwind CSS. The `cn` utility from `lib/utils.ts` is used to merge classes conditionally. Shared class strings (e.g., `primaryButtonClasses`) are defined at the top of `App.tsx` for consistency.

### Changing AI Behavior (Prompt Engineering)

Almost all AI behavior can be modified by editing the prompts in `services/geminiService.ts`.

*   **To change the background of generated images:** Modify the "Final Image" instruction in the `generateAngleImage` prompt. For example, change `a simple, out-of-focus background` to `an outdoor park background`.
*   **To change the art style:** Add instructions to the main prompt in `generateAngleImage`. For example, add `The final image should be in a vibrant, anime-inspired art style.`
*   **To adjust video speed:** Modify the prompt in `generateHairstyleVideo`. For example, change `a slow, smooth, continuous 360-degree horizontal rotation` to `a quick 2-second 360-degree rotation`.
*   **To add a new angle:**
    1.  Add the new angle string (e.g., `'top-down'`) to the `ANGLES` array in `App.tsx`.
    2.  Add a position for it in the `POSITIONS` array in `App.tsx`.
    3.  Add a new case for `'top-down'` in the `getAngleDescription` function in `geminiService.ts` with detailed instructions for that view. The application's generation loop will automatically pick it up.

### Updating Dependencies

The project uses an `importmap` in `index.html` to manage dependencies via `esm.sh`. To update a package, simply change the version number in the import map URL.

---

This comprehensive guide should provide a solid foundation for understanding, maintaining, and extending the Barber-Booth application. When in doubt, trace the data flow from the user interaction in `App.tsx` down to the API call in `geminiService.ts`.
