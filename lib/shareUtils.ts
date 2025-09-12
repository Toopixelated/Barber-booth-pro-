
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import toast from 'react-hot-toast';

// Helper to convert a data URL to a File object
async function dataURLtoFile(dataurl: string, filename: string): Promise<File | null> {
    try {
        const res = await fetch(dataurl);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    } catch (error) {
        console.error("Error converting data URL to file:", error);
        return null;
    }
}

interface ShareData {
    url: string;
    title: string;
    type: 'image' | 'video';
}

/**
 * Attempts to share content using the Web Share API.
 * @param content The content to share.
 * @param openFallback A function to call if Web Share API is not available/successful.
 */
export async function attemptShare(content: ShareData, openFallback: () => void) {
    const { url, title, type } = content;
    const extension = type === 'image' ? 'jpg' : 'mp4';
    const filename = `barber-booth-pro-${title.toLowerCase().replace(/\s/g, '-')}.${extension}`;
    const shareText = `Check out this "${title}" hairstyle I created with Barber Booth Pro!`;
    
    const file = await dataURLtoFile(url, filename);
    if (!file) {
        toast.error('Could not prepare file for sharing.');
        openFallback();
        return;
    }

    const shareData = {
        title: 'Barber Booth Pro',
        text: shareText,
        files: [file],
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            // Ignore user aborting the share flow
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error using Web Share API:', error);
                toast.error('Something went wrong while sharing.');
                openFallback(); // Open fallback if sharing fails for other reasons
            }
        }
    } else {
        // Web Share API not supported, open the fallback menu
        openFallback();
    }
}
