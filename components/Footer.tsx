/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Button } from './ui/button';
import { Github } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-neutral-950/50 backdrop-blur-sm p-3 z-50 text-neutral-400 text-xs sm:text-sm border-t border-neutral-800">
            <div className="max-w-screen-xl mx-auto flex justify-between items-center gap-4 px-4">
                <p>
                    Developed by Ronnie H. Placo, powered by the Gemini family
                </p>
                <div className="flex items-center gap-4">
                    <a href="https://github.com/google-gemini-v2/codestrela/tree/main/barber-booth" target="_blank" rel="noopener noreferrer">
                         <Button variant="ghost" size="icon">
                            <Github className="h-4 w-4" />
                        </Button>
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;