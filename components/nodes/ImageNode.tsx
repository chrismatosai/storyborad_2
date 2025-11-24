import React, { useState, MutableRefObject, MouseEvent, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Node, ImageData } from '../../types/graph';
import { ErrorInspector } from '../ui/ErrorInspector';
import { CinematicInspector } from '../ui/CinematicInspector';
import { CinematicJSON } from '../../types/cinematicSchema';
import { Handle } from './Handle';

interface ImageNodeProps {
  node: Node<ImageData>;
  updateNodeData: (nodeId: string, data: Partial<ImageData>) => void;
  onGenerate: (node: Node<ImageData>) => void;
  connectorRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onConnectorMouseDown: (e: MouseEvent<HTMLDivElement>, nodeId: string, outputId: string | number) => void;
}

export const ImageNode = React.memo(({ node, onGenerate, updateNodeData, connectorRefs, onConnectorMouseDown }: ImageNodeProps) => {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if (node.data.mode === 'transformation' && node.data.incomingTransformationData?.json) {
        textToCopy = JSON.stringify(node.data.incomingTransformationData.json, null, 2);
    } else {
        textToCopy = node.data.prompt || '';
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleRegenerateSpecs = useCallback(() => {
    updateNodeData(node.id, {
        enrichedSceneJson: null,
        sceneEnrichmentStatus: 'idle'
    });
  }, [node.id, updateNodeData]);

  const isTransformationMode = node.data.mode === 'transformation' && node.data.incomingTransformationData;
  const hasReferenceImage = node.data.incomingTransformationData?.referenceImage;
  
  // Estado "Listo": Ya sea enriquecimiento exitoso O datos de transformación válidos
  const isSceneReady = node.data.sceneEnrichmentStatus === 'success' || (isTransformationMode && !!node.data.incomingTransformationData?.json);

  return (
    <div className="p-3 space-y-2 relative min-w-[280px]">
        
        {/* Output Handle */}
        <div className="absolute group z-50" style={{ right: '-12px', top: '50%', transform: 'translateY(-50%)' }}>
             <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-black/60 px-1 rounded">Image Output</span>
            <Handle
                type="output"
                ref={(el) => {
                  const key = `output-${node.id}-0`;
                  if (el) connectorRefs.current[key] = el;
                  else delete connectorRefs.current[key];
                }}
                onMouseDown={(e) => onConnectorMouseDown(e, node.id, 0)}
                className="shadow-md"
            />
        </div>

        {/* Debug Button */}
        {node.data.debugTrace && (
            <button
                onClick={(e) => { e.stopPropagation(); setShowDebug(true); }}
                className={`absolute top-2 left-2 z-20 p-1.5 rounded transition-all ${
                    node.data.error ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-white opacity-70 hover:opacity-100'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </button>
        )}

        {/* Debug Inspector Portal */}
        {showDebug && node.data.debugTrace && (
            <ErrorInspector trace={node.data.debugTrace} onClose={() => setShowDebug(false)} />
        )}

      {/* Image Display */}
      {node.data.image ? (
        <div className="relative w-full min-h-[250px] rounded-md border border-gray-600 border-solid overflow-hidden shadow-sm group bg-black">
            <img
                src={`data:image/png;base64,${node.data.image}`}
                alt="Generated scene"
                className={`w-full h-full object-cover min-h-[250px] ${node.data.isLoading ? 'opacity-50 blur-[1px]' : ''} cursor-pointer`}
                onClick={() => setShowLightbox(true)}
            />
            {node.data.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/80"></div>
                </div>
            )}
        </div>
      ) : (
        <div className="relative w-full min-h-[250px] rounded-md border border-gray-600 border-dashed bg-gray-700/30 flex justify-center items-center flex-col gap-2 select-none">
             {node.data.isLoading ? (
                 <>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 z-10"></div>
                    <span className="text-xs animate-pulse font-semibold text-yellow-500 z-10">Generating Scene...</span>
                 </>
             ) : (
                 <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium opacity-60">
                        {isTransformationMode ? 'Ready for Transformation' : 'Waiting for Input...'}
                    </span>
                 </>
             )}
        </div>
      )}

      {/* Lightbox */}
      {showLightbox && node.data.image && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <img src={`data:image/png;base64,${node.data.image}`} className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
        </div>,
        document.body
      )}

      {/* Generate Button */}
      <button
        onClick={() => onGenerate(node)}
        disabled={node.data.isLoading || (!node.data.prompt && !node.data.enrichedSceneJson && !isTransformationMode)}
        className={`w-full font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm ${
            isTransformationMode ? 'bg-pink-600 hover:bg-pink-700' : 'bg-yellow-600 hover:bg-yellow-700'
        } text-white`}
      >
        {node.data.isLoading ? 'Generating...' : (isTransformationMode ? 'Run Transformation' : 'Generate Image')}
      </button>

      {/* Error Message */}
      {node.data.error && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-500/50 rounded flex items-center gap-2 text-red-200 text-xs">
             <span>⚠️ {node.data.error}</span>
        </div>
      )}

      {/* Collapsible JSON Prompt Display */}
      <div 
        onClick={() => setIsPromptOpen(!isPromptOpen)}
        className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white py-1 select-none border-t border-gray-700 pt-2"
      >
         <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isPromptOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <div className="flex items-center gap-2 w-full">
             <span className="text-xs font-semibold">
                {isTransformationMode ? 'Transformation Inputs' : (node.data.enrichedSceneJson ? 'Scene Spec (JSON)' : 'Final Prompt')}
             </span>
             
             {/* 🟢 GREEN STATUS INDICATOR */}
             {isSceneReady && (
                 <span className="flex h-2 w-2 relative ml-auto mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
             )}
          </div>
      </div>

      {isPromptOpen && (
        <div className="relative bg-gray-950 rounded-md border border-gray-700 overflow-hidden">
          {/* Copy Button Logic */}
          {(!node.data.enrichedSceneJson && !isTransformationMode) && (
              <div className="absolute top-2 right-2 z-10">
                <button onClick={handleCopyJson} className="p-1.5 bg-gray-800 text-gray-300 rounded hover:text-white text-xs">
                    {isCopied ? "✅" : "📋"}
                </button>
              </div>
          )}

          {(() => {
            // MODO TRANSFORMACIÓN: Renderizado Rico
            if (isTransformationMode && node.data.incomingTransformationData) {
                 const { json } = node.data.incomingTransformationData;
                 if (json) {
                     // AQUÍ ESTÁ EL CAMBIO: Usar CinematicInspector en lugar de <pre>
                     return (
                        <div className="bg-pink-950/10 border-l-2 border-pink-500">
                            <CinematicInspector 
                                data={json as CinematicJSON}
                                className="border-none rounded-none bg-transparent"
                            />
                        </div>
                     );
                 }
            }
            // MODO STANDARD
            if (node.data.sceneEnrichmentStatus === 'loading') {
                return <div className="p-4 text-yellow-500/80 text-xs font-mono text-center animate-pulse">Generating Scene Spec...</div>;
            }
            if (node.data.sceneEnrichmentStatus === 'error') {
                return (
                    <div className="p-3 text-red-400 text-xs font-mono flex flex-col gap-2">
                        <span>Error generating JSON.</span>
                        <button onClick={handleRegenerateSpecs} className="text-yellow-400 underline">Try Again</button>
                    </div>
                );
            }
            if (node.data.enrichedSceneJson) {
                return <CinematicInspector data={node.data.enrichedSceneJson as CinematicJSON} onRegenerate={handleRegenerateSpecs} className="border-none rounded-none" />;
            }
             if (node.data.prompt) {
                return <pre className="p-3 text-[10px] text-blue-300 font-mono overflow-auto max-h-[200px] custom-scrollbar">{node.data.prompt}</pre>;
            }
            return <div className="p-3 text-gray-500 text-xs italic text-center">Waiting for input...</div>;
          })()}
        </div>
      )}
    </div>
  );
});