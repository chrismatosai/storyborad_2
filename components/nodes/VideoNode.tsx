import React, { useState, memo } from 'react';
import { Node, VideoData } from '../../types/graph';
// Nota: Ya no importamos Handle porque no hay salida

interface VideoNodeProps { 
    node: Node<VideoData>; 
    updateNodeData: (nodeId: string, data: Partial<VideoData>) => void; 
    onGenerate?: (node: Node) => void; 
    connectorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>; 
    onConnectorMouseDown: (e: React.MouseEvent, nodeId: string, outputId: string | number) => void; 
}

export const VideoNode = memo(({ node, updateNodeData, onGenerate }: VideoNodeProps) => { 
    const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
    const [copied, setCopied] = useState(false);

    const hasStart = !!node.data.startImage; 
    const hasEnd = !!node.data.endImage; 
    // Permitimos generar si hay al menos una imagen O un prompt de movimiento
    const isReady = hasStart || hasEnd || !!node.data.movementPrompt;

    const handleCopy = () => {
        if (node.data.promptSchema) {
            navigator.clipboard.writeText(JSON.stringify(node.data.promptSchema, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
    <div className="w-full min-w-[320px]">
      {/* HEADER */}
      <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-900/50 to-transparent rounded-t-lg">
        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
            🎥 Veo 3.1 Director
        </span>
        <div className="flex gap-1">
            <button onClick={() => setActiveTab('preview')} className={`px-2 py-0.5 text-[10px] rounded transition-colors ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Vis</button>
            <button onClick={() => setActiveTab('json')} className={`px-2 py-0.5 text-[10px] rounded transition-colors ${activeTab === 'json' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>JSON</button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-3 space-y-3">
        
        {/* INPUT: MOVEMENT PROMPT */}
        <div>
            <label className="block text-[10px] font-bold text-indigo-400 mb-1 uppercase">Action / Movement</label>
            <textarea
                className="w-full p-2 bg-gray-900/50 rounded border border-indigo-500/30 focus:border-indigo-500 focus:outline-none text-xs text-gray-300 resize-y"
                placeholder="Describe camera movement or action (e.g. 'Slow zoom in on face')..."
                rows={2}
                value={node.data.movementPrompt || ''}
                onChange={(e) => updateNodeData(node.id, { movementPrompt: e.target.value })}
            />
        </div>

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
            <div className="flex gap-2 h-20">
                {/* Start Frame */}
                <div className="flex-1 bg-black/40 rounded border border-blue-900/30 flex flex-col items-center justify-center overflow-hidden relative group">
                    {node.data.startImage ? (
                        <img src={`data:image/png;base64,${node.data.startImage}`} className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] text-blue-500/50">Start Frame</span>
                            <span className="text-[8px] text-gray-600">(Input 1)</span>
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 bg-blue-900/80 text-white text-[8px] px-1">0s</div>
                </div>
                
                {/* Arrow */}
                <div className="flex items-center justify-center text-gray-600 text-xs">➜</div>
                
                {/* End Frame */}
                <div className="flex-1 bg-black/40 rounded border border-purple-900/30 flex flex-col items-center justify-center overflow-hidden relative group">
                    {node.data.endImage ? (
                        <img src={`data:image/png;base64,${node.data.endImage}`} className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] text-purple-500/50">End Frame</span>
                            <span className="text-[8px] text-gray-600">(Input 2)</span>
                        </div>
                    )}
                    <div className="absolute bottom-0 right-0 bg-purple-900/80 text-white text-[8px] px-1">8s</div>
                </div>
            </div>
        )}

        {/* JSON TAB (Styled like Inspector) */}
        {activeTab === 'json' && (
            <div className="bg-gray-950 rounded border border-indigo-500/30 overflow-hidden shadow-inner">
                <div className="flex justify-between items-center px-2 py-1 bg-indigo-900/20 border-b border-indigo-500/20">
                    <span className="text-[9px] font-bold text-indigo-300 uppercase">VEO Prompt Schema</span>
                    {node.data.promptSchema && (
                        <button 
                            onClick={handleCopy}
                            className="text-[10px] bg-black/40 hover:bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded transition-all"
                        >
                            {copied ? "✅" : "📋"}
                        </button>
                    )}
                </div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-2">
                    {node.data.promptSchema ? (
                        <pre className="text-[9px] text-indigo-100 font-mono leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(node.data.promptSchema, null, 2)}
                        </pre>
                    ) : (
                        <div className="text-center text-gray-500 text-[10px] italic py-4">
                            Click Generate to build the prompt...
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* GENERATE BUTTON */}
        <button
            onClick={() => onGenerate && onGenerate(node)}
            disabled={!isReady || node.data.isLoading}
            className={`w-full py-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg
                ${isReady 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/50' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
            `}
        >
            {node.data.isLoading ? (
                <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating VEO Spec...
                </>
            ) : (
                <>✨ Generate Video Prompt</>
            )}
        </button>
      </div>
      
      {/* NO OUTPUT HANDLE - This is a terminal node */}
    </div>
    ); 
});