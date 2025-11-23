import React, { useState, memo } from 'react';
import { Node, VideoData } from '../../types/graph';
import { Handle } from './Handle';
import { VideoPrompt } from '../../types/videoSchema';

interface VideoNodeProps { 
    node: Node<VideoData>; 
    updateNodeData: (nodeId: string, data: Partial<VideoData>) => void; 
    onGenerate?: (node: Node) => void; 
    connectorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>; 
    onConnectorMouseDown: (e: React.MouseEvent, nodeId: string, outputId: string | number) => void; 
}

export const VideoNode = memo(({ node, updateNodeData, onGenerate, connectorRefs, onConnectorMouseDown }: VideoNodeProps) => { 
const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');

const hasStart = !!node.data.startImage; 
const hasEnd = !!node.data.endImage; 
const isReady = hasStart || hasEnd; // Al menos una imagen para generar

return (
<div className="w-full">
  {/* HEADER */}
  <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-900/50 to-transparent rounded-t-lg">
    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
        🎥 Veo 3.1 Director
    </span>
    <div className="flex gap-1">
        <button onClick={() => setActiveTab('preview')} className={`px-2 py-0.5 text-[10px] rounded ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Vis</button>
        <button onClick={() => setActiveTab('json')} className={`px-2 py-0.5 text-[10px] rounded ${activeTab === 'json' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>JSON</button>
    </div>
  </div>
  {/* CONTENT */}
  <div className="p-3 space-y-3">
    
    {activeTab === 'preview' && (
        <div className="flex gap-2 h-24">
            {/* Start Frame Preview */}
            <div className="flex-1 bg-black/40 rounded border border-blue-900/30 flex flex-col items-center justify-center overflow-hidden relative">
                {node.data.startImage ? (
                    <img src={`data:image/png;base64,${node.data.startImage}`} className="w-full h-full object-cover opacity-80" />
                ) : (
                    <span className="text-[9px] text-blue-500/50">Start Frame</span>
                )}
                <div className="absolute bottom-0 left-0 bg-blue-600/80 text-white text-[8px] px-1">T=0s</div>
            </div>
            {/* Arrow Animation */}
            <div className="flex items-center justify-center text-gray-600">
                ➜
            </div>
            {/* End Frame Preview */}
            <div className="flex-1 bg-black/40 rounded border border-purple-900/30 flex flex-col items-center justify-center overflow-hidden relative">
                {node.data.endImage ? (
                    <img src={`data:image/png;base64,${node.data.endImage}`} className="w-full h-full object-cover opacity-80" />
                ) : (
                    <span className="text-[9px] text-purple-500/50">End Frame</span>
                )}
                <div className="absolute bottom-0 right-0 bg-purple-600/80 text-white text-[8px] px-1">T=8s</div>
            </div>
        </div>
    )}
    {activeTab === 'json' && (
        <div className="h-24 bg-black/50 rounded border border-gray-700 p-2 overflow-auto custom-scrollbar">
            {node.data.promptSchema ? (
                <pre className="text-[8px] text-green-300 font-mono leading-tight">
                    {JSON.stringify(node.data.promptSchema, null, 2)}
                </pre>
            ) : (
                <div className="text-center text-gray-500 text-[10px] italic pt-4">
                    Esperando generación del Prompt...
                </div>
            )}
        </div>
    )}
    {/* CONTROLS */}
    <button
        onClick={() => onGenerate && onGenerate(node)}
        disabled={!isReady || node.data.isLoading}
        className={`w-full py-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-2
            ${isReady 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
        `}
    >
        {node.data.isLoading ? (
            <>
                <span className="animate-spin">⚙️</span> Generando Video...
            </>
        ) : (
            <>🎬 Generar Prompt VEO</>
        )}
    </button>
  </div>
  {/* OUTPUT HANDLE (Derecha) */}
  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-50" title="Video Output">
     <Handle 
        type="output" 
        ref={(el) => {
            const key = `output-${node.id}-0`; 
            if (el) connectorRefs.current[key] = el;
            else delete connectorRefs.current[key];
        }}
        onMouseDown={(e) => onConnectorMouseDown(e, node.id, 0)}
        className="border-green-500 bg-green-400" 
     />
  </div>
</div>
); });