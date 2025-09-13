
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import { Button } from '@/components/ui/button';

interface ImageEditorProps {
    imageSrc: string;
    onSave: (croppedImageUrl: string) => void;
    onCancel: () => void;
    title: string;
}

const canvasPreview = (
    image: HTMLImageElement,
    canvas: HTMLCanvasElement,
    crop: PixelCrop,
    scale = 1,
    rotate = 0
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;

    canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    const rotateRads = rotate * (Math.PI / 180);
    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();
    ctx.translate(-cropX, -cropY);
    ctx.translate(centerX, centerY);
    ctx.rotate(rotateRads);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
    ctx.restore();
};

const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onSave, onCancel, title }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [rotation, setRotation] = useState(0);

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height);
        setCrop(initialCrop);
    };
    
    const handleSaveCrop = () => {
        const image = imgRef.current;
        const canvas = previewCanvasRef.current;
        if (!completedCrop || !image || !canvas || !completedCrop.width || !completedCrop.height) {
            return;
        }

        canvasPreview(image, canvas, completedCrop, 1, rotation);
        onSave(canvas.toDataURL('image/jpeg', 0.9));
    };

    const isSaveDisabled = !completedCrop || completedCrop.width === 0 || completedCrop.height === 0;

    return (
        // FIX: Wrapped motion props in a spread object to resolve type error.
        <motion.div {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            {/* FIX: Wrapped motion props in a spread object to resolve type error. */}
            <motion.div {...{ initial: { scale: 0.9, y: 20 }, animate: { scale: 1, y: 0 }, exit: { scale: 0.9, y: 20 } }} className="bg-neutral-900 rounded-lg shadow-xl w-full max-w-lg border border-neutral-700 flex flex-col max-h-[90vh]">
                <h2 className="text-2xl font-semibold text-center p-6 pb-4 text-white flex-shrink-0">{title}</h2>
                <div className="flex-grow overflow-y-auto px-6 space-y-6">
                    <div className="flex justify-center items-center bg-black/50 p-4 rounded-md">
                        <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)} aspect={1}>
                            <img ref={imgRef} alt="Crop me" src={imageSrc} style={{ transform: `rotate(${rotation}deg)` }} onLoad={onImageLoad} className="max-h-[50vh] object-contain" />
                        </ReactCrop>
                    </div>
                    <div>
                        <label htmlFor="rotation" className="block text-sm font-medium text-neutral-400 mb-2">Rotation: <span className="font-bold text-white">{rotation}°</span></label>
                        <input id="rotation" type="range" value={rotation} min={-45} max={45} step={1} onChange={(e) => setRotation(Number(e.target.value))} className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                    </div>
                </div>
                <canvas ref={previewCanvasRef} className="hidden" />
                <div className="flex justify-end gap-4 p-6 pt-4 mt-auto flex-shrink-0 border-t border-neutral-800">
                    <Button onClick={onCancel} variant="ghost">Cancel</Button>
                    <Button onClick={handleSaveCrop} disabled={isSaveDisabled} variant="primary">Confirm</Button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ImageEditor;
