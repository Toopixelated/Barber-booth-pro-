
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  className?: string;
  onAnimationComplete?: (definition: any) => void;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children, title, className, onAnimationComplete }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        // FIX: Wrapped motion props in a spread object to resolve type error.
        <motion.div
          {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* FIX: Wrapped motion props in a spread object to resolve type error. */}
          <motion.div
            {...{
            initial: { scale: 0.95, y: 20 },
            animate: { scale: 1, y: 0 },
            exit: { scale: 0.95, y: 20 },
            transition: { type: 'spring', stiffness: 300, damping: 30 }
          }}
            onClick={(e) => e.stopPropagation()}
            onAnimationComplete={onAnimationComplete}
            className={className}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <Card className="w-full flex flex-col">
              <header className="flex-shrink-0 p-4 flex items-center justify-between border-b border-neutral-800">
                <h2 id="dialog-title" className="text-lg font-semibold text-white">{title}</h2>
                <Button onClick={onClose} variant="ghost" size="icon" aria-label="Close dialog">
                  <X className="h-4 w-4" />
                </Button>
              </header>
              <div className="flex-grow p-4">
                {children}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
