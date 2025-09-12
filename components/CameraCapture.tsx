
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import LoadingSpinner from './LoadingSpinner';

interface CameraCaptureProps {
    onCapture: (imageDataUrl: string) => void;
    onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        let streamInstance: MediaStream;
        const startCamera = async () => {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setError("Camera not supported on this browser.");
                    return;
                }
                streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                setStream(streamInstance);
                if (videoRef.current) videoRef.current.srcObject = streamInstance;
            } catch (err) {
                if (err instanceof Error) {
                    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") setError("Camera permission denied. Please enable it in your browser settings.");
                    else setError("Could not access camera. Is it in use by another app?");
                } else {
                    setError("An unknown error occurred while accessing the camera.");
                }
            }
        };
        startCamera();
        return () => { if (streamInstance) streamInstance.getTracks().forEach(track => track.stop()); };
    }, []);

    const handleCapture = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === 4) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                onCapture(canvas.toDataURL('image/jpeg', 0.9));
            }
        }
    }, [onCapture]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="w-full max-w-2xl h-full flex flex-col items-center justify-center relative">
                {error ? (
                    <div className="text-center p-8 bg-neutral-900 rounded-lg border border-red-500/50">
                        <h3 className="text-2xl font-semibold text-red-400 mb-4">Camera Error</h3>
                        <p className="text-neutral-300 max-w-sm">{error}</p>
                        <Button onClick={onCancel} variant="primary" className="mt-6">Close</Button>
                    </div>
                ) : (
                    <>
                        <div className="w-full aspect-[3/4] max-h-[80%] bg-black rounded-lg overflow-hidden relative border border-neutral-700">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                            {!stream && <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner /></div>}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full flex justify-center items-center gap-12">
                            <Button onClick={onCancel} variant="ghost">Cancel</Button>
                            <button onClick={handleCapture} disabled={!stream} className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center group disabled:opacity-50" aria-label="Take photo">
                                <div className="w-[85%] h-[85%] rounded-full bg-white group-hover:scale-105 transition-transform duration-200"></div>
                            </button>
                            <div className="w-16"></div> {/* Spacer */}
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default CameraCapture;
