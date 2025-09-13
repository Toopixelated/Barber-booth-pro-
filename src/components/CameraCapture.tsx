/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { X, SwitchCamera } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (imageDataUrl: string) => void;
    onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
    const [isFrontFacing, setIsFrontFacing] = useState(true);

    // Effect to get devices and set the initial one
    useEffect(() => {
        const getDevices = async () => {
            try {
                if (!navigator.mediaDevices?.enumerateDevices) {
                    throw new Error("Camera enumeration not supported.");
                }
                // We must request permission first before enumerateDevices gives full details
                const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(device => device.kind === 'videoinput');

                // Stop the temporary permission stream immediately
                permissionStream.getTracks().forEach(track => track.stop());
                
                if (videoDevices.length === 0) {
                    setError("No cameras found on this device.");
                    return;
                }
                
                setDevices(videoDevices);
                
                // Prefer a front-facing camera ('user' facingMode) first
                // FIX: Cast device to 'any' to access the non-standard but commonly available 'facingMode' property.
                const frontCamera = videoDevices.find(device => (device as any).facingMode === 'user' || device.label.toLowerCase().includes('front'));
                setActiveDeviceId(frontCamera?.deviceId || videoDevices[0].deviceId);

            } catch (err) {
                 if (err instanceof Error) {
                    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") setError("Camera permission denied. Please enable it in your browser settings.");
                    else setError("Could not access camera. Is it in use by another app?");
                } else {
                    setError("An unknown error occurred while accessing the camera.");
                }
            }
        };
        getDevices();
    }, []);

    // Effect to start/change the camera stream when activeDeviceId changes
    useEffect(() => {
        // Cleanup previous stream if it exists
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        if (activeDeviceId) {
            const getStream = async () => {
                try {
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: activeDeviceId } }
                    });
                    setStream(newStream);

                    // Determine if the camera is front-facing for mirroring
                    const currentDevice = devices.find(d => d.deviceId === activeDeviceId);
                    // FIX: Cast currentDevice to 'any' to access the non-standard 'facingMode' property for mirroring logic.
                    const frontFacing = (currentDevice as any)?.facingMode === 'user' || currentDevice?.label.toLowerCase().includes('front');
                    setIsFrontFacing(frontFacing);

                    if (videoRef.current) {
                        videoRef.current.srcObject = newStream;
                    }
                } catch (err) {
                    setError("Failed to start the selected camera.");
                    console.error(err);
                }
            };
            getStream();
        }

        // Cleanup function for when the component unmounts
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        // This is a complex effect managing its own cleanup, so we disable the exhaustive-deps rule.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDeviceId]);

    const handleSwitchCamera = () => {
        if (devices.length < 2) return;
        const currentIndex = devices.findIndex(device => device.deviceId === activeDeviceId);
        const nextIndex = (currentIndex + 1) % devices.length;
        setActiveDeviceId(devices[nextIndex].deviceId);
    };

    const handleCapture = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === 4) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                // Only flip the image horizontally if it's from a front-facing camera
                if (isFrontFacing) {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                onCapture(canvas.toDataURL('image/jpeg', 0.9));
            }
        }
    }, [onCapture, isFrontFacing]);

    return (
        // FIX: Wrapped motion props in a spread object to resolve type error.
        <motion.div {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="w-full max-w-2xl h-full flex flex-col items-center justify-center relative">
                <Button 
                    onClick={onCancel} 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-4 right-4 z-10 text-white rounded-full hover:bg-white/20 hover:text-white"
                    aria-label="Close camera"
                >
                    <X className="h-6 w-6" />
                </Button>

                {error ? (
                    <div className="text-center p-8 bg-neutral-900 rounded-lg border border-red-500/50">
                        <h3 className="text-2xl font-semibold text-red-400 mb-4">Camera Error</h3>
                        <p className="text-neutral-300 max-w-sm">{error}</p>
                        <Button onClick={onCancel} variant="primary" className="mt-6">Close</Button>
                    </div>
                ) : (
                    <>
                        <div className="w-full aspect-[3/4] max-h-[80%] bg-black rounded-lg overflow-hidden relative border border-neutral-700">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className="w-full h-full object-cover" 
                                style={{ transform: isFrontFacing ? 'scaleX(-1)' : 'none' }}
                            />
                            {!stream && <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner message="Starting camera..." /></div>}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full flex justify-center items-center gap-12">
                            <Button onClick={onCancel} variant="ghost" className="text-white hover:bg-white/20 hover:text-white">Cancel</Button>
                            <button onClick={handleCapture} disabled={!stream} className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center group disabled:opacity-50" aria-label="Take photo">
                                <div className="w-[85%] h-[85%] rounded-full bg-white group-hover:scale-105 transition-transform duration-200"></div>
                            </button>
                            <div className="w-16 h-16 flex items-center justify-center">
                                {devices.length > 1 && (
                                    <Button 
                                        onClick={handleSwitchCamera}
                                        variant="ghost"
                                        size="icon"
                                        className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
                                        aria-label="Switch camera"
                                    >
                                        <SwitchCamera className="h-8 w-8" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default CameraCapture;
