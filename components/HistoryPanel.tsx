import React from 'react';
import { HistoryItemWithAssets } from '../types';

interface HistoryPanelProps {
  history: HistoryItemWithAssets[];
  onLoad: (item: HistoryItemWithAssets) => void;
  onDelete: (id: number) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onLoad, onDelete }) => {
  if (history.length === 0) {
    return (
      <div className="text-center text-gray-400">
        <p>You haven't created any videos yet.</p>
        <p>Your generated videos will appear here.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-h-[60vh] overflow-y-auto pr-2">
        <ul className="space-y-4">
            {history.map((item) => (
                <li key={item.id} className="bg-gray-900 p-4 rounded-lg flex items-center justify-between hover:bg-gray-700 transition-colors">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-400">{item.createdAt.toLocaleString()}</p>
                        <p className="text-white font-medium truncate" title={item.script}>
                            {item.script}
                        </p>
                    </div>
                    <div className="flex-shrink-0 ml-4 flex space-x-2">
                        <button
                            onClick={() => onLoad(item)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-md text-sm"
                        >
                            Load
                        </button>
                        <button
                            onClick={() => onDelete(item.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md text-sm"
                        >
                            Delete
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    </div>
  );
};

export default HistoryPanel;
