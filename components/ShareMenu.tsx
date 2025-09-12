
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useStore } from '../store';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Twitter, Facebook, Copy, Download } from 'lucide-react';
import toast from 'react-hot-toast';

// Helper to convert data URL to Blob for clipboard API
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
    const res = await fetch(dataurl);
    return res.blob();
}

const ShareMenu: React.FC = () => {
    const { isShareMenuOpen, closeShareMenu, shareContent } = useStore();

    if (!isShareMenuOpen || !shareContent) return null;

    const { url, type, title } = shareContent;
    const shareText = `Check out this hairstyle I created with Barber Booth Pro!`;
    const projectUrl = "https://github.com/google-gemini-v2/codestrela/tree/main/barber-booth";

    const handleCopy = async () => {
        if (type === 'image') {
            try {
                if (!navigator.clipboard?.write) throw new Error("Clipboard API not supported");
                const blob = await dataURLtoBlob(url);
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                toast.success('Image copied to clipboard!');
            } catch (error) {
                console.error('Failed to copy image:', error);
                toast.error('Could not copy image. Please download it instead.');
            }
        } else {
            toast.error('Cannot copy video. Please download it to share.');
        }
    };
    
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `barber-booth-pro-${type === 'image' ? title.toLowerCase() : 'video'}.${type === 'image' ? 'jpg' : 'mp4'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const socialLinks = [
        { name: 'Twitter', icon: Twitter, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(projectUrl)}` },
        { name: 'Facebook', icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(projectUrl)}` },
    ];

    return (
        <Dialog isOpen={isShareMenuOpen} onClose={closeShareMenu} title={`Share ${title}`} className="w-full max-w-md">
            <div className="flex flex-col gap-4">
                {type === 'image' ? (
                    <img src={url} alt={title} className="w-full rounded-lg object-cover aspect-square" />
                ) : (
                    <video src={url} controls autoPlay loop muted className="w-full rounded-lg" />
                )}
                <p className="text-sm text-center text-neutral-400">
                    To share on social media, please download the file first, then upload it in your post.
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
                        {type === 'image' ? 'Copy Image' : 'Copy (Not supported)'}
                     </Button>
                     <Button onClick={handleDownload} variant="primary">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                     </Button>
                 </div>
            </div>
        </Dialog>
    );
};

export default ShareMenu;
