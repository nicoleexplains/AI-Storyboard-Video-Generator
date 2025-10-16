import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene } from '../types';
import { decode, pcmToWavBlob } from '../utils/audio';

const createApiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const apiCallWithRetry = async <T>(
    apiCall: () => Promise<T>,
    onProgress: (message: string) => void,
    maxRetries = 3,
    initialDelay = 5000 // Start with a longer delay for generative models
): Promise<T> => {
    let attempt = 0;
    let delay = initialDelay;

    while (attempt <= maxRetries) {
        try {
            return await apiCall();
        } catch (error: any) {
            const isRateLimitError = error.message && (error.message.includes('429') || error.message.toLowerCase().includes('resource_exhausted'));

            if (isRateLimitError && attempt < maxRetries) {
                attempt++;
                onProgress(`Rate limit reached. Retrying attempt ${attempt}/${maxRetries} in ${delay / 1000}s...`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
            } else {
                throw error; // Re-throw if not a rate limit error or max retries are exceeded
            }
        }
    }
    throw new Error('Max retries exceeded.'); // Should not be reached
};


export const parseScriptIntoScenes = async (script: string): Promise<Scene[]> => {
    const ai = createApiClient();
    const model = 'gemini-2.5-pro';
    
    const prompt = `Parse the following script into distinct scenes. Each scene corresponds to a single continuous action. For each scene, create a highly descriptive and vivid visual prompt suitable for a cinematic AI video generator. The prompt should be detailed, specifying style, lighting, and composition where possible (e.g., 'cinematic shot', 'golden hour lighting', 'wide angle'). Also, extract the original text for the scene to be used as a caption. Ensure the caption text is verbatim. Return a JSON array of objects with 'image_prompt' and 'caption_text' keys.

    Example:
    Script: "The rocket stood on the launchpad, steaming in the cold morning air. With a final countdown, it roared to life, ascending into the bright blue sky."
    Output: [
        {"image_prompt": "Cinematic wide shot of a tall, futuristic rocket on a launchpad at dawn. The air is cold, with steam billowing dramatically around its base. The lighting is soft, early morning light.", "caption_text": "The rocket stood on the launchpad, steaming in the cold morning air."},
        {"image_prompt": "Dynamic, low-angle shot of the powerful rocket ascending rapidly into a clear, bright blue sky, leaving a thick trail of white smoke. Lens flare from the sun.", "caption_text": "With a final countdown, it roared to life, ascending into the bright blue sky."}
    ]
    
    Now, parse this script:
    "${script}"`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_prompt: {
                            type: Type.STRING,
                            description: "A concise, visually descriptive prompt for an AI video generator."
                        },
                        caption_text: {
                            type: Type.STRING,
                            description: "The original text from the script for this scene."
                        }
                    },
                    required: ["image_prompt", "caption_text"],
                },
            },
        },
    });

    try {
        const jsonString = response.text;
        return JSON.parse(jsonString) as Scene[];
    } catch (e) {
        console.error("Failed to parse scenes from script:", e);
        throw new Error("The AI failed to structure the story into scenes. Please try a different script.");
    }
};

export const generateVideoForScene = async (prompt: string, onProgress: (message: string) => void): Promise<Blob> => {
    const ai = createApiClient();
    const POLLING_INTERVAL_MS = 5000;
    const TIMEOUT_MS = 300000; // 5 minutes
    let elapsedTime = 0;

    const initialApiCall = () => ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });

    let operation = await apiCallWithRetry(initialApiCall, onProgress);

    while (!operation.done) {
        if (elapsedTime >= TIMEOUT_MS) {
            throw new Error("Video generation timed out after 5 minutes.");
        }
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        elapsedTime += POLLING_INTERVAL_MS;

        operation = await ai.operations.getVideosOperation({ operation: operation });
        
        if (operation.error) {
            throw new Error(`Video generation operation failed: ${operation.error.message}`);
        }
    }

    if (operation.error) {
        throw new Error(`Video generation operation failed: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation may have succeeded, but no download link was provided. This can happen if the prompt is rejected by a safety filter.");
    }
    
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!videoResponse.ok) {
        const errorBody = await videoResponse.text();
        throw new Error(`Failed to download video. Status: ${videoResponse.statusText}. Details: ${errorBody}`);
    }
    
    return videoResponse.blob();
};

export const generateAudioForScene = async (text: string, onProgress: (message: string) => void): Promise<Blob> => {
    const ai = createApiClient();

    const apiCall = () => ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' }, // English male voice
                },
            },
        },
    });
    
    const response = await apiCallWithRetry(apiCall, onProgress);

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Audio generation failed: no audio data received.");
    }

    const audioBytes = decode(base64Audio);
    const audioBlob = pcmToWavBlob(audioBytes, 24000, 1, 16);
    return audioBlob;
};