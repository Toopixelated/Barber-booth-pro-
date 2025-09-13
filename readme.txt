# Barber Booth Pro: Developer README

**For a complete, feature-by-feature breakdown of all requirements, user flows, and technical implementation details, please refer to the main Technical Specification Sheet in `designspec.txt`.**

This document provides a high-level overview of the Barber Booth Pro application's architecture, core logic, AI services, and guidelines for modification.

## 1. Project Overview

Barber Booth Pro is a progressive web application (PWA) that uses generative AI to provide users with a photorealistic, 360-degree preview of a new hairstyle. Users upload a front-facing photo, describe a hairstyle (or provide a reference image), and the application generates four images from different angles (front, left, right, back). It can also generate a short 360° "turntable" video of the final look.

### Core Features:

*   **PWA Functionality:** Installable on supported devices for an app-like experience with offline capabilities for the core shell.
*   **Image Upload & Editing:** Users can upload a photo from their device or take one with their camera, which features source switching. An integrated editor allows for cropping and rotation.
*   **AI Hairstyle Generation:** Leverages the Gemini API to apply a new hairstyle based on a text description, a reference image, or just a color.
*   **Robust High-Resolution Downloads:** Uses Upscaler.js with TensorFlow.js to reliably upscale all downloaded images. This system is engineered to handle large images and diverse hardware by managing the GPU/CPU backend, using patch processing, and including model fallbacks.
*   **Multi-Angle View:** Generates images from four key angles for a complete preview using a single, efficient API call.
*   **Video Generation:** Creates a 360° "turntable" video preview of the final hairstyle using the Veo model.
*   **Generation History:** User sessions are saved to local storage, allowing them to review and restore previous looks.
*   **AI-Powered Suggestions:** Provides creative hairstyle ideas to inspire the user based on their text input.

### Technology Stack:

*   **Frontend Framework:** React 19 with TypeScript
*   **State Management:** Zustand (with persistence middleware)
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion
*   **AI Services:** Google Gemini API (`gemini-2.5-flash-image-preview` for images, `veo-2.0-generate-001` for video, `gemini-2.5-flash` for text)
*   **Image Upscaling:** Upscaler.js with TensorFlow.js
*   **UI Components:** Radix UI, React Colorful
*   **Dependencies:** `react-image-crop`, `clsx`, `tailwind-merge`

---

## 2. File Structure

The project is structured as a single-page application with a clear separation of concerns.

```
.
├── components/
│   ├── CameraCapture.tsx       # Fullscreen component for taking photos with the device camera.
│   ├── ColorPicker.tsx         # Pop-over component for selecting a hair color.
│   ├── ComparisonSlider.tsx    # Interactive slider to compare before/after images.
│   ├── Footer.tsx              # The application's footer with PWA install button.
│   ├── HistoryPanel.tsx        # Side panel to display and restore past generations.
│   ├── ImageEditor.tsx         # Modal for cropping and rotating uploaded images.
│   ├── LoadingSpinner.tsx      # Reusable loading spinner component.
│   ├── PolaroidCard.tsx        # The main UI element for displaying generated images and their status.
│   ├── ShareMenu.tsx           # Modal for sharing/downloading generated content.
│   ├── VideoPreview.tsx        # Component for displaying the generated video and its status.
│   └── ui/
│       ├── button.tsx          # Custom Button component with variants.
│       ├── card.tsx            # Custom Card component with gradient border effect.
│       ├── dialog.tsx          # Reusable Dialog (modal) component.
│       └── draggable-card.tsx  # Wrapper for physics-based card dragging.
├── lib/
│   ├── albumUtils.ts           # Utility functions for image manipulation (creating/cropping a 4-up sheet, compressing).
│   ├── shareUtils.ts           # Helper functions for using the Web Share API.
│   ├── upscaler.ts             # Manages a singleton instance of Upscaler.js, explicitly controlling the TensorFlow.js backend (WebGL with CPU fallback) for maximum performance and reliability.
│   └── utils.ts                # General utility functions (`cn` for merging Tailwind CSS classes).
├── services/
│   └── geminiService.ts        # The core of the application. Handles all communication with the Gemini API.
├── App.tsx                     # The main application component, orchestrating all UI and logic.
├── store.ts                    # Zustand store for global state management.
├── index.html                  # The HTML entry point, includes font links and the import map.
├── index.tsx                   # The React entry point, renders the App component into the DOM.
├── manifest.json               # The Web App Manifest for PWA functionality.
├── service-worker.js           # The service worker script for offline capabilities.
├── metadata.json               # Application metadata, including permissions for camera access.
├── designspec.txt              # The comprehensive Technical Specification Sheet for the entire application.
└── readme.txt                  # This file.
```

---

## 3. Core Concepts & Logic

### 3.1. State Management (`store.ts`)

The application uses **Zustand** for centralized state management. This provides a simple, hook-based API for accessing and modifying state from any component without prop drilling. The store is persisted to `localStorage` to save the user's generation history.

*   **State:** The store holds all critical application data, including the uploaded image, hairstyle inputs, generation status, results, video status, and UI state (e.g., `isHistoryPanelOpen`).
*   **Actions:** The store defines actions (e.g., `setUploadedImage`, `startGeneration`, `addToHistory`) that encapsulate state modification logic. Components call these actions to update the global state.

### 3.2. Data Flow & User Journey (`App.tsx`)

1.  **Upload & Edit:** The user provides an image via file upload or camera. The `ImageEditor` modal allows for cropping, and the result is saved to the Zustand store via `setUploadedImage`.
2.  **Describe:** The user provides a text description, a reference image, or just a hair color.
3.  **Generate:** The user clicks "Generate Pro", calling `runGenerationSequence`.
    *   This makes a **single API call** to `generateFourUpImage` in `geminiService.ts`, requesting a complete 2x2 grid image for efficiency.
    *   The returned grid is sliced into four quadrants on the client-side using `cropFourUpSheet` from `lib/albumUtils.ts`.
    *   The four cropped images are saved to the store, and the `PolaroidCard` components render the results.
4.  **Display & Interact:** Results are shown in `PolaroidCard` components. Users can regenerate, share, or download.
5.  **Upscaling (`lib/upscaler.ts`):** High-resolution output is a core feature. When a user clicks any "Download" button, the `getUpscaler` utility is invoked. This function is engineered for maximum performance and robustness through a multi-layered strategy:
    *   **Singleton Instance:** It manages a single instance of `Upscaler.js`, ensuring the resource-intensive AI model is loaded and "warmed up" only once per session, which significantly speeds up subsequent downloads.
    *   **Backend Management:** It explicitly initializes the TensorFlow.js backend to use `WebGL` for GPU acceleration. If WebGL is unavailable or fails, it gracefully falls back to the `CPU` backend, ensuring the feature works on a wider range of devices.
    *   **Dynamic Model Loading:** It dynamically imports a high-quality 4x ESRGAN model. If this remote model fails to load (e.g., due to a CDN issue), it falls back to the default, built-in 2x model, ensuring the feature is always available.
    *   **Patch Processing:** All upscale calls use `patchSize` and `padding`. This technique breaks the image into smaller tiles for processing, which solves two critical browser limitations: it prevents WebGL texture size limit errors on large images (like the 4-up sheet) and enables the progress callback to function correctly, providing a better user experience.
6.  **Video (Optional):** If the user clicks "Create 360° Video", `handleGenerateVideoClick` calls the `generateHairstyleVideo` service. The `VideoPreview` component displays progress and the final result.
7.  **History:** Upon completion, `saveToHistory` compresses the images and saves the session to the Zustand store.

---

## 4. AI Service (`geminiService.ts`)

This file contains all prompt engineering and API communication code.

### `generateFourUpImage`

This is the core function for image generation, optimized for speed and cost. It constructs a highly specific prompt for the `gemini-2.5-flash-image-preview` model to generate a single 2x2 grid.

**Prompt Engineering Strategy:**

*   **Task Framing:** The prompt is framed as an "Edit" task.
*   **Structured Commands:** The prompt is structured as a clear "spec sheet" with headers like `Task:`, `Output Requirements:`, and `Critical Rules:`.
*   **Clear Angle Descriptions:** The prompt clearly lists the four required views (Front, Left Side, Right Diagonal, Back) and specifies the angle of rotation for each.
*   **Mandatory Rules:** Core instructions strictly command the model to preserve identity, maintain consistency across all four views, and avoid common artifacts (borders, text, etc.).

### `generateHairstyleVideo`

This function calls the `veo-2.0-generate-001` model.

**Prompt Engineering Strategy:**

*   **Cost & Quality Optimization:** The prompt explicitly requests a short duration (approx. 3-4 seconds) and a standard resolution (720p).
*   **Direct Command:** It uses a structured format with clear headers, giving the model a direct command.
*   **Framing Rules:** The prompt clearly defines the required output: a seamless 360-degree rotation, perfect identity preservation, a square (1:1) aspect ratio, and a "head and shoulders" portrait framing.

**Polling Mechanism:**
Video generation is an asynchronous operation. The function initiates the process, then enters a `while` loop, polling the `ai.operations.getVideosOperation` endpoint every 10 seconds until the operation is `done`.

### `getHairstyleSuggestions`

This function calls `gemini-2.5-flash`. It uses `responseMimeType: "application/json"` and a `responseSchema` to ensure the model returns a clean JSON array of strings.

---

## 5. How to Modify the Application

### Changing UI and Styles

*   **Layout & Components:** Modify components in the `components/` directory.
*   **Styling:** All styling is done with Tailwind CSS. The `cn` utility from `lib/utils.ts` is used to merge classes conditionally.

### Changing AI Behavior (Prompt Engineering)

Modify the prompts in `services/geminiService.ts`.

*   **To change image background:** Modify the `Output Requirements` section in the `generateFourUpImage` prompt.
*   **To change art style:** Add a new `Critical Rule` in the `generateFourUpImage` prompt: `- Style: The final image must be in a vibrant, anime-inspired art style.`
*   **To adjust video resolution:** Modify the `Resolution` rule in the `generateHairstyleVideo` prompt.

### Updating Dependencies

The project now uses a standard `package.json` for dependency management. To add or update a package, modify the `dependencies` or `devDependencies` sections and run `npm install`. The original `importmap` has been removed from `index.html`.

---

## 6. Development & Testing Notes

This project was originally developed in a browser-based, sandboxed IDE that used an `importmap` for dependencies. To enable modern tooling like end-to-end testing, the project has been migrated to a standard `npm`-based environment.

### Running the Application

-   **Development Server**: `npm run dev` (uses Vite)
-   **Production Build**: `npm run build`
-   **Preview Production Build**: `npm run preview`

### End-to-End Testing

An attempt was made to add end-to-end tests using **Playwright**. The setup involved creating a `playwright.config.ts`, installing all necessary dependencies, and writing initial test files.

**However, E2E testing is currently BLOCKED by the development environment.**

-   **Issue**: All attempts to run a local server (`vite dev`, `vite preview`, and even a standard Python `http.server`) result in the process hanging and eventually timing out. The Playwright test runner also times out, likely because it cannot launch a browser process successfully within the sandbox.
-   **Conclusion**: The sandboxed environment has fundamental constraints that prevent server processes and/or browser instantiation, making E2E testing impossible at this time. The full test setup has been left in the codebase (`playwright.config.ts`, `e2e/` directory) in case the environment changes or the project is moved to a less restrictive one.
