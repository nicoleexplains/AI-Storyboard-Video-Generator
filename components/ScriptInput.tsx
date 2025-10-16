
import React, { useState } from 'react';

interface ScriptInputProps {
  onGenerate: (script: string) => void;
}

const ScriptInput: React.FC<ScriptInputProps> = ({ onGenerate }) => {
  const [script, setScript] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (script.trim()) {
      onGenerate(script.trim());
    }
  };
  
  const placeholderText = `Example:
The ancient library was silent, dust motes dancing in the single sunbeam. 
A lone scholar turned a fragile page, uncovering a map of forgotten stars. 
Following the celestial chart, she sailed across a silver sea, towards an island shrouded in mist.`;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={placeholderText}
          className="w-full h-64 p-4 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-200 placeholder-gray-500 resize-none"
        />
        <button
          type="submit"
          disabled={!script.trim()}
          className="self-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Generate Video
        </button>
      </form>
    </div>
  );
};

export default ScriptInput;
