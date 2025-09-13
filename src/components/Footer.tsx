/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useStore } from '@/store';

const Footer = () => {
    const { installPromptEvent, setInstallPromptEvent } = useStore(state => ({
        installPromptEvent: state.installPromptEvent,
        setInstallPromptEvent: state.setInstallPromptEvent,
    }));

    const handleInstallClick = async () => {
        if (!installPromptEvent) return;

        installPromptEvent.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await installPromptEvent.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
        } else {
            console.log('User dismissed the A2HS prompt');
        }
        // The event can only be used once.
        setInstallPromptEvent(null);
    };

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-neutral-950/50 backdrop-blur-sm p-3 z-50 text-neutral-400 text-xs sm:text-sm border-t border-neutral-800">
            <div className="max-w-screen-xl mx-auto flex justify-between items-center gap-4 px-4">
                <p>
                    Developed by Ronnie H. Placo, powered by the Gemini family
                </p>
                <div className="flex items-center gap-4">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleInstallClick}
                        disabled={!installPromptEvent}
                        title={!installPromptEvent ? "Installation not available on this browser. On iOS, use Share > Add to Home Screen." : "Install this app on your device"}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Home Screen
                    </Button>
                </div>
            </div>
        </footer>
    );
};

export default Footer;