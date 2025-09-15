/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { useStore } from '../store';

const UpscalingProgress = () => {
    const { upscalingProgress } = useStore();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center"
            aria-modal="true"
            role="dialog"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
                <Card className="w-full max-w-xs text-center p-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Enhancing Image...</h3>
                    <div className="w-full bg-neutral-700 rounded-full h-2.5">
                        <motion.div
                            className="bg-pink-500 h-2.5 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${upscalingProgress}%` }}
                            transition={{ ease: "linear", duration: 0.1 }}
                        />
                    </div>
                    <p className="text-white mt-2 font-mono">{Math.round(upscalingProgress)}%</p>
                    <p className="text-sm text-neutral-400 mt-4">Please keep the app open.</p>
                </Card>
            </motion.div>
        </motion.div>
    );
};

export default UpscalingProgress;