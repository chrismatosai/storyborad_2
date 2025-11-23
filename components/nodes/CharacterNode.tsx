import React, { useState } from 'react';
import { Node, CharacterData } from '../../types/graph';
import { fileToBase64 } from '../../utils/file';
import { analyzeCharacterImage } from '../../services/geminiService';
import { CharacterPassport } from '../../types/cinematicSchema';

interface CharacterNodeProps {
  node: Node<CharacterData>;
  updateNodeData: (nodeId: string, data: Partial<CharacterData>) => void;
}

// Internal component to visualize the Biometric Profile (Visual DNA)
const PassportInspector = ({ passport }: { passport: CharacterPassport }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (!passport) return null;
    
    return (
        <div className="mt-2 bg-gray-900/80 rounded border border-blue-500/30 overflow-hidden shadow-inner">
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-blue-900/20 text-xs font-bold text-blue-300 hover:bg-blue-900/40 transition-colors"
            >
                <span className="flex items-center gap-2">🧬 Biometric ID</span>
                <span>{isOpen ? '▼' : '▶'}</span>
            </button>
            
            {isOpen && (
                <div className="p-2 space-y-3 text-[10px] text-gray-300 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {/* Facial Composite */}
                    <div className="flex flex-col gap-1">
                         <span className="text-blue-400 uppercase font-bold border-b border-blue-500/20 pb-0.5">Facial Structure</span>
                         <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                            <div className="flex flex-col"><span className="text-gray-500">Shape</span><span className="text-gray-100">{passport.facialCompositeProfile.faceShape}</span></div>
                            <div className="flex flex-col"><span className="text-gray-500">Skin</span><span className="text-gray-100">{passport.facialCompositeProfile.skinTone}</span></div>
                            <div className="flex flex-col"><span className="text-gray-500">Eyes</span><span className="text-gray-100">{passport.facialCompositeProfile.eyes.color} / {passport.facialCompositeProfile.eyes.shape}</span></div>
                            <div className="flex flex-col"><span className="text-gray-500">Nose</span><span className="text-gray-100">{passport.facialCompositeProfile.nose.shape}</span></div>
                            <div className="flex flex-col col-span-2"><span className="text-gray-500">Mouth</span><span className="text-gray-100">{passport.facialCompositeProfile.mouth.shape}, {passport.facialCompositeProfile.mouth.expression}</span></div>
                         </div>
                    </div>
                    
                    {/* Visual DNA */}
                    {passport.visual_dna && (
                        <div className="flex flex-col gap-1">
                            <span className="text-blue-400 uppercase font-bold border-b border-blue-500/20 pb-0.5">Visual DNA</span>
                            <div className="mt-1 space-y-1">
                                <div><span className="text-gray-500 font-semibold">Body:</span> {passport.visual_dna.body}</div>
                                <div><span className="text-gray-500 font-semibold">Style:</span> {passport.visual_dna.clothing}</div>
                            </div>
                        </div>
                    )}

                     <div className="pt-1 border-t border-gray-700 text-right">
                        <span className="text-gray-500 text-[9px]">ID: {passport.character_id}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

export const CharacterNode = React.memo(({ node, updateNodeData }: CharacterNodeProps) => {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      
      // 1. Update visual immediately
      updateNodeData(node.id, { image: base64 });

      // 2. Trigger AI Analysis
      setIsAnalyzing(true);
      try {
        console.log("👁️ Character Node: Analyzing image for biometric profile...");
        const passport = await analyzeCharacterImage(base64);
        
        if (passport) {
             updateNodeData(node.id, { 
                image: base64,
                prompt: passport.description, // Fill the description/prompt field
                characterPassport: passport   // Store structural data
             });
             setIsDescriptionOpen(true); // Auto-open description to show result
        }
      } catch (error) {
          console.error("Error analyzing character:", error);
      } finally {
          setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Image Area with Overlay */}
      <div className="relative w-full h-40 bg-gray-900 rounded border border-gray-700 overflow-hidden group shadow-sm hover:border-blue-500/50 transition-colors">
           {node.data.image ? (
              <img src={node.data.image} className="w-full h-full object-cover" alt="Character" />
          ) : (
               <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Upload Reference</span>
              </div>
          )}
          
          {/* Hidden File Input */}
           <label className="absolute inset-0 cursor-pointer flex items-center justify-center hover:bg-black/20 transition-colors" title="Click to upload character image">
               <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
           </label>

           {/* Analysis Loading Overlay */}
           {isAnalyzing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm cursor-wait">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                  <span className="animate-pulse text-blue-400 font-bold text-xs tracking-wide">Analyzing Visual DNA...</span>
              </div>
          )}
      </div>

      {/* Description Area */}
      <div className="flex flex-col gap-1">
           <div 
              onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
              className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white select-none"
          >
              <span className="text-[10px] uppercase font-bold tracking-wider">Description</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform duration-200 ${isDescriptionOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
           </div>
           
           {isDescriptionOpen && (
              <textarea
                  className="w-full bg-gray-900/50 text-gray-300 text-xs p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors resize-y font-sans leading-relaxed"
                  rows={3}
                  value={node.data.prompt || ''}
                  onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
                  placeholder={isAnalyzing ? "AI is writing description..." : "Character description (auto-generated or manual)..."}
                  disabled={isAnalyzing}
              />
           )}
      </div>

      {/* Biometric Profile Inspector */}
      {node.data.characterPassport && (
          <PassportInspector passport={node.data.characterPassport} />
      )}
      
    </div>
  );
});