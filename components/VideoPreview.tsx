/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent } from './ui/card';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui/button';
import { Download, X, AlertTriangle, Share2, Move3d, Video } from 'lucide-react';
import { useStore } from '../store';
import { attemptShare } from '../lib/shareUtils';
import InteractiveVideoPlayer from './InteractiveVideoPlayer';

type VideoStatus = 'generating' | 'done' | 'error';

interface VideoPreviewProps {
    status: VideoStatus;
    progressMessage: string;
    videoUrl: string | null;
    error: string;
    onClear: () => void;
}

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 text-red-400">
        <AlertTriangle className="h-10 w-10" />
        <p className="mt-2 text-sm font-semibold">Video Generation Failed</p>
        <p className="mt-1 text-xs text-neutral-400 px-2 leading-snug max-w-md mx-auto">{message}</p>
    </div>
);

const VideoPreview: React.FC<VideoPreviewProps> = ({ status, progressMessage, videoUrl, error, onClear }) => {
    const { openShareMenu } = useStore();
    const [isInteractive, setIsInteractive] = useState(false);

    const handleDownload = () => {
        if (!videoUrl) return;
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = 'barber-booth-pro-360.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleShare = () => {
        if (!videoUrl) return;
        attemptShare(
            { url: videoUrl, title: '360 Video', type: 'video' },
            () => openShareMenu({ url: videoUrl, title: '360 Video', type: 'video' })
        );
    };

    return (
        <Card className={cn(status === 'error' && 'border-red-500/50')}>
            <CardContent className="p-4">
                <div className="w-full bg-neutral-900 shadow-inner flex-grow relative aspect-square group rounded-md overflow-hidden">
                    {status === 'generating' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                            <LoadingSpinner />
                            <p className="text-neutral-300 font-medium">{progressMessage}</p>
                            <p className="text-xs text-neutral-500">(This can take a few minutes)</p>
                        </div>
                    )}
                    {status === 'error' && <ErrorDisplay message={error} />}
                    {status === 'done' && videoUrl && (
                        isInteractive ? (
                            <InteractiveVideoPlayer videoUrl={videoUrl} />
                        ) : (
                            <video src={videoUrl} controls autoPlay loop muted className="w-full h-full object-contain" />
                        )
                    )}

                    <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status === 'done' && videoUrl && (
                            <>
                                <Button onClick={() => setIsInteractive(!isInteractive)} variant="secondary" size="icon" title={isInteractive ? "Standard Player" : "Interactive 3D Player"}>
                                    {isInteractive ? <Video className="h-4 w-4" /> : <Move3d className="h-4 w-4" />}
                                </Button>
                                <Button onClick={handleShare} variant="secondary" size="icon" title="Share"><Share2 className="h-4 w-4" /></Button>
                                <Button onClick={handleDownload} variant="secondary" size="icon" title="Download"><Download className="h-4 w-4" /></Button>
                            </>
                        )}
                        <Button onClick={onClear} variant="secondary" size="icon" title="Close"><X className="h-4 w-4" /></Button>
                    </div>
                </div>
                 <p className="text-center font-semibold text-sm mt-3 text-neutral-200">360° Video Preview</p>
            </CardContent>
        </Card>
    );
};

export default VideoPreview;