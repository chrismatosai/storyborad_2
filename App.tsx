
import React, { useState, useCallback, useRef, MouseEvent, useEffect } from 'react';
import { NodeType } from './types/graph';
import { useViewport } from './hooks/useViewport';
import { useGraphEditor } from './hooks/useGraphEditor';
import { useGeminiGenerator } from './hooks/useGeminiGenerator';
import { useSmartConnections } from './hooks/useSmartConnections';
import { useConnectionEnricher } from './hooks/useConnectionEnricher';
import { enrichSceneDescription } from './services/promptArchitect';
import { usePersistence } from './hooks/usePersistence';

// UI Components
import { NODE_CONFIG } from './components/nodes/nodeConfig';
import { FlowCanvas } from './components/layout/FlowCanvas';
import { MiniMap } from './components/ui/MiniMap';

// Main App Component
export default function App() {
  const { 
      nodes, 
      connections, 
      graph,
      actions 
  } = useGraphEditor();
  
  // AGREGA ESTO PARA DEPURAR:
  console.log("🔍 DEBUG - NodeTypes disponibles:", Object.keys(NodeType));
  console.log("🔍 DEBUG - Configuración de Video:", NODE_CONFIG[NodeType.Video]);

  const [connecting, setConnecting] = useState<{ fromNodeId: string; fromOutput: string | number; toPosition: { x: number; y: number } } | null>(null);
  
  // Persistence Integration
  const { status: persistenceStatus, loadInitialData, clearStorage } = usePersistence(graph);
  
  // 🆕 Loading State
  const [isReady, setIsReady] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const { 
    viewTransform, 
    setViewTransform, 
    isPanning, 
    containerRef, 
    handlers: viewportHandlers 
  } = useViewport();

  // Initial Load Effect with Auto-Fit
  useEffect(() => {
    const init = async () => {
      console.log("📂 Persistence: Loading project...");
      try {
        const savedGraph = await loadInitialData();
        
        if (savedGraph && savedGraph.nodes.length > 0) {
          console.log("✅ Persistence: Project loaded.");
          actions.setGraph(savedGraph);
          
          // --- AUTO-FIT LOGIC ---
          // 1. Calcular los límites (Bounding Box) de todos los nodos
          const nodes = savedGraph.nodes;
          if (nodes.length === 0) return;

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          nodes.forEach(node => {
              // Asumimos un ancho/alto promedio si no está definido (ej: 300x300) para asegurar margen
              const width = 300; 
              const height = 300;
              if (node.position.x < minX) minX = node.position.x;
              if (node.position.y < minY) minY = node.position.y;
              if (node.position.x + width > maxX) maxX = node.position.x + width;
              if (node.position.y + height > maxY) maxY = node.position.y + height;
          });

          // 2. Calcular dimensiones del contenido y de la pantalla
          const contentW = maxX - minX;
          const contentH = maxY - minY;
          const screenW = window.innerWidth;
          const screenH = window.innerHeight;
          const padding = 100; // Margen visual

          // 3. Calcular Zoom ideal (con límites de 0.2 a 1)
          const zoomX = (screenW - padding * 2) / contentW;
          const zoomY = (screenH - padding * 2) / contentH;
          let targetZoom = Math.min(zoomX, zoomY);
          targetZoom = Math.max(0.2, Math.min(1, targetZoom)); // Clamp

          // 4. Calcular el centro (Pan)
          // Fórmula: CenterScreen - (CenterContent * Zoom)
          const contentCenterX = minX + contentW / 2;
          const contentCenterY = minY + contentH / 2;
          
          const targetX = (screenW / 2) - (contentCenterX * targetZoom);
          const targetY = (screenH / 2) - (contentCenterY * targetZoom);

          // 5. Aplicar transformación
          setViewTransform({ x: targetX, y: targetY, zoom: targetZoom });
          console.log("🔭 Auto-Fit applied");

        } else {
          console.log("ℹ️ Persistence: No saved project found.");
          // Centrar en el origen por defecto
          setViewTransform({ x: window.innerWidth/2 - 100, y: window.innerHeight/2 - 50, zoom: 1 });
        }
      } catch (e) {
        console.error("❌ Persistence: Error recovering data:", e);
      } finally {
         setIsReady(true);
      }
    };
    init();
  }, [loadInitialData, actions.setGraph, setViewTransform]);

  // Use the new Gemini Generator Hook
  const { generateImage, generateAll, isGeneratingAll, reverseEngineer } = useGeminiGenerator(nodes, connections, actions.updateNodeData);

  // Use Smart Connections for Eager Enrichment (Character/Setting)
  useSmartConnections(nodes, connections, actions.updateNodeData);

  // Use Connection Enricher for Scene Description -> Image Node JSON
  useConnectionEnricher(nodes, connections, actions.updateNodeData, enrichSceneDescription);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const connectingToPos = connecting ? screenToWorld(connecting.toPosition) : {x:0,y:0};

  const handleAddNode = (type: NodeType) => {
    // 1. Obtener dimensiones de la ventana
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // 2. Calcular el centro en coordenadas de pantalla
    const screenCenterX = screenW / 2;
    const screenCenterY = screenH / 2;

    // 3. Proyectar al "Mundo" del Canvas usando la transformación actual (ViewTransform)
    // Fórmula: (ScreenCoord - Pan) / Zoom
    // Restamos un offset (ej: 150px en X, 100px en Y) para que el nodo quede centrado visualmente y no su esquina.
    const worldX = (screenCenterX - viewTransform.x) / viewTransform.zoom - 100;
    const worldY = (screenCenterY - viewTransform.y) / viewTransform.zoom - 50;

    actions.addNode(type, { x: worldX, y: worldY });
  };

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
        onMouseDown={viewportHandlers.onMouseDown} // Use viewport handlers for background pan
        onWheel={viewportHandlers.onWheel}
    >
      {/* Top Right Actions Toolbar */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {/* Save Button */}
        <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-full border border-gray-600 transition-colors shadow-sm"
            title="Save Project"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span>Save</span>
        </button>

        {/* Load Button */}
        <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-full border border-gray-600 transition-colors shadow-sm"
            title="Load Project"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Load</span>
        </button>
        <input type="file" ref={fileInputRef} onChange={handleLoad} style={{ display: 'none' }} accept=".json" />

        {/* Generate All Button (Indigo) */}
        <button
            onClick={generateAll}
            disabled={isGeneratingAll}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-full border border-indigo-500 transition-colors shadow-sm disabled:opacity-50"
            title="Generate All Scenes"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{isGeneratingAll ? 'Generating...' : 'Run All'}</span>
        </button>

        {/* New Project / Reset Button */}
        <button 
          onClick={handleReset}
          className={`
            flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full border transition-all duration-200 shadow-sm
            ${isConfirmingReset 
              ? 'bg-red-900/80 text-white border-red-500 hover:bg-red-800' 
              : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600'
            }
          `}
          title="Clear Canvas"
        >
           <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isConfirmingReset ? 'text-white' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          <span>{isConfirmingReset ? "Confirm?" : "Reset"}</span>
        </button>
      </div>

      <FlowCanvas 
        nodes={nodes}
        connections={connections}
        viewTransform={viewTransform}
        onNodeMouseDown={onNodeMouseDown}
        onConnectorMouseDown={onConnectorMouseDown}
        onConnectorMouseUp={onConnectorMouseUp}
        onCanvasMouseDown={viewportHandlers.onMouseDown}
        onDeleteNode={actions.deleteNode}
        onDisconnectInput={actions.disconnectInput}
        updateNodeData={actions.updateNodeData}
        addScene={actions.addScene}
        deleteScene={actions.deleteScene}
        generateImage={generateImage}
        onReverseEngineer={reverseEngineer}
        connecting={connecting}
        connectingToPos={connectingToPos}
      />

      {/* Persistence Status Indicator Only */}
      <div className="absolute bottom-4 right-4 z-50">
        <div className="bg-gray-900/80 backdrop-blur text-white text-[10px] px-3 py-1.5 rounded-full border border-gray-700 shadow-lg flex items-center gap-2">
            {persistenceStatus === 'idle' && <span className="flex items-center gap-1 text-gray-400"><span>☁️</span> Saved</span>}
            {persistenceStatus === 'loading' && <span className="flex items-center gap-1"><span className="animate-spin">📂</span> Syncing...</span>}
            {persistenceStatus === 'saving' && <span className="flex items-center gap-1 text-blue-400"><span className="animate-pulse">💾</span> Saving...</span>}
            {persistenceStatus === 'saved' && <span className="flex items-center gap-1 text-green-400"><span>✅</span> Saved</span>}
            {persistenceStatus === 'error' && <span className="flex items-center gap-1 text-red-400"><span>⚠️</span> Error</span>}
        </div>
      </div>

      <MiniMap 
        nodes={nodes}
        viewTransform={viewTransform}
        setViewTransform={setViewTransform}
      />

      {/* Node Toolbar (Bottom Left - Floating Pills) */}
      <div className="absolute bottom-4 left-4 z-50 flex gap-2 items-end">
         
         {/* Mapping logic with Inline SVGs for zero-dependency icons */}
         {(Object.keys(NodeType) as Array<keyof typeof NodeType>).map(key => {
            const config = NODE_CONFIG[NodeType[key]];
            
            // Icon Mapping
            let iconPath = <path d="" />;
            switch(NodeType[key]) {
                case 'CHARACTER': // User/Person Icon
                    iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />;
                    break;
                case 'SETTING': // Map/Location Icon
                    iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />;
                    break;
                case 'SCRIPT': // Document Icon
                    iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
                    break;
                case 'IMAGE': // Photo Icon
                    iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />;
                    break;
                case 'TRANSFORMATION': // Sparkles/Magic Icon
                    iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />;
                    break;
                case 'VIDEO': // Video Camera Icon
                    iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />;
                    break;
            }

            return (
              <button
                key={key as string}
                onClick={() => handleAddNode(NodeType[key])}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white transition-all duration-200 shadow-md hover:scale-105 hover:shadow-lg border border-white/10
                  ${config.color}
                `}
                title={`Add ${config.title}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {iconPath}
                </svg>
                <span>{config.title}</span>
              </button>
            );
         })}
      </div>

    </div>
  );
}
