/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Angle } from '../App';

// Helper function to load an image and return it as an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Resizes an image from a data URL for API submission.
 * Resizes to a max dimension of 1024px and converts to JPEG.
 * @param dataUrl The source image data URL.
 * @returns A promise that resolves to a resized JPEG data URL.
 */
export async function resizeImageForApi(dataUrl: string): Promise<string> {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for resizing');

    const MAX_DIMENSION = 1024;
    let { width, height } = img;

    if (width > height) {
        if (width > MAX_DIMENSION) {
            height = height * (MAX_DIMENSION / width);
            width = MAX_DIMENSION;
        }
    } else {
        if (height > MAX_DIMENSION) {
            width = width * (MAX_DIMENSION / height);
            height = MAX_DIMENSION;
        }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.9); // 90% quality JPEG
}

/**
 * Crops a single 2x2 grid image into four separate angle images.
 * @param dataUrl The data URL of the 2x2 grid image.
 * @returns A promise that resolves to a record mapping angles to their cropped image data URLs.
 */
export async function cropFourUpSheet(dataUrl: string): Promise<Record<Angle, string>> {
    const img = await loadImage(dataUrl);
    const { width, height } = img;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const crops: { angle: Angle; x: number; y: number }[] = [
        { angle: 'front', x: 0, y: 0 },
        { angle: 'left', x: halfWidth, y: 0 },
        { angle: 'right', x: 0, y: halfHeight },
        { angle: 'back', x: halfWidth, y: halfHeight },
    ];

    const croppedImages: Record<string, string> = {};

    for (const crop of crops) {
        const canvas = document.createElement('canvas');
        canvas.width = halfWidth;
        canvas.height = halfHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context for cropping');

        ctx.drawImage(
            img,
            crop.x,
            crop.y,
            halfWidth,
            halfHeight,
            0,
            0,
            halfWidth,
            halfHeight
        );
        croppedImages[crop.angle] = canvas.toDataURL('image/jpeg', 0.9);
    }
    
    return croppedImages as Record<Angle, string>;
}


/**
 * Creates a single 4-up sheet image from a collection of angle images.
 * @param imageData A record mapping angle strings to their image data URLs.
 * @returns A promise that resolves to a data URL of the generated sheet (JPEG format).
 */
export async function createFourUpSheet(imageData: Record<Angle, string>): Promise<string> {
    const canvas = document.createElement('canvas');
    const canvasWidth = 2480;
    const canvasHeight = 3508; // A4 aspect ratio
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    // 1. Premium Background
    const bgGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    bgGradient.addColorStop(0, '#1e1b4b'); // Indigo-950
    bgGradient.addColorStop(1, '#0c0a09'); // Neutral-950
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Main Title
    ctx.textAlign = 'center';
    ctx.font = `150px 'Permanent Marker', cursive`;
    const titleGradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    titleGradient.addColorStop(0.3, '#f472b6'); // Pink-400
    titleGradient.addColorStop(0.7, '#a78bfa'); // Violet-400
    ctx.fillStyle = titleGradient;
    ctx.fillText('Barber Booth Pro', canvasWidth / 2, 250);
    
    // 3. Subtitle
    ctx.font = `60px 'Inter', sans-serif`;
    ctx.fillStyle = '#a1a1aa'; // neutral-400
    ctx.fillText('Your Personal AI Hair Salon', canvasWidth / 2, 350);


    const ANGLES_ORDER: Angle[] = ['front', 'left', 'right', 'back'];

    const loadedImages = await Promise.all(
        ANGLES_ORDER.map(angle => loadImage(imageData[angle]))
    );

    const imagesWithAngles = ANGLES_ORDER.map((angle, index) => ({
        angle,
        img: loadedImages[index],
    }));

    // 4. Layout & Drawing Polaroid-style images
    const grid = { cols: 2, rows: 2, padding: 120 };
    const contentTopMargin = 450;
    const contentHeight = canvasHeight - contentTopMargin - grid.padding;
    const cellWidth = (canvasWidth - grid.padding * (grid.cols + 1)) / grid.cols;
    const cellHeight = (contentHeight - grid.padding * (grid.rows + 1)) / grid.rows;

    imagesWithAngles.forEach(({ angle, img }, index) => {
        const row = Math.floor(index / grid.cols);
        const col = index % grid.cols;

        const x = grid.padding * (col + 1) + cellWidth * col;
        const y = contentTopMargin + grid.padding * (row + 1) + cellHeight * row;
        
        const polaroidPadding = 40;
        const captionHeight = 120;
        const polaroidWidth = cellWidth;
        const polaroidHeight = cellHeight;
        const imageContainerHeight = polaroidHeight - captionHeight - polaroidPadding;

        // Draw Polaroid Frame with shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 50;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#f3f4f6'; // gray-100
        ctx.fillRect(x, y, polaroidWidth, polaroidHeight);
        ctx.restore();
        
        // Draw Image inside the frame
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let drawWidth = polaroidWidth - (polaroidPadding * 2);
        let drawHeight = drawWidth / aspectRatio;
        if (drawHeight > imageContainerHeight) {
            drawHeight = imageContainerHeight;
            drawWidth = drawHeight * aspectRatio;
        }

        const imgX = x + (polaroidWidth - drawWidth) / 2;
        const imgY = y + polaroidPadding + (imageContainerHeight - drawHeight) / 2;
        ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight);
        
        // Draw Caption
        ctx.fillStyle = '#1f2937'; // gray-800
        ctx.font = `70px 'Permanent Marker', cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const captionText = angle.charAt(0).toUpperCase() + angle.slice(1);
        const captionY = y + polaroidHeight - (captionHeight / 2);
        ctx.fillText(captionText, x + polaroidWidth / 2, captionY);
    });

    // 5. Footer branding
    ctx.font = `40px 'Inter', sans-serif`;
    ctx.fillStyle = '#71717a'; // neutral-500
    ctx.fillText('Developed by Ronnie H. Placo, powered by the Gemini family', canvasWidth / 2, canvasHeight - 80);

    return canvas.toDataURL('image/jpeg', 0.9);
}


/**
 * Compresses an image from a data URL for storage.
 * Resizes to a max dimension of 512px and converts to JPEG.
 * @param dataUrl The source image data URL.
 * @returns A promise that resolves to a compressed JPEG data URL.
 */
export async function compressImageForStorage(dataUrl: string): Promise<string> {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for compression');

    const MAX_DIMENSION = 512;
    let { width, height } = img;

    if (width > height) {
        if (width > MAX_DIMENSION) {
            height = height * (MAX_DIMENSION / width);
            width = MAX_DIMENSION;
        }
    } else {
        if (height > MAX_DIMENSION) {
            width = width * (MAX_DIMENSION / height);
            height = MAX_DIMENSION;
        }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.8); // 80% quality JPEG
}