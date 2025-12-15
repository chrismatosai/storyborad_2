import React, { MouseEvent, MutableRefObject, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Node, ScriptData, ScriptScene, CharacterData, SettingData } from '../../types/graph';
import { Handle } from './Handle';
// Importamos el parser desde la carpeta utils en la raíz (subimos 2 niveles)
import { parseScriptCSV } from '../../utils/scriptParser'; 

// --- SUBCOMPONENT: Expanded Text Editor (Modal) ---
const ExpandedEditor = ({ 
    isOpen, 
    onClose, 
    initialText, 
    onSave, 
    title 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    initialText: string; 
    onSave: (text: string) => void;
    title: string;
}) => {
    const [text, setText] = useState(initialText);
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 w-full max-w-3xl rounded-xl border border-purple-500/50 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-3 bg-purple-900/20 border-b border-purple-500/30 flex justify-between items-center">
                    <span className="font-bold text-purple-300 flex items-center gap-2">
                        📝 Editing: <span className="text-white">{title}</span>
                    </span>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <textarea 
                    className="w-full h-[60vh] bg-black/20 p-4 text-sm text-gray-200 focus:outline-none resize-none font-mono leading-relaxed"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Describe the scene in detail..."
                    autoFocus
                />
                <div className="p-3 border-t border-gray-800 bg-gray-900 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded text-xs text-gray-400 hover:text-white">Cancel</button>
                    <button 
                        onClick={() => { onSave(text); onClose(); }}
                        className="px-6 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- SUBCOMPONENT: Setting Selector (Checkboxes) ---
const SettingSelector = ({ connectedSettings, selectedId, onSelect }: { 
    connectedSettings: Node<SettingData>[], 
    selectedId: string | undefined, 
    onSelect: (id: string | undefined) => void 
}) => {
  if (!connectedSettings || connectedSettings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 ml-2 mt-1">
      {connectedSettings.map((setting, index) => {
        const isSelected = selectedId === setting.id;
        return (
          <label 
            key={setting.id}
            className={`
              flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] cursor-pointer transition-all select-none
              ${isSelected 
                ? 'bg-green-900/50 border-green-500 text-green-200' 
                : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-500'
              }
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <input 
                type="checkbox" 
                checked={isSelected}
                onChange={() => onSelect(isSelected ? undefined : setting.id)}
                className="hidden"
            />
            <span className="text-green-400">
                {isSelected ? '☑' : '☐'}
            </span>
            <span className="max-w-[60px] truncate">
                Setting {index + 1}
            </span>
          </label>
        );
      })}
    </div>
  );
};

interface SceneModuleProps {
  nodeId: string;
  scene: ScriptScene;
  index: number;
  toggleSceneExpanded: (sceneId: string) => void;
  deleteScene: (nodeId: string, sceneId: string) => void;
  updateSceneDescription: (sceneId: string, newDescription: string) => void;
  updateSceneSetting: (sceneId: string, settingId: string | undefined) => void;
  connectedSettings: Node<SettingData>[];
  onConnectorMouseDown: (e: MouseEvent<HTMLDivElement>, nodeId: string, outputId: string) => void;
  connectorRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onOpenEditor: (sceneId: string, text: string, title: string) => void;
}

const SceneModule: React.FC<SceneModuleProps> = ({
  nodeId,
  scene,
  index,
  toggleSceneExpanded,
  deleteScene,
  updateSceneDescription,
  updateSceneSetting,
  connectedSettings,
  onConnectorMouseDown,
  connectorRefs,
  onOpenEditor,
}) => {
  
  return (
    <div className="bg-gray-700/60 rounded-lg border border-gray-600/50 relative group/scene mb-2 visible">
      {/* Scene Header */}
      <div className="flex justify-between items-start p-2 relative bg-gray-800/50">
        <div className="flex flex-col gap-1 flex-grow min-w-0">
            <div className="flex items-center gap-2">
                <span className="font-bold text-[10px] text-purple-400 uppercase tracking-wide">
                    Scene {index + 1}
                </span>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onOpenEditor(scene.id, scene.description, scene.title); }}
                    className="ml-2 text-gray-500 hover:text-purple-400 font-bold text-xs"
                    title="Expand Editor"
                >
                    ⤢
                </button>

                <div 
                    onClick={() => toggleSceneExpanded(scene.id)}
                    className="cursor-pointer text-gray-400 hover:text-white text-[10px] ml-1"
                >
                    {scene.isExpanded ? '▼' : '▶'}
                </div>
            </div>
            
            {/* SETTING SELECTOR (Checkboxes) */}
            <SettingSelector 
                connectedSettings={connectedSettings}
                selectedId={scene.selectedSettingId}
                onSelect={(id) => updateSceneSetting(scene.id, id)}
            />
        </div>

        <div className="flex items-center gap-1 ml-2">
            <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    deleteScene(nodeId, scene.id);
                }}
                className="p-1 rounded-full hover:bg-red-800/50 text-gray-400 hover:text-white transition-colors opacity-0 group-hover/scene:opacity-100"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>

        {/* Output Handle */}
        <div
          className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 z-50 group"
        >
          <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-black/50 px-1 rounded">
            {scene.title}
          </span>
          <Handle
            type="output"
            ref={(el) => {
              const key = `output-${nodeId}-${scene.id}`;
              if (el) connectorRefs.current[key] = el;
              else delete connectorRefs.current[key];
            }}
            onMouseDown={(e) => onConnectorMouseDown(e, nodeId, scene.id)}
          />
        </div>
      </div>

      {scene.isExpanded && (
        <div className="p-2 bg-gray-900/30 border-t border-gray-600/50">
          <textarea
            className="w-full bg-transparent text-xs text-gray-300 focus:text-white focus:outline-none focus:bg-gray-800/50 resize-y border border-transparent focus:border-gray-600 rounded p-1 transition-all"
            value={scene.description}
            onChange={(e) => updateSceneDescription(scene.id, e.target.value)}
            placeholder="Describe action..."
            rows={3}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

interface ScriptNodeProps {
  node: Node<ScriptData>;
  updateNodeData: (nodeId: string, data: Partial<ScriptData>) => void;
  connectedNodes: Node[];
  addScene: (nodeId: string) => void;
  deleteScene: (nodeId: string, sceneId: string) => void;
  connectorRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onConnectorMouseDown: (e: MouseEvent<HTMLDivElement>, nodeId: string, outputId: string | number) => void;
  onConnectorMouseUp: (e: MouseEvent<HTMLDivElement>, nodeId: string, inputIndex: number) => void;
  onDisconnectInput: (nodeId: string, inputIndex: number) => void;
}

export const ScriptNode = React.memo(({
  node,
  updateNodeData,
  connectedNodes,
  addScene,
  deleteScene,
  connectorRefs,
  onConnectorMouseDown,
  onConnectorMouseUp,
  onDisconnectInput
}: ScriptNodeProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [editorState, setEditorState] = useState<{ isOpen: boolean; sceneId: string; text: string; title: string } | null>(null);

  // Filtering connected nodes based on type
  const connectedCharacter = connectedNodes.find(n => n.type === 'CHARACTER') as Node<CharacterData> | undefined;
  const connectedSettings = connectedNodes.filter(n => n.type === 'SETTING') as Node<SettingData>[];

  const processCSV = (text: string) => {
      // Usamos el parser que creamos en utils
      const newScenes = parseScriptCSV(text, node.id);
      if (newScenes.length > 0) {
          updateNodeData(node.id, { scenes: newScenes });
          setPasteText(""); 
          setShowPaste(false);
      } else {
          alert("No valid scenes found. Check CSV format.");
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSV(text);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const toggleSceneExpanded = (sceneId: string) => {
    const newScenes = node.data.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, isExpanded: !scene.isExpanded } : scene
    );
    updateNodeData(node.id, { scenes: newScenes });
  };

  const updateSceneDescription = (sceneId: string, newDescription: string) => {
    const newScenes = node.data.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, description: newDescription } : scene
    );
    updateNodeData(node.id, { scenes: newScenes });
  };

  const updateSceneSetting = (sceneId: string, settingId: string | undefined) => {
    const newScenes = node.data.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, selectedSettingId: settingId } : scene
    );
    updateNodeData(node.id, { scenes: newScenes });
  };

  return (
    <div className="p-3 space-y-3">
      {/* GLOBAL ASSETS INPUTS */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 text-xs">
          {/* Character Input */}
          <div className={`relative flex-1 p-2 rounded border transition-colors ${connectedCharacter ? 'border-blue-500/50 bg-blue-900/20' : 'border-gray-600 bg-gray-800/30'}`}>
             <Handle
                type="input"
                style={{ left: '-12px' }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                ref={(el) => {
                    const key = `input-${node.id}-0`;
                    if (el) connectorRefs.current[key] = el;
                    else delete connectorRefs.current[key];
                }}
                isConnected={!!connectedCharacter}
                onMouseUp={(e) => onConnectorMouseUp(e, node.id, 0)}
                onDisconnect={() => onDisconnectInput(node.id, 0)}
             />
            <div className="flex items-center gap-2 ml-2">
                <span className="text-blue-400 font-bold">Character</span>
                {connectedCharacter ? (
                    <span className="text-gray-300 truncate flex-1">{connectedCharacter.data.prompt || 'Linked'}</span>
                ) : (
                    <span className="text-gray-500 italic">None</span>
                )}
            </div>
          </div>

          {/* Setting Input (Multi-capable) */}
          <div className={`relative flex-1 p-2 rounded border transition-colors ${connectedSettings.length > 0 ? 'border-green-500/50 bg-green-900/20' : 'border-gray-600 bg-gray-800/30'}`}>
             <Handle
                type="input"
                style={{ left: '-12px' }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                ref={(el) => {
                    const key = `input-${node.id}-1`;
                    if (el) connectorRefs.current[key] = el;
                    else delete connectorRefs.current[key];
                }}
                isConnected={connectedSettings.length > 0}
                onMouseUp={(e) => onConnectorMouseUp(e, node.id, 1)}
                onDisconnect={() => onDisconnectInput(node.id, 1)}
             />

            <div className="flex items-center gap-2 ml-2">
                <span className="text-green-400 font-bold">Settings ({connectedSettings.length})</span>
                {connectedSettings.length === 0 && <span className="text-gray-500 italic">None</span>}
            </div>
          </div>
        </div>
      </div>
      
      {/* IMPORT TOOLS */}
      <div className="flex flex-col gap-2 border-b border-gray-700 pb-2">
          <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Script Tools</span>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setShowPaste(!showPaste)}
                        className={`text-[10px] px-2 py-1 rounded flex gap-1 items-center transition-colors ${showPaste ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        📝 Paste CSV
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded flex gap-1 items-center transition-colors"
                    >
                        📂 Upload CSV
                    </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.txt" />
          </div>

          {/* Paste Area */}
          {showPaste && (
              <div className="bg-black/30 p-2 rounded border border-purple-500/30 animate-in fade-in slide-in-from-top-2 duration-200">
                  <textarea 
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full h-24 bg-gray-900 text-xs text-gray-300 p-1 rounded border border-gray-700 focus:border-purple-500 mb-1 font-mono"
                    placeholder={`Scene 1, A dark room...\nScene 2, Exterior day...`}
                  />
                  <button 
                    onClick={() => processCSV(pasteText)}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold py-1 rounded"
                  >
                      Process CSV (Skip Header)
                  </button>
              </div>
          )}
      </div>

      {/* SCENES LIST */}
      <div className="space-y-2 mt-2">
        {node.data.scenes.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs italic border border-dashed border-gray-700 rounded">
                No scenes yet. <br/>Paste CSV or Upload.
            </div>
        ) : (
            node.data.scenes.map((scene, index) => (
            <SceneModule
                key={scene.id}
                nodeId={node.id}
                scene={scene}
                index={index}
                toggleSceneExpanded={toggleSceneExpanded}
                deleteScene={deleteScene}
                updateSceneDescription={updateSceneDescription}
                updateSceneSetting={updateSceneSetting}
                connectedSettings={connectedSettings}
                onConnectorMouseDown={onConnectorMouseDown}
                connectorRefs={connectorRefs}
                onOpenEditor={(id, txt, title) => setEditorState({ isOpen: true, sceneId: id, text: txt, title })}
            />
            ))
        )}
      </div>

      <button
        onClick={() => addScene(node.id)}
        className="w-full mt-1 p-2 text-xs font-bold text-purple-200 bg-purple-900/30 hover:bg-purple-900/50 rounded border border-purple-800 border-dashed flex items-center justify-center gap-2 transition-colors"
      >
        + Add Scene Manually
      </button>

      {/* Modal Render */}
      {editorState && (
        <ExpandedEditor 
            isOpen={editorState.isOpen}
            initialText={editorState.text}
            title={editorState.title}
            onClose={() => setEditorState(null)}
            onSave={(newText) => updateSceneDescription(editorState.sceneId, newText)}
        />
      )}
    </div>
  );
});