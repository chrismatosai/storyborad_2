import React, { useState, useEffect } from 'react';
import { Node, TransformationData } from '../../types/graph';
import { transformCinematicSpec } from '../../services/promptArchitect'; // <--- Usamos la nueva función inteligente
import { CinematicInspector } from '../ui/CinematicInspector';
import { CinematicJSON } from '../../types/cinematicSchema';

interface TransformationNodeProps {
  node: Node<TransformationData>;
  updateNodeData: (nodeId: string, data: Partial<TransformationData>) => void;
}

export const TransformationNode = React.memo(({ node, updateNodeData }: TransformationNodeProps) => {
  const [isPromptOpen, setIsPromptOpen] = useState(true);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(node.id, { modificationPrompt: e.target.value });
  };

  const processTransformation = async () => {
    if (!node.data.modificationPrompt.trim()) return;
    
    // Validación: Necesitamos una fuente para transformar
    if (!node.data.sourceJson) {
        console.warn("Transformation Node: No source JSON to transform. Connect an Image Node first.");
        return;
    }

    updateNodeData(node.id, { isProcessing: true });
    try {
      // Usamos la nueva lógica que mezcla Original + Cambios
      const resultJson = await transformCinematicSpec(
          node.data.sourceJson as CinematicJSON, 
          node.data.modificationPrompt
      );
      
      updateNodeData(node.id, { 
        isProcessing: false, 
        transformationJson: resultJson 
      });
    } catch (error) {
      console.error("Transformation processing failed:", error);
      updateNodeData(node.id, { isProcessing: false });
    }
  };

  const isReady = !!node.data.transformationJson;

  return (
    <div className="p-3 space-y-3">
      
      {/* HEADER: Reference Status */}
      <div className={`flex items-center gap-2 p-2 rounded border ${node.data.sourceJson ? 'bg-green-900/20 border-green-600/50' : 'bg-gray-800 border-gray-700 border-dashed'}`}>
         {node.data.referenceImage ? (
             <img 
                src={`data:image/png;base64,${node.data.referenceImage}`} 
                alt="Ref" 
                className="w-8 h-8 object-cover rounded border border-green-500/50"
             />
         ) : (
             <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center text-gray-600 text-[8px]">Ref?</div>
         )}
         <div className="flex-1 min-w-0">
            <span className={`block text-[10px] font-bold ${node.data.sourceJson ? 'text-green-400' : 'text-gray-500'}`}>
                {node.data.sourceJson ? 'LINKED & READY' : 'WAITING FOR INPUT'}
            </span>
            <span className="text-[9px] text-gray-400 truncate block">
                {node.data.sourceJson ? 'Source Scene Data Loaded' : 'Connect Image Node...'}
            </span>
         </div>
      </div>

      {/* INPUT: Modification Prompt */}
      <div>
        <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-bold text-pink-400 uppercase">Transformation Request</label>
            {node.data.isProcessing && <span className="text-[9px] text-pink-300 animate-pulse">Processing...</span>}
        </div>
        <textarea
          className="w-full p-2 bg-gray-900/50 rounded border border-pink-500/30 focus:border-pink-500 focus:outline-none text-xs text-gray-300 resize-y font-mono"
          placeholder="e.g., Change lighting to cyberpunk neon, make it rain..."
          value={node.data.modificationPrompt || ''}
          onChange={handlePromptChange}
          onBlur={processTransformation} // Trigger on blur
          rows={3}
        />
      </div>

      {/* OUTPUT: Spec Inspector */}
      <div className="bg-gray-950 rounded border border-pink-900/50 overflow-hidden">
        <div 
            onClick={() => setIsPromptOpen(!isPromptOpen)}
            className="flex justify-between items-center px-2 py-1.5 bg-pink-900/20 border-b border-pink-700/30 cursor-pointer hover:bg-pink-900/30 transition-colors"
        >
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-pink-300 uppercase">Target Spec</span>
                {/* 🟢 GREEN STATUS DOT */}
                {isReady && (
                    <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                    </span>
                )}
            </div>
            <span className="text-pink-500 text-[10px]">{isPromptOpen ? '▼' : '▶'}</span>
        </div>
        
        {isPromptOpen && (
            <div>
                 {node.data.transformationJson ? (
                    <CinematicInspector 
                        data={node.data.transformationJson as CinematicJSON} 
                        className="border-none rounded-none bg-transparent"
                    />
                 ) : (
                    <div className="text-center text-[10px] text-gray-600 py-4 italic">
                        {node.data.isProcessing ? 'Architecting new scene...' : 'Waiting for prompt...'}
                    </div>
                 )}
            </div>
        )}
      </div>
    </div>
  );
});