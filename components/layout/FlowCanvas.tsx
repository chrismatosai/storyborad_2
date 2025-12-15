
import React, { useLayoutEffect, useState, useRef } from 'react';
import { Node, Connection, NodeType, ScriptData, CharacterData, SettingData, ImageData, TransformationData, VideoData, ConnectorPosition } from '../../types/graph';
import { NODE_CONFIG } from '../nodes/nodeConfig';
import { BaseNode } from '../nodes/BaseNode';
import { CharacterNode } from '../nodes/CharacterNode';
import { SettingNode } from '../nodes/SettingNode';
import { ScriptNode } from '../nodes/ScriptNode';
import { ImageNode } from '../nodes/ImageNode';
import { TransformationNode } from '../nodes/TransformationNode';
import { VideoNode } from '../nodes/VideoNode';

interface FlowCanvasProps {
  nodes: Node[];
  connections: Connection[];
  viewTransform: { x: number; y: number; zoom: number };
  onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onConnectorMouseDown: (e: React.MouseEvent, nodeId: string, outputId: string | number) => void;
  onConnectorMouseUp: (e: React.MouseEvent, nodeId: string, inputIndex: number) => void;
  onCanvasMouseDown: (e: React.MouseEvent) => void;
  onDeleteNode: (nodeId: string) => void;
  onDisconnectInput: (nodeId: string, inputIndex?: number) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  // Specific Actions
  addScene: (nodeId: string) => void;
  deleteScene: (nodeId: string, sceneId: string) => void;
  generateImage: (node: Node<any>) => void;
  onReverseEngineer: (nodeId: string, image: string) => void;
  // Connecting State
  connecting: { fromNodeId: string; fromOutput: string | number; toPosition: { x: number; y: number } } | null;
  connectingToPos: { x: number; y: number };
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  connections,
  viewTransform,
  onNodeMouseDown,
  onConnectorMouseDown,
  onConnectorMouseUp,
  onCanvasMouseDown,
  onDeleteNode,
  onDisconnectInput,
  updateNodeData,
  addScene,
  deleteScene,
  generateImage,
  onReverseEngineer,
  connecting,
  connectingToPos
}) => {
  const connectorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [connectorPositions, setConnectorPositions] = useState<Record<string, ConnectorPosition>>({});

  // Helper para verificar conexiones
  const checkInputConnection = (nodeId: string, inputIndex: number) => {
    return connections.some(c => c.toNodeId === nodeId && c.toInputIndex === inputIndex);
  };

  // Cálculo de posiciones de los cables
  useLayoutEffect(() => {
    const newPositions: Record<string, ConnectorPosition> = {};
    if (!contentWrapperRef.current) return;

    Object.entries(connectorRefs.current).forEach(([key, el]) => {
      const element = el as HTMLDivElement | null;
      if (element) {
        const nodeDiv = element.closest('[data-node-id]');
        if (!nodeDiv) return;

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
          position: { x: elWorldX, y: elWorldY }
        };
      }
    });

    setConnectorPositions(currentPositions => {
      if (Object.keys(newPositions).length !== Object.keys(currentPositions).length) return newPositions;
      for (const key in newPositions) {
        if (!currentPositions[key] ||
            newPositions[key].position.x !== currentPositions[key].position.x ||
            newPositions[key].position.y !== currentPositions[key].position.y) {
          return newPositions;
        }
      }
      return currentPositions;
    });
  }, [nodes, viewTransform, nodes.length, JSON.stringify(nodes.map(n => n.position))]);

  return (
    <div
      ref={contentWrapperRef}
      onMouseDown={onCanvasMouseDown}
      className="absolute top-0 left-0 w-full h-full origin-top-left"
      style={{
        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.zoom})`,
      }}
    >
      {/* LAYER 1: CABLES (SVG) */}
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
        {/* CABLE FANTASMA (DRAGGING) */}
        {connecting && (() => {
          const fromKey = `output-${connecting.fromNodeId}-${connecting.fromOutput}`;
          const fromPos = connectorPositions[fromKey]?.position;
          if (!fromPos) return null;
          const toPos = connectingToPos;
          const path = `M ${fromPos.x},${fromPos.y} C ${fromPos.x + 50},${fromPos.y} ${toPos.x - 50},${toPos.y} ${toPos.x},${toPos.y}`;
          return <path d={path} stroke="#a78bfa" strokeWidth={2 / viewTransform.zoom} fill="none" strokeDasharray={`${5/viewTransform.zoom},${5/viewTransform.zoom}`} />;
        })()}
      </svg>

      {/* LAYER 2: NODOS */}
      {nodes.map(node => {
        const config = NODE_CONFIG[node.type];
        if (!config) return null;

        return (
          <BaseNode
            key={node.id}
            node={node}
            config={config}
            onNodeMouseDown={onNodeMouseDown}
            onDelete={onDeleteNode}
            onConnectorMouseDown={onConnectorMouseDown}
            onConnectorMouseUp={onConnectorMouseUp}
            onDisconnectInput={onDisconnectInput}
            checkInputConnection={(index) => checkInputConnection(node.id, index)}
            connectorRefs={connectorRefs}
          >
            {node.type === NodeType.Character && (
              <CharacterNode node={node as Node<CharacterData>} updateNodeData={updateNodeData} />
            )}
            {node.type === NodeType.Setting && (
              <SettingNode node={node as Node<SettingData>} updateNodeData={updateNodeData} />
            )}
            {node.type === NodeType.Script && (
              <ScriptNode
                node={node as Node<ScriptData>}
                updateNodeData={updateNodeData}
                addScene={addScene}
                deleteScene={deleteScene}
                connectorRefs={connectorRefs}
                onConnectorMouseDown={onConnectorMouseDown}
                onConnectorMouseUp={onConnectorMouseUp}
                onDisconnectInput={onDisconnectInput}
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
                updateNodeData={updateNodeData}
                onGenerate={generateImage}
                onReverseEngineer={onReverseEngineer}
                connectorRefs={connectorRefs}
                onConnectorMouseDown={onConnectorMouseDown}
              />
            )}
            {node.type === NodeType.Transformation && (
              <TransformationNode node={node as Node<TransformationData>} updateNodeData={updateNodeData} />
            )}
            {node.type === NodeType.Video && (
               <VideoNode
                 node={node as Node<VideoData>}
                 updateNodeData={updateNodeData}
                 onGenerate={generateImage}
                 connectorRefs={connectorRefs}
                 onConnectorMouseDown={onConnectorMouseDown}
                 allNodes={nodes}
                 allConnections={connections}
               />
            )}
          </BaseNode>
        );
      })}
    </div>
  );
};
