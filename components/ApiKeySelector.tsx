
import React, { useState } from 'react';

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      setIsOpening(true);
      try {
        await window.aistudio.openSelectKey();
        // Assume success and notify the parent component to re-check.
        onKeySelected();
      } catch (error) {
        console.error("Error opening API key selection:", error);
      } finally {
        setIsOpening(false);
      }
    } else {
        alert("API key selection is not available in this environment.");
    }
  };

  return (
    <div className="text-center p-8 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-4">API Key Required</h2>
      <p className="text-gray-300 mb-6">
        Video generation with Veo requires a Google AI API key. Please select a key to continue.
        This feature may incur costs.
      </p>
      <div className="flex flex-col items-center space-y-4">
        <button
          onClick={handleSelectKey}
          disabled={isOpening}
          className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          {isOpening ? 'Opening Dialog...' : 'Select API Key'}
        </button>
        <a
          href="https://ai.google.dev/gemini-api/docs/billing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-400 hover:text-indigo-300 underline"
        >
          Learn more about billing
        </a>
      </div>
    </div>
  );
};

export default ApiKeySelector;
