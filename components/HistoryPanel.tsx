/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { X, Star, Trash2 } from 'lucide-react';

const HistoryPanel: React.FC = () => {
    const { isHistoryPanelOpen, setHistoryPanelOpen, generationHistory, restoreFromHistory, clearHistory, toggleFavorite } = useStore();
    const [filter, setFilter] = useState<'all' | 'favorites'>('all');

    const panelVariants = { open: { x: 0 }, closed: { x: "100%" } };
    
    const filteredHistory = filter === 'favorites' ? generationHistory.filter(item => item.isFavorite) : generationHistory;

    return (
        <AnimatePresence>
            {isHistoryPanelOpen && (
                <>
                    {/* FIX: Wrapped motion props in a spread object to resolve type error. */}
                    <motion.div {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" onClick={() => setHistoryPanelOpen(false)} aria-hidden="true" />
                    {/* FIX: Wrapped motion props in a spread object to resolve type error. */}
                    <motion.div {...{ variants: panelVariants, initial: "closed", animate: "open", exit: "closed", transition: { type: 'spring', stiffness: 300, damping: 30 } }} className="fixed top-0 right-0 h-full w-full max-w-md bg-neutral-900 border-l border-neutral-800 shadow-2xl z-[80] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="history-panel-title">
                        <header className="flex-shrink-0 p-4 flex items-center justify-between border-b border-neutral-800">
                            <h2 id="history-panel-title" className="text-xl font-semibold text-white">Generation History</h2>
                            <Button onClick={() => setHistoryPanelOpen(false)} variant="ghost" size="icon" aria-label="Close history panel"><X className="h-4 w-4" /></Button>
                        </header>

                        {generationHistory.length > 0 && (
                            <div className="p-4 border-b border-neutral-800">
                                <div className="flex bg-neutral-800 p-1 rounded-md">
                                    <button onClick={() => setFilter('all')} className={cn("w-1/2 py-1.5 text-sm rounded", filter === 'all' ? 'bg-indigo-600 text-white' : 'text-neutral-400')}>All</button>
                                    <button onClick={() => setFilter('favorites')} className={cn("w-1/2 py-1.5 text-sm rounded", filter === 'favorites' ? 'bg-indigo-600 text-white' : 'text-neutral-400')}>Favorites</button>
                                </div>
                            </div>
                        )}

                        <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin">
                            {filteredHistory.length === 0 ? (
                                <div className="text-center text-neutral-500 pt-10">
                                    <p>{generationHistory.length === 0 ? 'No history yet.' : 'No favorites found.'}</p>
                                    <p className="text-sm">{generationHistory.length === 0 ? 'Complete a generation to save it here.' : 'Click the star to save a favorite.'}</p>
                                </div>
                            ) : (
                                filteredHistory.map(item => (
                                    // FIX: Wrapped motion props in a spread object to resolve type error.
                                    <motion.div key={item.id} {...{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }} className="bg-neutral-800/50 p-3 rounded-lg flex gap-4 border border-neutral-700/50">
                                        <img src={item.uploadedImage} alt="User" className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs text-neutral-400">{new Date(item.timestamp).toLocaleString()}</p>
                                            <p className="text-white truncate font-medium mt-1">{item.hairstyleReferenceImage ? `Reference Image` : `"${item.hairstyleDescription}"`}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <Button onClick={() => restoreFromHistory(item)} variant="ghost" className="text-pink-400 hover:text-pink-300 h-auto p-0">Restore</Button>
                                                <Button onClick={() => toggleFavorite(item.id)} variant="ghost" size="icon" className="text-neutral-400 hover:text-yellow-400">
                                                    <Star className={cn("h-5 w-5", item.isFavorite && "fill-yellow-400 text-yellow-400")} />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {generationHistory.length > 0 && (
                            <footer className="flex-shrink-0 p-4 border-t border-neutral-800">
                                <Button onClick={clearHistory} variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4"/>Clear All History</Button>
                            </footer>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HistoryPanel;
