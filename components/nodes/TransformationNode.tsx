
import React, { useState } from 'react';
import { Node, TransformationData } from '../../types/graph';
import { enrichSceneDescription } from '../../services/promptArchitect';

interface TransformationNodeProps {
  node: Node<TransformationData>;
  updateNodeData: (nodeId: string, data: Partial<TransformationData>) => void;
}

export const TransformationNode = React.memo(({ node, updateNodeData }: TransformationNodeProps) => {
  const [isJsonViewOpen, setIsJsonViewOpen] = useState(false);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(node.id, { modificationPrompt: e.target.value });
  };

  const processTransformation = async () => {
    if (!node.data.modificationPrompt.trim()) return;

    updateNodeData(node.id, { isProcessing: true });
    try {
      // Reuse scene enricher to convert modification request into structured JSON
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
          placeholder="e.g., Change time of day to sunset, make the character smile..."
          value={node.data.modificationPrompt || ''}
          onChange={handlePromptChange}
          onBlur={processTransformation} // Trigger processing on blur
          rows={3}
        />
      </div>

      {/* Status & JSON Output */}
      <div className="bg-gray-900/50 rounded border border-gray-700 overflow-hidden">
        <div 
            onClick={() => setIsJsonViewOpen(!isJsonViewOpen)}
            className="px-2 py-1 bg-gray-800/50 flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors"
        >
            <span className="text-[10px] font-bold text-gray-400 uppercase">Spec JSON</span>
             {node.data.isProcessing ? (
                <svg className="animate-spin h-3 w-3 text-pink-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                 <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isJsonViewOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            )}
        </div>
        
        {isJsonViewOpen && (
            <div className="p-2 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                 {node.data.transformationJson ? (
                    <pre className="text-[10px] text-pink-300 font-mono whitespace-pre-wrap">
                        {JSON.stringify(node.data.transformationJson, null, 2)}
                    </pre>
                 ) : (
                    <div className="text-center text-[10px] text-gray-500 py-2 italic">
                        {node.data.isProcessing ? 'Generating JSON...' : 'No JSON generated yet.'}
                    </div>
                 )}
            </div>
        )}
      </div>
    </div>
  );
});
