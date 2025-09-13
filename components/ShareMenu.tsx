/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { useStore } from '../store';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Twitter, Facebook, Copy, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUpscaler } from '../lib/upscaler';
import { useTranslation } from 'react-i18next';

// Helper to convert data URL to Blob for clipboard API
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
    const res = await fetch(dataurl);
    return res.blob();
}

const ShareMenu: React.FC = () => {
    const { t } = useTranslation();
    const { isShareMenuOpen, closeShareMenu, shareContent } = useStore();
    const [isUpscaling, setIsUpscaling] = useState(false);

    if (!isShareMenuOpen || !shareContent) return null;

    const { url, type, title } = shareContent;
    const shareText = t('share_text');
    const projectUrl = "https://github.com/google-gemini-v2/codestrela/tree/main/barber-booth";

    const handleCopy = async () => {
        if (type === 'image') {
            try {
                if (!navigator.clipboard?.write) throw new Error("Clipboard API not supported");
                const blob = await dataURLtoBlob(url);
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                toast.success(t('copy_success'));
            } catch (error) {
                console.error('Failed to copy image:', error);
                toast.error(t('copy_error'));
            }
        } else {
            toast.error(t('copy_error_video'));
        }
    };
    
    const handleDownload = async () => {
        if (isUpscaling) return;

        if (type === 'video') {
            const link = document.createElement('a');
            link.href = url;
            link.download = `barber-booth-pro-video.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        
        setIsUpscaling(true);
        let scale = 2; // default
        const toastId = toast.loading(t('upscaling_start'));
        try {
            const { instance: upscaler, scale: modelScale } = await getUpscaler();
            scale = modelScale;
            toast.loading(t('upscaling_progress', { scale, progress: 0 }), { id: toastId });
            
            const upscaledUrl = await upscaler.upscale(url, {
                output: 'base64',
                patchSize: 64,
                padding: 2,
                progress: (p) => toast.loading(t('upscaling_progress', { scale, progress: Math.round(p * 100) }), { id: toastId })
            });
            toast.success(t('upscaling_complete'), { id: toastId });

            const link = document.createElement('a');
            link.href = upscaledUrl;
            link.download = `barber-booth-pro-${title.toLowerCase()}-upscaled.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Upscaling failed:", error);
            toast.error(t('upscaling_failed', { scale }), { id: toastId });
            // Fallback to downloading original image
            const link = document.createElement('a');
            link.href = url;
            link.download = `barber-booth-pro-${title.toLowerCase()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsUpscaling(false);
        }
    };

    const socialLinks = [
        { name: t('twitter'), icon: Twitter, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(projectUrl)}` },
        { name: t('facebook'), icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(projectUrl)}` },
    ];

    return (
        <Dialog isOpen={isShareMenuOpen} onClose={closeShareMenu} title={`${t('share')} ${title}`} className="w-full max-w-md">
            <div className="flex flex-col gap-4">
                {type === 'image' ? (
                    <img src={url} alt={title} className="w-full rounded-lg object-cover aspect-square" />
                ) : (
                    <video src={url} controls autoPlay loop muted className="w-full rounded-lg" />
                )}
                <p className="text-sm text-center text-neutral-400">
                    {t('share_social_media')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {socialLinks.map(social => (
                        <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" className="w-full">
                            <Button variant="secondary" className="w-full">
                                <social.icon className="mr-2 h-4 w-4" />
                                {social.name}
                            </Button>
                        </a>
                    ))}
                </div>
                 <div className="grid grid-cols-2 gap-3">
                     <Button onClick={handleCopy} variant="secondary" disabled={type === 'video'}>
                        <Copy className="mr-2 h-4 w-4" />
                        {type === 'image' ? t('copy_image') : t('copy_not_supported')}
                     </Button>
                     <Button onClick={handleDownload} variant="primary" disabled={isUpscaling}>
                        <Download className="mr-2 h-4 w-4" />
                        {isUpscaling ? t('upscaling') : t('download')}
                     </Button>
                 </div>
            </div>
        </Dialog>
    );
};

export default ShareMenu;