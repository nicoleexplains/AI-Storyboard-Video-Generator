import React, { useState, useCallback, useEffect } from 'react';
import { Scene, GeneratedAsset, HistoryItemWithAssets } from './types';
import { parseScriptIntoScenes, generateVideoForScene, generateAudioForScene } from './services/geminiService';
import * as db from './utils/db';
import ScriptInput from './components/ScriptInput';
import VideoPlayer from './components/VideoPlayer';
import Loader from './components/Loader';
import ApiKeySelector from './components/ApiKeySelector';
import HistoryPanel from './components/HistoryPanel';

const App: React.FC = () => {
  const [script, setScript] = useState<string>('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItemWithAssets[]>([]);
  const [view, setView] = useState<'generator' | 'history'>('generator');

  const checkApiKey = useCallback(async () => {
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      const keyStatus = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(keyStatus);
      return keyStatus;
    }
    setHasApiKey(true); 
    return true;
  }, []);

  const loadHistory = useCallback(async () => {
    const items = await db.getAllCreations();
    setHistory(items);
  }, []);

  useEffect(() => {
    checkApiKey();
    loadHistory();
  }, [checkApiKey, loadHistory]);
  
    // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      generatedAssets.forEach(asset => {
        URL.revokeObjectURL(asset.videoUrl);
        URL.revokeObjectURL(asset.audioUrl);
      });
    };
  }, [generatedAssets]);

  const handleReset = () => {
    setScript('');
    setScenes([]);
    setGeneratedAssets([]);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setIsFinished(false);
    setView('generator');
  };

  const handleGeneration = async (userScript: string) => {
    setIsLoading(true);
    setError(null);
    setIsFinished(false);
    setGeneratedAssets([]);

    let parsedScenes: Scene[] = [];
    const assetsForPlayer: GeneratedAsset[] = [];

    try {
        setLoadingMessage('Parsing your story into scenes...');
        parsedScenes = await parseScriptIntoScenes(userScript);
        if (!parsedScenes || parsedScenes.length === 0) {
            throw new Error("Could not parse the script into scenes. Please try rephrasing.");
        }
        setScenes(parsedScenes);

        const assetsForDb: { videoBlob: Blob; audioBlob: Blob; caption: string; }[] = [];

        for (let i = 0; i < parsedScenes.length; i++) {
            const scene = parsedScenes[i];
            const sceneProgressText = `scene ${i + 1}/${parsedScenes.length}`;
            
            setLoadingMessage(`Generating video for ${sceneProgressText}: "${scene.image_prompt}"`);
            const videoBlob = await generateVideoForScene(scene.image_prompt, (progress) => {
                setLoadingMessage(`Video for ${sceneProgressText}: ${progress}`);
            });
            
            setLoadingMessage(`Creating narration for ${sceneProgressText}...`);
            const audioBlob = await generateAudioForScene(scene.caption_text, (progress) => {
                setLoadingMessage(`Narration for ${sceneProgressText}: ${progress}`);
            });

            assetsForPlayer.push({
                videoUrl: URL.createObjectURL(videoBlob),
                audioUrl: URL.createObjectURL(audioBlob),
                caption: scene.caption_text
            });
            assetsForDb.push({ videoBlob, audioBlob, caption: scene.caption_text });
            setGeneratedAssets([...assetsForPlayer]);
        }
        
        await db.addCreation({
          script: userScript,
          assets: assetsForDb,
          createdAt: new Date(),
        });
        await loadHistory(); // Refresh history list

        setIsFinished(true);
    } catch (err: any) {
        console.error(err);
        let finalErrorMessage = err.message || 'An unknown error occurred during generation.';

        // Attempt to parse a more specific error from a stringified JSON body
        try {
            const jsonStartIndex = finalErrorMessage.indexOf('{');
            if (jsonStartIndex !== -1) {
                const jsonString = finalErrorMessage.substring(jsonStartIndex);
                const parsedError = JSON.parse(jsonString);
                if (parsedError.error && parsedError.error.message) {
                    finalErrorMessage = parsedError.error.message;
                }
            }
        } catch (e) {
            // Parsing failed, stick with the message we have
        }
        
        const currentSceneIndex = assetsForPlayer.length;
        if (parsedScenes.length > 0 && currentSceneIndex < parsedScenes.length) {
            const failedScene = parsedScenes[currentSceneIndex];
            finalErrorMessage = `Failed on scene ${currentSceneIndex + 1} ("${failedScene.caption_text}"): ${finalErrorMessage}`;
        }

        setError(finalErrorMessage);
        if (finalErrorMessage.includes('Requested entity was not found')) {
            setError('Your API key is invalid. Please select a valid key and try again.');
            setHasApiKey(false);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const loadFromHistory = (item: HistoryItemWithAssets) => {
    const assets = item.assets.map(asset => ({
        videoUrl: URL.createObjectURL(asset.videoBlob),
        audioUrl: URL.createObjectURL(asset.audioBlob),
        caption: asset.caption,
    }));
    setGeneratedAssets(assets);
    setIsFinished(true);
    setView('generator');
    setError(null);
  }

  const deleteFromHistory = async (id: number) => {
    await db.deleteCreation(id);
    await loadHistory();
  }
  
  const renderContent = () => {
    if (!hasApiKey) {
      return <ApiKeySelector onKeySelected={() => setHasApiKey(true)} />;
    }

    if (view === 'history') {
        return <HistoryPanel history={history} onLoad={loadFromHistory} onDelete={deleteFromHistory} />;
    }

    if (isLoading) {
      return <Loader message={loadingMessage} />;
    }
    if (error) {
      return (
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Generation Failed</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={handleReset}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    if (isFinished) {
      return <VideoPlayer assets={generatedAssets} onFinish={handleReset} />;
    }
    return <ScriptInput onGenerate={handleGeneration} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            AI Storyboard Video Generator
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Turn your text into a narrated visual story.</p>
           <div className="mt-4">
              <button
                onClick={() => setView(view === 'generator' ? 'history' : 'generator')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                {view === 'generator' ? 'View History' : 'Create New Video'}
              </button>
            </div>
        </header>
        <main className="bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 min-h-[50vh] flex items-center justify-center">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;