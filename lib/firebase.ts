/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";

// =======================================================================================
// IMPORTANT: FIREBASE CONFIGURATION (REQUIRED)
// ---------------------------------------------------------------------------------------
// This configuration is now populated.
// To use your own project, follow these steps:
//
// 1. Go to the Firebase Console: https://console.firebase.google.com/
// 2. Create a project.
// 3. Go to Project Settings > General tab > Your apps > Web app (</>).
// 4. Register your app and copy the `firebaseConfig` object.
// 5. Replace the existing `firebaseConfig` object below with yours.
// 6. In the Firebase Console, go to Authentication > Sign-in method.
// 7. Enable the "Email/Password", "Google", and "Facebook" providers.
// =======================================================================================

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDRqObWnFGQgS7bFxSsKo8VPKV8edi263o",
  authDomain: "barber-pro-firebase.firebaseapp.com",
  projectId: "barber-pro-firebase",
  storageBucket: "barber-pro-firebase.firebasestorage.app",
  messagingSenderId: "994734418898",
  appId: "1:994734418898:web:350f35f06c47a51311760b",
  measurementId: "G-WH74RBDDNN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the auth instance to be used throughout the app
export const auth = getAuth(app);

// Export authentication providers
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
