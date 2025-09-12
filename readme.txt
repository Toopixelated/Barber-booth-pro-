# Barber Booth Pro: Developer README

Welcome to the Barber Booth Pro developer documentation. This document provides a comprehensive overview of the application's architecture, core logic, AI services, and guidelines for modification. It is intended for developers and AI assistants to understand the codebase fully.

## 1. Project Overview

Barber Booth Pro is a web application that uses generative AI to provide users with a 360-degree preview of a new hairstyle. Users upload a front-facing photo of themselves, describe a hairstyle (or provide a reference image), and the application generates four images of them with that hairstyle from different angles (front, left, right, back). It can also generate a short 360° "turntable" video of the final look.

### Core Features:

*   **Image Upload & Editing:** Users can upload a photo from their device or take one with their camera. An integrated editor allows for cropping and rotation.
*   **AI Hairstyle Generation:** Leverages the Gemini API to apply a new hairstyle based on a text description or a reference image.
*   **Multi-Angle View:** Generates images from four key angles for a complete preview using a single, efficient API call.
*   **Video Generation:** Creates a 360° "turntable" video preview of the final hairstyle using the Veo model.
*   **Generation History:** User sessions are saved to local storage, allowing them to review and restore previous looks.
*   **AI-Powered Suggestions:** Provides creative hairstyle ideas to inspire the user.
*   **Color Customization:** Users can specify an exact hair color using a color picker.

### Technology Stack:

*   **Frontend Framework:** React 19 with TypeScript
*   **State Management:** Zustand
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion
*   **AI Services:** Google Gemini API (`gemini-2.5-flash-image-preview` for images, `veo-2.0-generate-001` for video, `gemini-2.5-flash` for text)
*   **UI Components:** Radix UI (for Slider), React Colorful
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
│   ├── Footer.tsx              # The application's footer.
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
│       └── draggable-card.tsx  # Wrapper for physics-based card dragging (not currently in use).
├── hooks/
│   └── useLocalStorage.ts      # (Not in use) Zustand's persist middleware handles this now.
├── lib/
│   ├── albumUtils.ts           # Utility functions for image manipulation (creating/cropping a 4-up sheet, compressing).
│   ├── shareUtils.ts           # Helper functions for using the Web Share API.
│   └── utils.ts                # General utility functions (`cn` for merging Tailwind CSS classes).
├── services/
│   └── geminiService.ts        # The core of the application. Handles all communication with the Gemini API.
├── App.tsx                     # The main application component, orchestrating all UI and logic.
├── store.ts                    # Zustand store for global state management.
├── index.html                  # The HTML entry point, includes font links and the import map.
├── index.tsx                   # The React entry point, renders the App component into the DOM.
├── metadata.json               # Application metadata, including permissions for camera access.
└── readme.txt                  # This file.
```

---

## 3. Core Concepts & Logic

### 3.1. State Management (`store.ts`)

The application uses **Zustand** for centralized state management. This provides a simple, hook-based API for accessing and modifying state from any component without prop drilling. The store is persisted to `localStorage` to save the user's generation history.

*   **State:** The store holds all critical application data, including the uploaded image, hairstyle inputs, generation status, results, video status, and UI state (e.g., `isHistoryPanelOpen`).
*   **Actions:** The store defines actions (e.g., `setUploadedImage`, `startGeneration`, `addToHistory`) that encapsulate state modification logic. Components call these actions to update the global state.
*   **`appState`:** This derived state controls the main UI flow:
    1.  `'idle'`: The initial state.
    2.  `'image-uploaded'`: An image has been provided.
    3.  `'generating-results'`: The AI is processing the request.

### 3.2. Data Flow & User Journey (`App.tsx`)

1.  **Upload:** The user clicks the initial card (`appState: 'idle'`), which opens the "Choose Source" modal.
2.  **Edit:** After a file is selected or a photo is taken, the `ImageEditor` modal is shown. Upon saving (`handleEditorSave`), the cropped image is stored in the Zustand store via `setUploadedImage`, and the state transitions to `appState: 'image-uploaded'`.
3.  **Describe:** The user provides a text description or uploads a reference image and can optionally select a hair color.
4.  **Generate:** The user clicks "Generate Pro". This calls `runGenerationSequence`.
    *   `startGeneration()` is called, setting `appState` to `'generating-results'`.
    *   The function makes a **single, efficient API call** to `generateFourUpImage` in `geminiService.ts`, requesting a complete 2x2 grid image. This is faster and more cost-effective than generating each angle separately.
    *   Upon receiving the single grid image, the app calls `cropFourUpSheet` from `lib/albumUtils.ts` to slice the image into four separate quadrants on the client-side.
    *   The Zustand store is updated with the four cropped images via `setAngleStatus`, and the `PolaroidCard` components render the results.
5.  **Display & Interact:** Results are shown in `PolaroidCard` components. Users can regenerate, share, download, or compare the front view.
6.  **Video (Optional):** If the user clicks "Create 360° Video", `handleGenerateVideoClick` calls the `generateHairstyleVideo` service. The `VideoPreview` component displays progress and the final result.
7.  **History:** Upon completion, `saveToHistory` compresses the images and saves the session to the Zustand store, which persists it to local storage.

---

## 4. AI Service (`geminiService.ts`)

This file contains all prompt engineering and API communication code.

### `generateFourUpImage`

This is the core function for image generation, optimized for speed and cost. It constructs a highly specific prompt for the `gemini-2.5-flash-image-preview` model to generate a single 2x2 grid.

**Prompt Engineering Strategy:**

*   **Task Framing:** The prompt is framed as an "Edit" task, which is optimal for this model.
*   **Structured Commands:** The prompt is structured as a clear "spec sheet" with headers like `Task:`, `Grid Composition:`, and `Critical Rules:`. This format is easier for the model to parse.
*   **Camera-Centric Instructions:** To ensure directional consistency, the prompts for side profiles provide explicit instructions from the camera's perspective (e.g., "...the subject's nose should be facing towards the left side of the screen").
*   **Mandatory Rules:** Core instructions strictly command the model to preserve identity, maintain consistency across all four views, and avoid common artifacts (borders, text, etc.).
*   **Single-Call Efficiency:** This single-call approach ensures all angles are generated in the same context, leading to superior consistency in lighting, color, and style.

### `generateHairstyleVideo`

This function calls the `veo-2.0-generate-001` model.

**Prompt Engineering Strategy:**

*   **Cost & Quality Optimization:** The prompt explicitly requests a short duration (approx. 3-4 seconds) and a standard resolution (720p). This significantly reduces API costs while maintaining high quality for web playback.
*   **Direct Command:** It uses a structured format with clear headers, giving the model a direct command without complex personas or overly prescriptive rules that could be misinterpreted.
*   **Core Instructions:** The prompt clearly defines the required output: a seamless 360-degree rotation, perfect identity preservation, a square (1:1) aspect ratio, and a "head and shoulders" portrait framing.

**Polling Mechanism:**
Video generation is an asynchronous operation. The function initiates the process, then enters a `while` loop, polling the `ai.operations.getVideosOperation` endpoint every 10 seconds until the operation is `done`, sending progress messages to the UI.

### `getHairstyleSuggestions`

This function calls `gemini-2.5-flash`. It uses `responseMimeType: "application/json"` and a `responseSchema` to ensure the model returns a clean JSON array of strings.

---

## 5. How to Modify the Application

### Changing UI and Styles

*   **Layout & Components:** Modify components in the `components/` directory. For example, to change the results layout, edit the JSX in the `'generating-results'` block within `App.tsx`.
*   **Styling:** All styling is done with Tailwind CSS. The `cn` utility from `lib/utils.ts` is used to merge classes conditionally.

### Changing AI Behavior (Prompt Engineering)

Modify the prompts in `services/geminiService.ts`.

*   **To change image background:** Modify the `Output Requirements` section in the `generateFourUpImage` prompt.
*   **To change art style:** Add a new `Critical Rule` in the `generateFourUpImage` prompt: `- Style: The final image must be in a vibrant, anime-inspired art style.`
*   **To adjust video resolution:** Modify the `Resolution` rule in the `generateHairstyleVideo` prompt. For example, change `720p` to `1080p` for higher quality (and higher cost).

### Updating Dependencies

The project uses an `importmap` in `index.html`. To update a package, change the version number in the import map URL.
