
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
    // prioritize transformation json if active
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

  // Logic to trigger regeneration of the Cinematic JSON
  // By clearing the enrichedSceneJson and setting status to idle, 
  // the global useConnectionEnricher hook will perceive this node as "needing enrichment" 
  // and trigger the API call again.
  const handleRegenerateSpecs = useCallback(() => {
    updateNodeData(node.id, {
        enrichedSceneJson: null,
        sceneEnrichmentStatus: 'idle'
    });
  }, [node.id, updateNodeData]);

  // Determine if we are in transformation mode with valid data
  const isTransformationMode = node.data.mode === 'transformation' && node.data.incomingTransformationData;
  const hasReferenceImage = node.data.incomingTransformationData?.referenceImage;

  return (
    <div className="p-3 space-y-2 relative min-w-[280px]">
        
        {/* Persistent Output Handle - RENDERED UNCONDITIONALLY */}
        <div
          className="absolute group z-50"
          style={{
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
             <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-black/60 px-1 rounded">
                Image Output
            </span>
            <Handle
                type="output"
                ref={(el) => {
                  const key = `output-${node.id}-0`; // Index 0 for 'image'
                  if (el) connectorRefs.current[key] = el;
                  else delete connectorRefs.current[key];
                }}
                onMouseDown={(e) => onConnectorMouseDown(e, node.id, 0)}
                className="shadow-md"
            />
        </div>

        {/* Debug Button (Visible if trace exists) */}
        {node.data.debugTrace && (
            <button
                onClick={(e) => { e.stopPropagation(); setShowDebug(true); }}
                className={`absolute top-2 left-2 z-20 p-1.5 rounded transition-all ${
                    node.data.error 
                    ? 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-900/20 animate-pulse' 
                    : 'bg-gray-800 text-gray-400 hover:text-white opacity-70 hover:opacity-100'
                }`}
                title={node.data.error ? "Debug Error Details" : "View Generation Trace"}
            >
                {node.data.error ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                )}
            </button>
        )}

        {/* Debug Inspector Portal */}
        {showDebug && node.data.debugTrace && (
            <ErrorInspector trace={node.data.debugTrace} onClose={() => setShowDebug(false)} />
        )}

      {/* Image Display Logic - Strictly Decoupled from Connections */}
      {node.data.image ? (
        // STATE A: Image Exists
        <div className="relative w-full min-h-[250px] rounded-md border border-gray-600 border-solid overflow-hidden shadow-sm group bg-black">
            <img
                src={`data:image/png;base64,${node.data.image}`}
                alt="Generated scene"
                className={`w-full h-full object-cover min-h-[250px] ${node.data.isLoading ? 'opacity-50 blur-[1px] grayscale-[50%]' : ''} transition-all duration-300 cursor-pointer`}
                onClick={() => setShowLightbox(true)}
            />
            
            {/* Overlay Spinner if regenerating while image exists */}
            {node.data.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/80 shadow-sm"></div>
                </div>
            )}

            {/* Expand Button */}
            <button
                onClick={(e) => {
                e.stopPropagation();
                setShowLightbox(true);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
                title="Expand Image"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
            </button>
        </div>
      ) : (
        // STATE B: Placeholder / Loading (Only shown if NO image exists)
        <div className="relative w-full min-h-[250px] rounded-md border border-gray-600 border-dashed bg-gray-700/30 flex justify-center items-center flex-col gap-2 select-none">
             {node.data.isLoading ? (
                 <>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 z-10"></div>
                    <span className="text-xs animate-pulse font-semibold text-yellow-500 z-10">Generating Scene...</span>
                    <div className="absolute inset-0 bg-yellow-900/10 animate-pulse"></div>
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

      {/* Lightbox Portal */}
      {showLightbox && node.data.image && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button 
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <img 
            src={`data:image/png;base64,${node.data.image}`}
            alt="Full size scene" 
            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>,
        document.body
      )}

      {/* Generate Button */}
      <button
        onClick={() => onGenerate(node)}
        disabled={
            node.data.isLoading ||
            (!node.data.prompt && !node.data.enrichedSceneJson && !isTransformationMode)
        }
        className={`w-full font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm ${
            isTransformationMode ? 'bg-pink-600 hover:bg-pink-700' : 'bg-yellow-600 hover:bg-yellow-700'
        } text-white`}
      >
        {node.data.isLoading ? 'Generating...' : (isTransformationMode ? 'Run Transformation' : 'Generate Image')}
      </button>

      {/* Error Message */}
      {node.data.error && (
        <div 
            onClick={(e) => { e.stopPropagation(); setShowDebug(true); }}
            className="mt-2 p-2 bg-red-900/30 border border-red-500/50 rounded cursor-pointer hover:bg-red-900/50 transition-colors flex items-center justify-between gap-2 group"
            title="Click to view error details and debug trace"
        >
             <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-red-400 text-lg shrink-0">⚠️</span>
                <span className="text-red-200 text-xs truncate select-none">{node.data.error}</span>
             </div>
             <div className="text-red-400 bg-red-950/50 px-2 py-1 rounded text-[10px] font-bold uppercase border border-red-500/30 group-hover:border-red-400 group-hover:text-red-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Debug
             </div>
        </div>
      )}

      {/* Collapsible JSON Prompt Display */}
      <div 
        onClick={() => setIsPromptOpen(!isPromptOpen)}
        className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white py-1 select-none"
      >
         <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform duration-200 ${isPromptOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-semibold flex items-center gap-2">
             {isTransformationMode ? 'Transformation Inputs' : (node.data.enrichedSceneJson ? 'Scene Spec (JSON)' : 'Final Prompt')}
             {isTransformationMode && hasReferenceImage && (
                 <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
             )}
          </span>
      </div>

      {isPromptOpen && (
        <div className="relative group/json bg-gray-950 rounded-md border border-gray-700 overflow-hidden">
          {/* Action Bar: Show only if CinematicInspector isn't taking over, or for non-JSON prompts */}
          {(!node.data.enrichedSceneJson && (node.data.prompt || isTransformationMode)) && (
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button 
                    onClick={handleCopyJson}
                    className={`p-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-600'}`}
                    title="Copy JSON to Clipboard"
                >
                    {isCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                    )}
                </button>
              </div>
          )}

          {/* Reactive JSON Content */}
          {(() => {
            if (isTransformationMode && node.data.incomingTransformationData) {
                 const { json, referenceImage } = node.data.incomingTransformationData;
                 return (
                    <div className="bg-pink-950/10 border-l-2 border-pink-500">
                        <div className="px-3 py-2 bg-pink-900/20 border-b border-pink-700/30 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-pink-300 uppercase tracking-wider">Transformation Mode</span>
                                {referenceImage ? (
                                     <span className="text-green-400 flex items-center gap-1 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-500/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-[9px] font-semibold">Linked</span>
                                     </span>
                                ) : (
                                     <span className="text-yellow-400 flex items-center gap-1 bg-yellow-900/30 px-1.5 py-0.5 rounded border border-yellow-500/30" title="Reference image missing from source node">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-[9px] font-semibold">Missing Ref</span>
                                     </span>
                                )}
                             </div>

                             {referenceImage && (
                                 <div className="relative group/thumb cursor-help">
                                     <img 
                                        src={`data:image/png;base64,${referenceImage}`} 
                                        className="w-6 h-6 object-cover rounded border border-pink-500/50 hover:scale-150 transition-transform"
                                        alt="Ref"
                                     />
                                     <div className="absolute bottom-full right-0 mb-2 hidden group-hover/thumb:block bg-gray-900 border border-gray-600 p-1 rounded z-50 shadow-xl pointer-events-none">
                                        <img src={`data:image/png;base64,${referenceImage}`} className="w-32 h-32 object-cover rounded-sm" />
                                     </div>
                                 </div>
                             )}
                        </div>
                        <div className="bg-gray-900/50 border-b border-pink-900/20 px-3 py-1 flex justify-between">
                             <span className="text-[9px] text-gray-500 uppercase">Modification Spec</span>
                        </div>
                        <pre className="p-3 text-[10px] text-pink-200 font-mono overflow-auto max-h-[200px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {json ? JSON.stringify(json, null, 2) : "Waiting for transformation parameters..."}
                        </pre>
                    </div>
                 );
            }
            if (node.data.sceneEnrichmentStatus === 'loading') {
                return (
                  <div className="p-4 flex items-center justify-center gap-2 text-yellow-500/80 text-xs font-mono min-h-[80px]">
                       <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      <span className="animate-pulse">Generating Scene Spec...</span>
                  </div>
                );
            }
            if (node.data.sceneEnrichmentStatus === 'error') {
                return (
                    <div className="p-3 text-red-400 text-xs font-mono min-h-[60px] flex items-center">
                        <div className="flex flex-col gap-1">
                            <span>Error generating scene JSON.</span>
                            <button 
                                onClick={handleRegenerateSpecs}
                                className="text-[10px] text-yellow-400 hover:underline text-left"
                            >
                                🔄 Try Again
                            </button>
                        </div>
                    </div>
                );
            }
            if (node.data.enrichedSceneJson) {
                return (
                    <CinematicInspector 
                        data={node.data.enrichedSceneJson as CinematicJSON}
                        onRegenerate={handleRegenerateSpecs}
                        className="w-full border-none rounded-none border-b border-gray-800"
                    />
                );
            }
             if (node.data.prompt) {
                return (
                    <pre className="p-3 text-[10px] text-blue-300 font-mono overflow-auto max-h-[200px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {node.data.prompt}
                    </pre>
                );
            }
            return (
                <div className="p-3 text-gray-500 text-xs italic font-mono min-h-[60px] flex items-center justify-center text-center">
                    Connect a script scene or transformation node to generate the cinematic specification.
                </div>
            );
          })()}
        </div>
      )}
    </div>
  );
});
