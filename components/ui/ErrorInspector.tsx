import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GenerationTrace } from '../../types/graph';

interface ErrorInspectorProps {
  trace: GenerationTrace;
  onClose: () => void;
}

export const ErrorInspector: React.FC<ErrorInspectorProps> = ({ trace, onClose }) => {
  const [activeTab, setActiveTab] = useState<'inputs' | 'json' | 'error'>(
    trace.status === 'error' ? 'error' : 'json'
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getContentToCopy = () => {
    if (activeTab === 'inputs') return JSON.stringify(trace.inputs, null, 2);
    if (activeTab === 'json') return JSON.stringify(trace.architectOutput, null, 2);
    return trace.rawError || 'No error message captured.';
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 w-full max-w-2xl rounded-lg border border-gray-700 shadow-2xl flex flex-col max-h-[85vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Generation Trace Inspector</h2>
            <span className={`px-2 py-0.5 text-xs rounded font-bold uppercase ${trace.status === 'error' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                {trace.status}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900/30">
          <button
            onClick={() => setActiveTab('inputs')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex-1 ${activeTab === 'inputs' ? 'bg-gray-800 text-blue-400 border-t-2 border-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            1. Inputs
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex-1 ${activeTab === 'json' ? 'bg-gray-800 text-purple-400 border-t-2 border-purple-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            2. Architect JSON
          </button>
          <button
            onClick={() => setActiveTab('error')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex-1 ${activeTab === 'error' ? 'bg-gray-800 text-red-400 border-t-2 border-red-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            3. Error Stack
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900/50 font-mono text-sm">
            {activeTab === 'inputs' && (
                <div className="space-y-4">
                    <div>
                        <span className="block text-xs text-gray-500 mb-1">Scene Description</span>
                        <div className="p-3 bg-black/30 rounded border border-gray-700 text-gray-300 whitespace-pre-wrap break-words">
                            {trace.inputs?.sceneText || "N/A"}
                        </div>
                    </div>
                    {trace.inputs?.characterText && (
                        <div>
                            <span className="block text-xs text-gray-500 mb-1">Character Context</span>
                            <div className="p-3 bg-black/30 rounded border border-gray-700 text-gray-300 break-words">
                                {trace.inputs.characterText}
                            </div>
                        </div>
                    )}
                    {trace.inputs?.settingText && (
                        <div>
                            <span className="block text-xs text-gray-500 mb-1">Setting Context</span>
                            <div className="p-3 bg-black/30 rounded border border-gray-700 text-gray-300 break-words">
                                {trace.inputs.settingText}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'json' && (
                <div>
                     {trace.architectOutput ? (
                        <pre className="text-green-300 whitespace-pre-wrap break-all">
                            {JSON.stringify(trace.architectOutput, null, 2)}
                        </pre>
                     ) : (
                        <div className="text-gray-500 italic flex flex-col items-center justify-center h-32">
                            <span>No JSON generated yet.</span>
                            {trace.stepFailed === 'architect_json' && <span className="text-red-400 text-xs mt-2">Failed at this step.</span>}
                        </div>
                     )}
                </div>
            )}

             {activeTab === 'error' && (
                <div className="space-y-4">
                    <div>
                        <span className="block text-xs text-gray-500 mb-1">Trace Status</span>
                         <div className={`p-2 rounded inline-block ${trace.status === 'error' ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                            {trace.status.toUpperCase()}
                         </div>
                    </div>
                    {trace.stepFailed && (
                        <div>
                            <span className="block text-xs text-gray-500 mb-1">Failed Step</span>
                            <span className="text-red-400 font-bold">{trace.stepFailed}</span>
                        </div>
                    )}
                    <div>
                        <span className="block text-xs text-gray-500 mb-1">Raw Error</span>
                        <div className="p-4 bg-red-900/20 rounded border border-red-900/50 text-red-200 break-words whitespace-pre-wrap">
                            {trace.rawError || "No error recorded."}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-lg flex justify-between items-center">
             <span className="text-xs text-gray-500">
                Timestamp: {new Date(trace.timestamp).toLocaleTimeString()}
             </span>
             <div className="flex gap-2">
                <button
                    onClick={() => handleCopy(getContentToCopy())}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy {activeTab === 'inputs' ? 'Inputs' : activeTab === 'json' ? 'JSON' : 'Error'}
                </button>
             </div>
        </div>
      </div>
    </div>,
    document.body
  );
};