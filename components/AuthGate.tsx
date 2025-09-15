/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useStore } from '../store';
import App from '../App';
import LoginScreen from './LoginScreen';
import LoadingSpinner from './LoadingSpinner';
import { getUpscaler } from '../lib/upscaler';

const AuthGate: React.FC = () => {
    const { setCurrentUser, logoutUser } = useStore.getState();
    const currentUser = useStore(state => state.currentUser);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Pre-load the upscaler model while user is on login screen
        const timer = setTimeout(() => {
            getUpscaler();
        }, 3000);
        
        return () => clearTimeout(timer);
    }, []);

    // =======================================================================================
    // PRODUCTION MODE
    // ---------------------------------------------------------------------------------------
    // This is the real authentication logic. It connects to Firebase and checks
    // for a real logged-in user. It is now active.
    // =======================================================================================
    useEffect(() => {
        // onAuthStateChanged returns an unsubscribe function
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                try {
                    const token = await user.getIdToken();
                    setCurrentUser(user, token);
                } catch (error) {
                    console.error("Error getting ID token:", error);
                    // If we can't get a token, treat it as a logout
                    logoutUser();
                }
            } else {
                logoutUser();
            }
            setIsLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [setCurrentUser, logoutUser]);


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-950">
                <LoadingSpinner message="Authenticating..." />
            </div>
        );
    }

    return currentUser ? <App /> : <LoginScreen />;
};

export default AuthGate;