export interface Scene {
  image_prompt: string;
  caption_text: string;
}

export interface GeneratedAsset {
  videoUrl: string;
  audioUrl: string;
  caption: string;
}

export interface AssetBlobs {
    videoBlob: Blob;
    audioBlob: Blob;
    caption: string;
}

export interface HistoryItem {
  id?: number;
  script: string;
  assets: AssetBlobs[];
  createdAt: Date;
}

export interface HistoryItemWithAssets extends HistoryItem {
    id: number;
}


// This allows us to extend the global Window interface
declare global {
  // Fix: Moved AIStudio interface into `declare global` to prevent type conflicts.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    webkitAudioContext: {
        new(contextOptions?: AudioContextOptions): AudioContext;
    }
  }
}
