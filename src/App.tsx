
import React, { useState, useCallback, useRef, MouseEvent, useLayoutEffect, useEffect } from 'react';
import { NodeType, Node, CharacterData, SettingData, ScriptData, ImageData, ConnectorPosition, TransformationData } from './types/graph';
import { useViewport } from './hooks/useViewport';
import { useGraphEditor } from './hooks/useGraphEditor';
import { useGeminiGenerator } from './hooks/useGeminiGenerator';
import { useSmartConnections } from './hooks/useSmartConnections';
import { useConnectionEnricher } from './hooks/useConnectionEnricher'; // Import new hook
import { enrichSceneDescription } from './services/promptArchitect'; // Import service
import { usePersistence } from './hooks/usePersistence';

// UI Components
import { BaseNode } from './components/nodes/BaseNode';
import { CharacterNode } from './components/nodes/CharacterNode';
import { SettingNode } from './components/nodes/SettingNode';
import { ScriptNode } from './components/nodes/ScriptNode';
import { ImageNode } from './components/nodes/ImageNode';
import { TransformationNode } from './components/nodes/TransformationNode';
import { NODE_CONFIG } from './components/nodes/nodeConfig';

// Main App Component
export default function App() {
  const { 
      nodes, 
      connections, 
      graph,
      actions 
  } = useGraphEditor();
  
  const [connecting, setConnecting] = useState<{ fromNodeId: string; fromOutput: string | number; toPosition: { x: number; y: number } } | null>(null);
  
  // Persistence Integration
  const { status: persistenceStatus, loadInitialData, clearStorage } = usePersistence(graph);
  
  // 🆕 Loading State
  const [isReady, setIsReady] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  // Initial Load Effect
  useEffect(() => {
    const init = async () => {
      console.log("📂 Persistence: Loading project...");
      try {
        const savedGraph = await loadInitialData();
        
        if (savedGraph && savedGraph.nodes.length > 0) {
          console.log("✅ Persistence: Project loaded.");
          actions.setGraph(savedGraph); 
        } else {
          console.log("ℹ️ Persistence: No saved project found, starting fresh.");
        }
      } catch (e) {
        console.error("❌ Persistence: Error recovering data:", e);
      } finally {
         setIsReady(true);
      }
    };
    init();
  }, [loadInitialData, actions.setGraph]);

  const { 
    viewTransform, 
    setViewTransform, 
    isPanning, 
    containerRef, 
    handlers: viewportHandlers 
  } = useViewport();

  // Use the new Gemini Generator Hook
  const { generateImage, generateAll, isGeneratingAll } = useGeminiGenerator(nodes, connections, actions.updateNodeData);

  // Use Smart Connections for Eager Enrichment (Character/Setting)
  useSmartConnections(nodes, connections, actions.updateNodeData);

  // Use Connection Enricher for Scene Description -> Image Node JSON
  useConnectionEnricher(nodes, connections, actions.updateNodeData, enrichSceneDescription);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [connectorPositions, setConnectorPositions] = useState<Record<string, ConnectorPosition>>({});

  const handleSave = () => {
    const dataToSave = JSON.stringify({ nodes, connections }, null, 2);
    const blob = new Blob([dataToSave], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'storyboard-flow.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') throw new Error("Invalid file content");
        const loadedData = JSON.parse(content);
        
        if (Array.isArray(loadedData.nodes) && Array.isArray(loadedData.connections)) {
          actions.setNodes(loadedData.nodes);
          actions.setConnections(loadedData.connections);
          setViewTransform({ x: 0, y: 0, zoom: 1 }); // Reset view on load
        } else {
          alert('Invalid JSON file format.');
        }
      } catch (error) {
        console.error("Failed to load or parse file:", error);
        alert('Failed to load file. It might be corrupted or not in the correct format.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = ''; // Allow loading the same file again
  };

  // Lógica mejorada del Reset (Sin window.confirm)
  const handleReset = async () => {
    if (!isConfirmingReset) {
      // PRIMER CLICK: Activar modo confirmación
      setIsConfirmingReset(true);
      
      // Auto-cancelar si el usuario se arrepiente y no clickea en 3 segundos
      setTimeout(() => {
        setIsConfirmingReset(false);
      }, 3000);
      return;
    }

    // SEGUNDO CLICK: Ejecutar la acción real
    console.log("🗑️ Ejecutando limpieza total...");
    await clearStorage(); // Borrar DB
    actions.setGraph({ nodes: [], connections: [] });
    setIsConfirmingReset(false); // Resetear botón
  };
  
  const checkInputConnection = useCallback((nodeId: string, inputIndex: number) => {
    return connections.some(c => c.toNodeId === nodeId && c.toInputIndex === inputIndex);
  }, [connections]);
  
  const screenToWorld = useCallback(({ x, y }: { x: number; y: number }): { x: number; y: number } => {
    if (!containerRef.current) return { x, y };
    const canvasRect = containerRef.current.getBoundingClientRect();
    const worldX = (x - canvasRect.left - viewTransform.x) / viewTransform.zoom;
    const worldY = (y - canvasRect.top - viewTransform.y) / viewTransform.zoom;
    return { x: worldX, y: worldY };
  }, [viewTransform, containerRef]);

  const onNodeMouseDown = (e: MouseEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const mouseWorldPos = screenToWorld({ x: e.clientX, y: e.clientY });
    const offset = { x: mouseWorldPos.x - node.position.x, y: mouseWorldPos.y - node.position.y };
    setDraggingNode({ id: nodeId, offset });
  };
  
  const [draggingNode, setDraggingNode] = useState<{ id: string; offset: { x: number; y: number } } | null>(null);


  const onConnectorMouseDown = (e: MouseEvent<HTMLDivElement>, nodeId: string, output: string | number) => {
    e.stopPropagation();
    setConnecting({ fromNodeId: nodeId, fromOutput: output, toPosition: { x: e.clientX, y: e.clientY } });
  };

  const onConnectorMouseUp = (e: MouseEvent<HTMLDivElement>, nodeId: string, inputIndex: number) => {
    e.stopPropagation();
    if (!connecting) return;
    
    if(connecting.fromNodeId === nodeId) {
      setConnecting(null);
      return;
    }

    actions.addConnection({
        fromNodeId: connecting.fromNodeId,
        fromOutput: connecting.fromOutput,
        toNodeId: nodeId,
        toInputIndex: inputIndex,
    });
    setConnecting(null);
  };

  const onCanvasMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    viewportHandlers.onMouseDown(e);
  };
  
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
        viewportHandlers.onMouseMove(e);
        return;
    }
    if (draggingNode) {
      const mouseWorldPos = screenToWorld({ x: e.clientX, y: e.clientY });
      const newX = mouseWorldPos.x - draggingNode.offset.x;
      const newY = mouseWorldPos.y - draggingNode.offset.y;
      actions.setNodes(prevNodes => prevNodes.map(n => n.id === draggingNode.id ? { ...n, position: { x: newX, y: newY } } : n));
    }
    if (connecting) {
      setConnecting(prev => prev ? { ...prev, toPosition: { x: e.clientX, y: e.clientY } } : null);
    }
  };

  const onMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    viewportHandlers.onMouseUp(e);
    setDraggingNode(null);
    setConnecting(null);
  };
  
  useLayoutEffect(() => {
    const newPositions: Record<string, ConnectorPosition> = {};
    if (!contentWrapperRef.current) {
        return;
    }

    Object.entries(connectorRefs.current).forEach(([key, el]) => {
      const element = el as HTMLDivElement | null;
      if (element) {
        const nodeDiv = element.closest('[data-node-id]');
        if(!nodeDiv) return;

        const nodeId = nodeDiv.getAttribute('data-node-id');
        if (!nodeId) return;
        
        const nodeRect = nodeDiv.getBoundingClientRect();
        const elRect = element.getBoundingClientRect();
        const contentRect = contentWrapperRef.current!.getBoundingClientRect();

        const nodeWorldX = (nodeRect.left - contentRect.left) / viewTransform.zoom;
        const nodeWorldY = (nodeRect.top - contentRect.top) / viewTransform.zoom;

        const elWorldX = nodeWorldX + (elRect.left - nodeRect.left + elRect.width / 2) / viewTransform.zoom;
        const elWorldY = nodeWorldY + (elRect.top - nodeRect.top + elRect.height / 2) / viewTransform.zoom;
        
        newPositions[key] = {
          nodeId,
          index: 0, 
          position: {
            x: elWorldX,
            y: elWorldY,
          }
        };
      }
    });
    
    setConnectorPositions(currentPositions => {
      if (Object.keys(newPositions).length !== Object.keys(currentPositions).length) {
        return newPositions;
      }
      for (const key in newPositions) {
        if (!currentPositions[key] || 
            newPositions[key].position.x !== currentPositions[key].position.x || 
            newPositions[key].position.y !== currentPositions[key].position.y) {
          return newPositions;
        }
      }
      return currentPositions;
    });
  }, [nodes, viewTransform, nodes.length, ...nodes.map(n => n.position.x + n.position.y + (n.type === NodeType.Script ? (n.data as ScriptData).scenes.length : 0))]); 

  const connectingToPos = connecting ? screenToWorld(connecting.toPosition) : {x:0,y:0};

  // 🆕 Loading Screen Logic
  if (!isReady) {
    return (
      <div className="w-full h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400 font-mono">Recovering your Storyboard...</p>
      </div>
    );
  }

  return (
    <div 
        className="w-screen h-screen overflow-hidden relative bg-gray-800 cursor-grab" 
        ref={containerRef} 
        onMouseMove={onMouseMove} 
        onMouseUp={onMouseUp}
        onMouseDown={onCanvasMouseDown}
        onWheel={viewportHandlers.onWheel}
    >
      {/* ... (Existing JSX) ... */}
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex gap-2 p-2 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg flex-wrap max-w-[90vw]">
        {(Object.keys(NodeType) as Array<keyof typeof NodeType>).map(key => (
          <button
            key={key as string}
            onClick={() => actions.addNode(NodeType[key])}
            className={`px-3 py-2 text-sm font-semibold rounded-md text-white ${NODE_CONFIG[NodeType[key]].color} hover:opacity-80 transition-opacity`}
          >
            Add {NODE_CONFIG[NodeType[key]].title}
          </button>
        ))}
        <div className="ml-4 pl-4 border-l border-gray-600 flex gap-2">
            <button
                onClick={handleSave}
                className="px-3 py-2 text-sm font-semibold rounded-md text-white bg-gray-600 hover:bg-gray-700 transition-colors"
            >
                Save Flow
            </button>
            <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-sm font-semibold rounded-md text-white bg-gray-600 hover:bg-gray-700 transition-colors"
            >
                Load Flow
            </button>
            <input type="file" ref={fileInputRef} onChange={handleLoad} style={{ display: 'none' }} accept=".json" />
             <button
                onClick={generateAll}
                disabled={isGeneratingAll}
                className="px-3 py-2 text-sm font-semibold rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isGeneratingAll ? 'Generating All...' : 'Generate All Scenes'}
            </button>
        </div>
      </div>

    <div
        ref={contentWrapperRef}
        style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.zoom})`,
            transformOrigin: '0 0',
        }}
    >
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{width: '1000vw', height: '1000vh'}}>
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
                </marker>
            </defs>
            {connections.map(conn => {
            const fromKey = `output-${conn.fromNodeId}-${conn.fromOutput}`;
            const toKey = `input-${conn.toNodeId}-${conn.toInputIndex}`;
            const fromPos = connectorPositions[fromKey]?.position;
            const toPos = connectorPositions[toKey]?.position;
            if (!fromPos || !toPos) return null;
            const path = `M ${fromPos.x},${fromPos.y} C ${fromPos.x + 50},${fromPos.y} ${toPos.x - 50},${toPos.y} ${toPos.x},${toPos.y}`;
            return <path key={conn.id} d={path} stroke="#6b7280" strokeWidth={2 / viewTransform.zoom} fill="none" markerEnd="url(#arrow)" />;
            })}
            {connecting && (() => {
            const fromKey = `output-${connecting.fromNodeId}-${connecting.fromOutput}`;
            const fromPos = connectorPositions[fromKey]?.position;
            if (!fromPos) return null;
            const toPos = connectingToPos;
            const path = `M ${fromPos.x},${fromPos.y} C ${fromPos.x + 50},${fromPos.y} ${toPos.x - 50},${toPos.y} ${toPos.x},${toPos.y}`;
            return <path d={path} stroke="#a78bfa" strokeWidth={2 / viewTransform.zoom} fill="none" strokeDasharray={`${5/viewTransform.zoom},${5/viewTransform.zoom}`}/>;
            })()}
        </svg>


        {nodes.map(node => {
            const config = NODE_CONFIG[node.type];
            
            return (
              <BaseNode
                key={node.id}
                node={node}
                config={config}
                onNodeMouseDown={onNodeMouseDown}
                onDelete={actions.deleteNode}
                onConnectorMouseDown={onConnectorMouseDown}
                onConnectorMouseUp={onConnectorMouseUp}
                onDisconnectInput={actions.disconnectInput}
                checkInputConnection={(index) => checkInputConnection(node.id, index)}
                connectorRefs={connectorRefs}
              >
                {node.type === NodeType.Character && (
                  <CharacterNode node={node as Node<CharacterData>} updateNodeData={actions.updateNodeData} />
                )}
                {node.type === NodeType.Setting && (
                  <SettingNode node={node as Node<SettingData>} updateNodeData={actions.updateNodeData} />
                )}
                {node.type === NodeType.Script && (
                   <ScriptNode
                     node={node as Node<ScriptData>}
                     updateNodeData={actions.updateNodeData}
                     addScene={actions.addScene}
                     deleteScene={actions.deleteScene}
                     connectorRefs={connectorRefs}
                     onConnectorMouseDown={onConnectorMouseDown}
                     onConnectorMouseUp={onConnectorMouseUp}
                     onDisconnectInput={actions.disconnectInput}
                     // Calculate all connected nodes for this script node
                     connectedNodes={
                        connections
                            .filter(c => c.toNodeId === node.id)
                            .map(c => nodes.find(n => n.id === c.fromNodeId))
                            .filter((n): n is Node => !!n)
                     }
                   />
                )}
                {node.type === NodeType.Image && (
                  <ImageNode 
                    node={node as Node<ImageData>} 
                    updateNodeData={actions.updateNodeData} 
                    onGenerate={generateImage}
                    connectorRefs={connectorRefs} 
                    onConnectorMouseDown={onConnectorMouseDown}
                  />
                )}
                {node.type === NodeType.Transformation && (
                  <TransformationNode node={node as Node<TransformationData>} updateNodeData={actions.updateNodeData} />
                )}
              </BaseNode>
            );
        })}
      </div>

      {/* Persistence Status Indicator & New Project Button */}
      <div className="absolute bottom-4 right-4 flex items-center gap-3 z-50">
        <button 
          onClick={handleReset}
          className={`
            text-xs px-3 py-1 rounded-full border transition-all duration-200 backdrop-blur-sm
            ${isConfirmingReset 
              ? 'bg-red-600 text-white border-red-400 font-bold scale-105' // Estado Alerta
              : 'bg-red-900/80 hover:bg-red-800 text-red-200 border-red-800' // Estado Normal
            }
          `}
        >
          {isConfirmingReset ? "⚠️ ¿CONFIRMAR?" : "🗑️ Nuevo Proyecto"}
        </button>

        <div className="bg-gray-800 text-white text-xs px-3 py-1 rounded-full border border-gray-700 shadow-lg flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            {persistenceStatus === 'idle' && <span className="flex items-center gap-1"><span className="text-gray-400">☁️</span> Ready</span>}
            {persistenceStatus === 'loading' && <span className="flex items-center gap-1"><span className="animate-spin">📂</span> Loading...</span>}
            {persistenceStatus === 'saving' && <span className="flex items-center gap-1 text-blue-300"><span className="animate-pulse">💾</span> Saving...</span>}
            {persistenceStatus === 'saved' && <span className="flex items-center gap-1 text-green-400"><span>✅</span> Saved</span>}
            {persistenceStatus === 'error' && <span className="flex items-center gap-1 text-red-400"><span>⚠️</span> Save Error</span>}
        </div>
      </div>

    </div>
  );
}
