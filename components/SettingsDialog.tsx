/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { Dialog } from './ui/dialog';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Volume2, VolumeX, LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Button } from './ui/button';
import toast from 'react-hot-toast';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
    const { isSoundEnabled, toggleSoundEnabled, currentUser } = useStore();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut(auth);
            // The AuthGate component will handle state cleanup
            onClose();
            toast.success("You have been signed out.");
        } catch (error) {
            console.error("Error signing out:", error);
            toast.error("Failed to sign out. Please try again.");
        } finally {
            setIsSigningOut(false);
        }
    };

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="Settings" className="w-full max-w-md">
            <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                        {isSoundEnabled ? <Volume2 className="w-5 h-5 text-neutral-300" /> : <VolumeX className="w-5 h-5 text-neutral-500" />}
                        <label htmlFor="sound-toggle" className="text-sm font-medium text-neutral-200">
                            Sound Effects
                            <p className="text-xs text-neutral-500">Enable or disable UI sounds.</p>
                        </label>
                    </div>
                    <button
                        role="switch"
                        aria-checked={isSoundEnabled}
                        onClick={toggleSoundEnabled}
                        id="sound-toggle"
                        className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            isSoundEnabled ? 'bg-pink-500' : 'bg-neutral-700'
                        )}
                    >
                        <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            isSoundEnabled ? 'translate-x-6' : 'translate-x-1'
                        )} />
                    </button>
                </div>
                
                {currentUser && (
                    <div className="pt-4 border-t border-neutral-800">
                        <p className="text-xs text-neutral-500 mb-2">Signed in as: <span className="font-medium text-neutral-400">{currentUser?.email}</span></p>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                        </Button>
                    </div>
                )}
            </div>
        </Dialog>
    );
};

export default SettingsDialog;