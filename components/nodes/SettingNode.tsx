
import React, { useState } from 'react';
import { Node, SettingData } from '../../types/graph';
import { analyzeSettingImage, generateReferenceAsset } from '../../services/geminiService';
import { CinematicInspector } from '../ui/CinematicInspector';

interface SettingNodeProps {
  node: Node<SettingData>;
  updateNodeData: (nodeId: string, data: Partial<SettingData>) => void;
}

export const SettingNode = React.memo(({ node, updateNodeData }: SettingNodeProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // New State for Generator Mode
  const [inputMode, setInputMode] = useState<'upload' | 'generate'>('upload');
  const [genPrompt, setGenPrompt] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      // Update visual immediately
      updateNodeData(node.id, { image: base64 });

      setIsAnalyzing(true);
      try {
        console.log("🏙️ Analyzing setting...");
        
        // Call the setting analysis service
        const settingJSON = await analyzeSettingImage(base64);
        
        if (settingJSON) {
             // Save data
            updateNodeData(node.id, { 
                image: base64,
                prompt: settingJSON.scene_description, // For description text area
                settingPassport: settingJSON           // Complete JSON for inspector
            });
        }

      } catch (error) {
        console.error("Error analyzing setting:", error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    
    setIsAnalyzing(true);
    try {
      console.log("🏙️ Generating Setting Concept...");
      // 1. Crear Imagen (Text-to-Image)
      const base64Image = await generateReferenceAsset(genPrompt);
      updateNodeData(node.id, { image: base64Image });

      console.log("🎨 Analyzing Setting Style...");
      // 2. Extraer Estilo (Image-to-JSON)
      const settingJSON = await analyzeSettingImage(base64Image);
      
      if (settingJSON) {
          updateNodeData(node.id, { 
              image: base64Image,
              prompt: settingJSON.scene_description, // Descripción técnica
              settingPassport: settingJSON           // Datos de estilo
          });
      }
    } catch (error) {
      console.error("Setting generation failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      
      {/* Input Mode Tabs */}
      <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700 mb-2">
          <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 text-[10px] py-1 rounded-md transition-colors ${inputMode === 'upload' ? 'bg-gray-700 text-white font-bold' : 'text-gray-500 hover:text-gray-300'}`}
          >
              📁 Upload
          </button>
          <button
              onClick={() => setInputMode('generate')}
              className={`flex-1 text-[10px] py-1 rounded-md transition-colors ${inputMode === 'generate' ? 'bg-indigo-900/50 text-indigo-200 font-bold' : 'text-gray-500 hover:text-gray-300'}`}
          >
              ✨ Generate
          </button>
      </div>

      {/* IMAGE ZONE */}
      <div className="relative w-full h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden group hover:border-green-500/50 transition-colors">
          {node.data.image ? (
              <img src={node.data.image.startsWith('data:') ? node.data.image : `data:image/png;base64,${node.data.image}`} className="w-full h-full object-cover" alt="Setting Ref" />
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2 p-2 bg-gray-800/30">
                  {inputMode === 'upload' ? (
                      <>
                        <span>🖼️</span>
                        <span>Upload Setting</span>
                      </>
                  ) : (
                      <div className="w-full flex flex-col gap-2 animate-in fade-in" onClick={e => e.preventDefault()}>
                          <textarea 
                              className="w-full bg-black/50 border border-indigo-500/30 rounded p-1 text-[10px] text-gray-300 resize-none focus:outline-none focus:border-indigo-500"
                              rows={2}
                              placeholder="e.g. A dystopian city street at night..."
                              value={genPrompt}
                              onChange={(e) => setGenPrompt(e.target.value)}
                          />
                          <button 
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] py-1 rounded font-bold transition-colors"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleGenerate();
                              }}
                          >
                              Generate Style
                          </button>
                      </div>
                  )}
              </div>
          )}
          
          {/* Hidden File Input - Only active in upload mode */}
          {inputMode === 'upload' && (
             <label className="absolute inset-0 cursor-pointer flex items-center justify-center hover:bg-black/20 transition-colors" title="Click to upload setting image">
                <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
             </label>
          )}
          
          {isAnalyzing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm cursor-wait">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mb-2"></div>
                  <span className="animate-pulse text-green-400 font-bold text-xs">
                      {inputMode === 'generate' ? "Generating & Analyzing..." : "Analyzing Style..."}
                  </span>
              </div>
          )}
      </div>

      {/* DESCRIPTION ZONE */}
      <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-gray-400 font-bold">Atmospheric Description</label>
          <textarea 
              className="w-full bg-black/20 text-gray-300 text-xs p-2 rounded border border-gray-700 focus:border-green-500 transition-colors"
              rows={3}
              value={node.data.prompt || ''}
              onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
              placeholder={isAnalyzing ? "AI is writing description..." : "AI will describe the environment..."}
              disabled={isAnalyzing}
          />
      </div>

      {/* INSPECTOR ZONE */}
      {node.data.settingPassport && (
          <div className="mt-2">
              <label className="text-[10px] uppercase text-green-500 font-bold mb-1 block">Visual Style (JSON)</label>
              {/* Reusing generic inspector for generic JSON data rendering */}
              <CinematicInspector 
                  data={node.data.settingPassport as any} 
                  className="border-green-900/50" 
              />
          </div>
      )}

    </div>
  );
});
