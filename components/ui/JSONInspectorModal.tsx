
import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface JSONInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
}

export const JSONInspectorModal: React.FC<JSONInspectorModalProps> = ({
  isOpen,
  onClose,
  title,
  data
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Usamos createPortal para que el modal flote sobre todo el resto de la UI (z-index alto)
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 w-full max-w-4xl max-h-[85vh] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕵️</span>
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">{title}</h3>
          </div>
          <div className="flex gap-2 items-center">
             <button
                onClick={handleCopy}
                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors border flex items-center gap-2 ${
                    copied
                    ? 'bg-green-900/50 text-green-400 border-green-500'
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'
                }`}
            >
                {copied ? (
                    <><span>✓</span> COPIED</>
                ) : (
                    <><span>📋</span> COPY JSON</>
                )}
            </button>
            <button 
                onClick={onClose} 
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content (Scrollable Code Block) */}
        <div className="flex-1 overflow-auto p-0 bg-[#0d1117] custom-scrollbar">
           <pre className="text-xs font-mono text-blue-300/90 leading-relaxed whitespace-pre-wrap p-4">
              {/* Usamos JSON.stringify con indentación de 2 espacios */}
              {JSON.stringify(data, null, 2)}
           </pre>
        </div>
        
        {/* Footer Context */}
        <div className="p-2 bg-gray-950 border-t border-gray-800 text-[9px] text-gray-600 font-mono flex justify-between px-4">
            <span>Format: Cinematic JSON Schema</span>
            <span>{JSON.stringify(data).length} chars</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
