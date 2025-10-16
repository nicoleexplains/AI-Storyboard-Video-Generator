
import React from 'react';

interface LoaderProps {
  message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-500 mb-6"></div>
      <h2 className="text-2xl font-bold text-white mb-2">Generating Your Story...</h2>
      <p className="text-gray-300 max-w-md">{message}</p>
      <div className="w-full bg-gray-700 rounded-full h-2.5 mt-6 max-w-md">
        <div className="bg-indigo-600 h-2.5 rounded-full animate-pulse"></div>
      </div>
       <p className="text-sm text-gray-400 mt-4">This process can take several minutes. Please be patient.</p>
    </div>
  );
};

export default Loader;
