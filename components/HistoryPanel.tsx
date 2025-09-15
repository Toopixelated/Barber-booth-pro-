/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { X, Star, Trash2, FileText, Image as ImageIcon, Calendar } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const HistoryPanel: React.FC = () => {
    const { 
        isHistoryPanelOpen, setHistoryPanelOpen, generationHistory, restoreFromHistory, 
        clearHistory, toggleFavorite, historyFilterType, setHistoryFilterType, 
        historyFilterDateRange, setHistoryFilterDateRange, isHistoryLoading 
    } = useStore();

    const panelVariants = { open: { x: 0 }, closed: { x: "100%" } };
    
    const filteredHistory = generationHistory.filter(item => {
        // Type filter logic
        let typeMatch = false;
        if (historyFilterType === 'all') {
            typeMatch = true;
        } else if (historyFilterType === 'favorites') {
            typeMatch = !!item.isFavorite;
        } else if (historyFilterType === 'text') {
            typeMatch = !item.hairstyleReferenceImage; // Text-based if no ref image
        } else if (historyFilterType === 'image') {
            typeMatch = !!item.hairstyleReferenceImage; // Image-based if has ref image
        }

        // Date filter logic
        const itemDate = new Date(item.timestamp);
        const startDate = historyFilterDateRange.start ? new Date(historyFilterDateRange.start) : null;
        const endDate = historyFilterDateRange.end ? new Date(historyFilterDateRange.end) : null;
        
        // Adjust dates to cover the full day
        if (startDate) startDate.setHours(0, 0, 0, 0); 
        if (endDate) endDate.setHours(23, 59, 59, 999); 

        const dateMatch = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);

        return typeMatch && dateMatch;
    });

    const handleClearDateRange = () => {
        setHistoryFilterDateRange({ start: null, end: null });
    };

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

                        {!isHistoryLoading && generationHistory.length > 0 && (
                            <div className="p-4 border-b border-neutral-800 space-y-4">
                                <div className="grid grid-cols-4 bg-neutral-800 p-1 rounded-md">
                                    <button onClick={() => setHistoryFilterType('all')} className={cn("py-1.5 text-xs rounded transition-colors", historyFilterType === 'all' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold' : 'text-neutral-400 hover:bg-neutral-700/50')}>All</button>
                                    <button onClick={() => setHistoryFilterType('favorites')} className={cn("py-1.5 text-xs rounded transition-colors", historyFilterType === 'favorites' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold' : 'text-neutral-400 hover:bg-neutral-700/50')}>Favorites</button>
                                    <button onClick={() => setHistoryFilterType('text')} className={cn("py-1.5 text-xs rounded transition-colors", historyFilterType === 'text' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold' : 'text-neutral-400 hover:bg-neutral-700/50')}>Text</button>
                                    <button onClick={() => setHistoryFilterType('image')} className={cn("py-1.5 text-xs rounded transition-colors", historyFilterType === 'image' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold' : 'text-neutral-400 hover:bg-neutral-700/50')}>Image</button>
                                </div>
                                <div>
                                     <label className="text-xs font-semibold text-neutral-400 flex items-center mb-2">
                                        <Calendar className="w-3 h-3 mr-2" />
                                        FILTER BY DATE
                                     </label>
                                     <div className="flex items-center gap-2">
                                        <input type="date" value={historyFilterDateRange.start || ''} onChange={e => setHistoryFilterDateRange({ ...historyFilterDateRange, start: e.target.value })} className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-white" />
                                        <span className="text-neutral-500">-</span>
                                        <input type="date" value={historyFilterDateRange.end || ''} onChange={e => setHistoryFilterDateRange({ ...historyFilterDateRange, end: e.target.value })} className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-white" />
                                        <Button onClick={handleClearDateRange} variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0" title="Clear date range"><X className="w-4 h-4" /></Button>
                                     </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin">
                            {isHistoryLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <LoadingSpinner message="Loading history..." />
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div className="text-center text-neutral-500 pt-10">
                                    <p>{generationHistory.length === 0 ? 'No history yet.' : 'No results for this filter.'}</p>
                                    <p className="text-sm">{generationHistory.length === 0 ? 'Complete a generation to save it here.' : 'Try adjusting your filters.'}</p>
                                </div>
                            ) : (
                                filteredHistory.map(item => (
                                    // FIX: Wrapped motion props in a spread object to resolve type error.
                                    <motion.div key={item.id} {...{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }} className="bg-neutral-800/50 p-3 rounded-lg flex gap-4 border border-neutral-700/50">
                                        <img src={item.uploadedImage} alt="User" className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="text-xs text-neutral-400">{new Date(item.timestamp).toLocaleString()}</p>
                                                {item.hairstyleReferenceImage ? <ImageIcon className="w-4 h-4 text-neutral-500" /> : <FileText className="w-4 h-4 text-neutral-500" />}
                                            </div>
                                            <p className="text-white truncate font-medium mt-1">
                                                {item.hairstyleDescription ? `"${item.hairstyleDescription}"` : item.hairstyleReferenceImage ? "Reference Image" : "Generated Style"}
                                            </p>
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

                        {!isHistoryLoading && generationHistory.length > 0 && (
                            <footer className="flex-shrink-0 p-4 border-t border-neutral-800">
                                <Button onClick={() => { if(confirm('Are you sure you want to delete all history? This cannot be undone.')) clearHistory(); }} variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4"/>Clear All History</Button>
                            </footer>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HistoryPanel;