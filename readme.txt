# Barber Booth Pro: Developer README

This document provides a high-level technical overview of the Barber Booth Pro application. For a complete breakdown of user stories, features, and AI prompt specifications, **refer to `designspec.txt`**. For troubleshooting environment-specific issues, consult `workspace_context.txt`.

## 1. CRITICAL: Security Notice for Prototyping

This application is a **prototype** and makes direct, client-side calls to the Google Gemini API. This configuration exposes the API key in the browser.

**DO NOT deploy this application to a public production environment in its current state.** For production, all API calls must be proxied through a secure backend server that protects the API key. See `designspec.txt` for the full risk analysis.

## 2. Technology Stack

*   **Frontend Framework:** React 19 with TypeScript
*   **AI SDK:** `@google/genai`
*   **State Management:** Zustand (with `localStorage` persistence via middleware)
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion
*   **Image Upscaling:** Upscaler.js with TensorFlow.js (client-side)
*   **Authentication:** Firebase Authentication

## 3. Key Modules & Architecture

The application follows a client-first, component-based architecture with global state management.

*   **`index.tsx`**: Entry point. Initializes the React root and the main `AuthGate`.
*   **`App.tsx`**: The primary application component. Manages the main UI states ('idle', 'image-uploaded', 'generating-results') and orchestrates the user journey.
*   **`store.ts`**: The Zustand global state store. It is the single source of truth for all application data, including user inputs, generation results, and UI state. It handles persistence to `localStorage`.
*   **`services/geminiService.ts`**: The core AI and data service layer.
    *   Contains all direct calls to the Google Gemini API for image/video generation and text suggestions. The exact prompt structures are defined in `designspec.txt`.
    *   Manages all `localStorage` operations for user history (create, read, clear).
*   **`lib/upscaler.ts`**: Provides a robust, singleton instance of `Upscaler.js`, managing the TF.js backend and fallback logic for reliable client-side image enhancement.
*   **`lib/firebase.ts` & `components/AuthGate.tsx`**: Manages user authentication and session persistence, acting as a gatekeeper to the main application.
