
import React, { useState } from 'react';
import { Node, SettingData } from '../../types/graph';
import { fileToBase64 } from '../../utils/file';
import { analyzeSettingImage } from '../../services/geminiService';
import { CinematicInspector } from '../ui/CinematicInspector';

interface SettingNodeProps {
  node: Node<SettingData>;
  updateNodeData: (nodeId: string, data: Partial<SettingData>) => void;
}

export const SettingNode = React.memo(({ node, updateNodeData }: SettingNodeProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  return (
    <div className="p-3 space-y-3">
      
      {/* IMAGE ZONE */}
      <div className="relative w-full h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden group">
          {node.data.image ? (
              <img src={node.data.image} className="w-full h-full object-cover" alt="Setting Ref" />
          ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs flex-col gap-2">
                  <span>🖼️</span>
                  <span>Upload Setting</span>
              </div>
          )}
          <input type="file" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
          
          {isAnalyzing && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <span className="animate-pulse text-green-400 font-bold text-xs">Analyzing Style...</span>
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
              placeholder="AI will describe the environment..."
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
