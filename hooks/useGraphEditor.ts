
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Node, Connection, NodeType, AnyNodeData, ScriptData, ImageData, Graph } from '../types/graph';

export const useGraphEditor = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  const addNode = useCallback((type: NodeType, position = { x: 100, y: 100 }) => {
    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position,
      data: type === NodeType.Script ? { script: '', scenes: [] } :
            type === NodeType.Image ? { prompt: '', isLoading: false } :
            { prompt: '', image: undefined },
    };
    setNodes(prev => [...prev, newNode]);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: Partial<AnyNodeData>) => {
    setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
            // Debug/Guard: Check if image is being wiped
            const incomingData = data as any;
            const currentData = n.data as any;

            // Check if 'image' is in the update payload and is null/undefined
            if ('image' in incomingData && (incomingData.image === undefined || incomingData.image === null)) {
                // Check if we currently HAVE an image
                if (currentData.image) {
                    console.warn(`🚨 BLOCKED ATTEMPT TO WIPE IMAGE FROM NODE ${nodeId}`);
                    // To forcefully prevent wiping, uncomment the next lines:
                    // const { image, ...safeData } = incomingData;
                    // return { ...n, data: { ...n.data, ...safeData } };
                }
            }

            return { ...n, data: { ...n.data, ...data } };
        }
        return n;
    }));
  }, []);

  const addConnection = useCallback((conn: Omit<Connection, 'id'>) => {
    if (conn.fromNodeId === conn.toNodeId) return;
    setConnections(prev => {
        if (prev.some(c => c.toNodeId === conn.toNodeId && c.toInputIndex === conn.toInputIndex)) {
            return prev;
        }
        return [...prev, { ...conn, id: crypto.randomUUID() }];
    });
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  }, []);

  const disconnectInput = useCallback((nodeId: string, inputIndex?: number) => {
    setConnections(prev => prev.filter(c => {
        // If inputIndex is provided, only disconnect that specific input
        if (inputIndex !== undefined) {
            return !(c.toNodeId === nodeId && c.toInputIndex === inputIndex);
        }
        // Otherwise disconnect all inputs to this node
        return c.toNodeId !== nodeId;
    }));
    console.log(`✂️ Cable desconectado del nodo ${nodeId} ${inputIndex !== undefined ? `(Input ${inputIndex})` : ''}`);
  }, []);
  
  const addScene = useCallback((nodeId: string) => {
    setNodes(prevNodes => prevNodes.map(n => n.id === nodeId && n.type === NodeType.Script ? {
      ...n,
      data: {
        ...n.data as ScriptData,
        scenes: [...(n.data as ScriptData).scenes, {
          id: `scene-${nodeId}-${crypto.randomUUID()}`,
          title: 'New Scene',
          description: 'A new scene description.',
          isExpanded: true,
        }],
      },
    } : n));
  }, []);

  const deleteScene = useCallback((nodeId: string, sceneId: string) => {
    setNodes(prevNodes => prevNodes.map(n => {
      if (n.id === nodeId && n.type === NodeType.Script) {
        const scriptData = n.data as ScriptData;
        const newScenes = scriptData.scenes.filter(scene => scene.id !== sceneId);
        return { ...n, data: { ...scriptData, scenes: newScenes } };
      }
      return n;
    }));
    setConnections(prev => prev.filter(c => !(c.fromNodeId === nodeId && c.fromOutput === sceneId)));
  }, []);

  const setGraph = useCallback((data: { nodes: Node[], connections: Connection[] }) => {
      setNodes(data.nodes);
      setConnections(data.connections);
  }, []);

  // Effect: Clean invalid connections when script scenes change
  useEffect(() => {
    setConnections(prevConnections => {
        const validConnections = prevConnections.filter(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromNodeId);
            if (fromNode && fromNode.type === NodeType.Script) {
                const scenes = (fromNode.data as ScriptData).scenes;
                const fromOutput = conn.fromOutput;
                if (typeof fromOutput === 'string') {
                    return scenes.some(s => s.id === fromOutput);
                } else {
                    return fromOutput < scenes.length;
                }
            }
            return true;
        });
        return validConnections.length !== prevConnections.length ? validConnections : prevConnections;
    });
  }, [nodes]);

  // Effect: Sync image prompts from connected scripts
  useEffect(() => {
      setNodes(prevNodes => {
        const imagePrompts: Record<string, string> = {};
        
        // 1. Calculate intended prompts from Script -> Image connections
        connections.forEach(conn => {
            const fromNode = prevNodes.find(n => n.id === conn.fromNodeId);
            const toNode = prevNodes.find(n => n.id === conn.toNodeId);
            if(fromNode?.type === NodeType.Script && toNode?.type === NodeType.Image) {
                const fromOutput = conn.fromOutput;
                const scene = typeof fromOutput === 'string'
                    ? (fromNode.data as ScriptData).scenes.find(s => s.id === fromOutput)
                    : (fromNode.data as ScriptData).scenes[fromOutput as number];
                if(scene) imagePrompts[toNode.id] = scene.description;
            }
        });

        let hasChanged = false;
        const newNodes = prevNodes.map(node => {
            if (node.type === NodeType.Image) {
                // Check if this specific node is actually connected to a script
                // We check specifically if there is a connection pointing TO this node FROM a script
                const isConnectedToScript = connections.some(c => 
                    c.toNodeId === node.id && 
                    prevNodes.find(n => n.id === c.fromNodeId)?.type === NodeType.Script
                );

                // Only enforce prompt sync if a Script is controlling this node.
                // This prevents manual prompts/images from being wiped when connecting an OUTPUT to a Transformation node.
                if (isConnectedToScript) {
                    const newPrompt = imagePrompts[node.id] || "";
                    const imgData = node.data as ImageData;
                    if (imgData.prompt !== newPrompt) {
                        hasChanged = true;
                        return { 
                            ...node, 
                            data: { 
                                ...imgData, 
                                prompt: newPrompt, 
                                // Guard: Preserve existing image even if prompt updates. 
                                // Prevents wiping data when connections shift or refresh.
                                image: imgData.image, 
                                error: undefined 
                            } 
                        };
                    }
                }
            }
            return node;
        });
        return hasChanged ? newNodes : prevNodes;
      });
  }, [connections]); 

  // Construct the Graph object for persistence or export
  const graph = useMemo<Graph>(() => ({
      id: 'main-storyboard', // Default ID, could be dynamic in future
      name: 'Untitled Storyboard',
      nodes,
      connections,
      lastModified: Date.now()
  }), [nodes, connections]);

  return {
    nodes,
    connections,
    graph,
    actions: {
      addNode,
      deleteNode,
      updateNodeData,
      addConnection,
      removeConnection,
      disconnectInput,
      addScene,
      deleteScene,
      setNodes,
      setConnections,
      setGraph
    }
  };
};
