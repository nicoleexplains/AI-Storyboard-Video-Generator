import React, { useState, useEffect, useRef } from 'react';
import { GeneratedAsset } from '../types';

interface VideoPlayerProps {
  assets: GeneratedAsset[];
  onFinish: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ assets, onFinish }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (assets.length > 0 && videoRef.current && audioRef.current) {
      const currentAsset = assets[currentSceneIndex];
      videoRef.current.src = currentAsset.videoUrl;
      audioRef.current.src = currentAsset.audioUrl;
      
      videoRef.current.load();
      audioRef.current.load();

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(_ => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
          }
        }).catch(error => {
          console.error("Video play failed:", error);
        });
      }
    }
  }, [currentSceneIndex, assets]);

  const handleVideoEnd = () => {
    if (currentSceneIndex < assets.length - 1) {
      setCurrentSceneIndex(currentSceneIndex + 1);
    } else {
      // Loop back to the beginning
      setCurrentSceneIndex(0);
    }
  };

  const handleDownloadAudio = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadMessage('Preparing audio for download...');

    try {
        const audioBlobs = await Promise.all(
            assets.map(asset => fetch(asset.audioUrl).then(res => res.blob()))
        );

        const fullAudioBlob = new Blob(audioBlobs, { type: 'audio/wav' });

        const url = URL.createObjectURL(fullAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-storyboard-audio.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        console.error("Audio download failed", e);
        setDownloadMessage('Audio export failed. Please try again.');
        setTimeout(() => setDownloadMessage(''), 3000);
    } finally {
        setIsDownloading(false);
        setDownloadMessage('');
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadMessage('Starting export...');

    try {
        const videoElement = document.createElement('video');
        videoElement.muted = true;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        setDownloadMessage('Fetching video and audio assets...');
        const audioBlobs = await Promise.all(assets.map(asset => fetch(asset.audioUrl).then(res => res.blob())));
        
        // This is a simplified merge - it just concatenates blobs.
        // A true merge requires decoding and re-encoding for seamless playback.
        const fullAudioBlob = new Blob(audioBlobs, { type: 'audio/wav' });
        const fullAudioUrl = URL.createObjectURL(fullAudioBlob);
        
        const audio = new Audio(fullAudioUrl);

        const firstVideoBlob = await fetch(assets[0].videoUrl).then(res => res.blob());
        const tempVideoUrl = URL.createObjectURL(firstVideoBlob);
        
        videoElement.src = tempVideoUrl;
        await new Promise(resolve => { videoElement.onloadedmetadata = resolve; });
        URL.revokeObjectURL(tempVideoUrl);

        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const stream = canvas.captureStream(30);
        const audioContext = new AudioContext();
        const audioDestination = audioContext.createMediaStreamDestination();
        const source = audioContext.createMediaElementSource(audio);
        source.connect(audioDestination);
        
        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);
        
        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        recorder.onstop = () => {
            const finalBlob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ai-storyboard-video.webm';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            URL.revokeObjectURL(fullAudioUrl);
            setIsDownloading(false);
            setDownloadMessage('');
        };

        recorder.start();
        audio.play();
        
        for (let i = 0; i < assets.length; i++) {
            setDownloadMessage(`Exporting scene ${i + 1}/${assets.length}...`);
            const videoBlob = await fetch(assets[i].videoUrl).then(res => res.blob());
            const url = URL.createObjectURL(videoBlob);
            videoElement.src = url;

            await videoElement.play();

            await new Promise<void>(resolve => {
                const onTimeUpdate = () => {
                    if (ctx) {
                       ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    }
                };

                const onEnded = () => {
                    videoElement.removeEventListener('timeupdate', onTimeUpdate);
                    videoElement.removeEventListener('ended', onEnded);
                    URL.revokeObjectURL(url);
                    resolve();
                }

                videoElement.addEventListener('timeupdate', onTimeUpdate);
                videoElement.addEventListener('ended', onEnded);
            });
        }
        
        recorder.stop();
        audio.pause();
        audioContext.close();

    } catch (e) {
        console.error("Download failed", e);
        setIsDownloading(false);
        setDownloadMessage('Export failed. Please try again.');
    }
  };

  if (assets.length === 0) {
    return (
      <div className="text-center p-8">
        <p>No assets to display.</p>
        <button onClick={onFinish} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Start Over</button>
      </div>
    );
  }

  const currentAsset = assets[currentSceneIndex];

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          onEnded={handleVideoEnd}
          className="w-full h-full object-cover"
          playsInline
          muted // Mute video to allow audio element to control sound
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-60">
          <p className="text-center text-lg md:text-xl font-semibold text-white">
            {currentAsset.caption}
          </p>
        </div>
      </div>
      <audio ref={audioRef} />
      <div className="text-sm text-gray-400">
        Playing scene {currentSceneIndex + 1} of {assets.length}
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4">
       <button onClick={onFinish} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Create Another Video</button>
       <button onClick={handleDownload} disabled={isDownloading} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
         {isDownloading ? 'Exporting...' : 'Download Full Video'}
        </button>
       <button onClick={handleDownloadAudio} disabled={isDownloading} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
         {isDownloading ? 'Exporting...' : 'Download Audio'}
        </button>
      </div>
      {isDownloading && <p className="text-sm text-gray-300 mt-2">{downloadMessage}</p>}
    </div>
  );
};

export default VideoPlayer;