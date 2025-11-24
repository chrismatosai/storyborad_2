import React, { useState } from 'react';
import { Node, TransformationData } from '../../types/graph';
import { enrichSceneDescription } from '../../services/promptArchitect';

interface TransformationNodeProps {
  node: Node<TransformationData>;
  updateNodeData: (nodeId: string, data: Partial<TransformationData>) => void;
}

export const TransformationNode = React.memo(({ node, updateNodeData }: TransformationNodeProps) => {
  const [isJsonViewOpen, setIsJsonViewOpen] = useState(true); // Default open to show specs
  const [copied, setCopied] = useState(false);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(node.id, { modificationPrompt: e.target.value });
  };

  const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.data.transformationJson) {
          navigator.clipboard.writeText(JSON.stringify(node.data.transformationJson, null, 2));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const processTransformation = async () => {
    if (!node.data.modificationPrompt.trim()) return;

    updateNodeData(node.id, { isProcessing: true });
    try {
      const resultJson = await enrichSceneDescription(node.data.modificationPrompt);
      updateNodeData(node.id, { 
        isProcessing: false, 
        transformationJson: resultJson 
      });
    } catch (error) {
      console.error("Transformation processing failed:", error);
      updateNodeData(node.id, { isProcessing: false });
    }
  };

  return (
    <div className="p-3 space-y-3">
      
      {/* Reference Image Preview */}
      {node.data.referenceImage ? (
         <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700">
             <img 
                src={`data:image/png;base64,${node.data.referenceImage}`} 
                alt="Ref" 
                className="w-10 h-10 object-cover rounded border border-gray-600"
             />
             <div className="text-xs text-gray-300">
                <span className="block font-bold text-pink-300">Ref Image Linked</span>
                <span className="text-[10px] text-gray-500">Source Ready</span>
             </div>
         </div>
      ) : (
        <div className="text-xs text-gray-400 italic p-2 bg-gray-900/30 rounded border border-gray-700 border-dashed text-center">
           Connect an Image Node (Left) to set Reference.
        </div>
      )}

      {/* Modification Prompt Input */}
      <div>
        <label className="block text-xs font-bold text-gray-400 mb-1">Transformation Prompt</label>
        <textarea
          className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
          placeholder="e.g., Change time of day to sunset..."
          value={node.data.modificationPrompt || ''}
          onChange={handlePromptChange}
          onBlur={processTransformation}
          rows={3}
        />
      </div>

      {/* Unified JSON Inspector Style */}
      <div className="bg-gray-900 rounded-md border border-pink-900/50 overflow-hidden shadow-inner">
        <div 
            onClick={() => setIsJsonViewOpen(!isJsonViewOpen)}
            className="flex justify-between items-center p-2 bg-pink-900/20 border-b border-pink-700/30 cursor-pointer hover:bg-pink-900/30 transition-colors"
        >
            <span className="text-[10px] uppercase tracking-wider font-bold text-pink-400">Spec JSON</span>
            <div className="flex items-center gap-2">
                 {/* Processing Spinner */}
                 {node.data.isProcessing && (
                    <svg className="animate-spin h-3 w-3 text-pink-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                 )}
                 {/* Copy Button */}
                 {node.data.transformationJson && (
                     <button 
                        onClick={handleCopy}
                        className="text-[10px] bg-black/40 hover:bg-pink-500/20 text-pink-200 px-2 py-0.5 rounded transition-all"
                     >
                        {copied ? "✅" : "📋"}
                     </button>
                 )}
                 <span className="text-gray-500 text-[10px]">{isJsonViewOpen ? '▼' : '▶'}</span>
            </div>
        </div>
        
        {isJsonViewOpen && (
            <div className="max-h-[150px] overflow-y-auto custom-scrollbar p-2 bg-black/20">
                 {node.data.transformationJson ? (
                    <pre className="text-[10px] text-pink-100 font-mono whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(node.data.transformationJson, null, 2)}
                    </pre>
                 ) : (
                    <div className="text-center text-[10px] text-gray-500 py-4 italic">
                        {node.data.isProcessing ? 'Generating Spec...' : 'No JSON generated yet.'}
                    </div>
                 )}
            </div>
        )}
      </div>
    </div>
  );
});