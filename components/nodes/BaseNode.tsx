import React, { MouseEvent, MutableRefObject } from 'react';
import { Node } from '../../types/graph';
import { NodeConfigItem } from './nodeConfig';
import { Handle } from './Handle';

interface BaseNodeProps {
  node: Node;
  config: NodeConfigItem;
  children: React.ReactNode;
  onNodeMouseDown: (e: MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onConnectorMouseDown: (e: MouseEvent<HTMLDivElement>, nodeId: string, outputId: string | number) => void;
  onConnectorMouseUp: (e: MouseEvent<HTMLDivElement>, nodeId: string, inputIndex: number) => void;
  onDisconnectInput?: (nodeId: string, inputIndex: number) => void;
  checkInputConnection: (index: number) => boolean;
  connectorRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  node,
  config,
  children,
  onNodeMouseDown,
  onDelete,
  onConnectorMouseDown,
  onConnectorMouseUp,
  onDisconnectInput,
  checkInputConnection,
  connectorRefs,
}) => {
  return (
    <div
      data-node-id={node.id}
      className={`
        absolute z-10 flex flex-col rounded-lg shadow-xl border border-gray-900/50 select-none group transition-shadow duration-200
        ${config.color}
      `}
      style={{ left: node.position.x, top: node.position.y, width: config.width }}
      // 1. CONTAINER HANDLES DRAG
      // This event only fires if it wasn't stopped by a child (Content or Handle)
      onMouseDown={(e) => {
          console.log(`📦 BaseNode ${node.id}: Starting Drag`);
          onNodeMouseDown(e, node.id);
      }}
    >
      {/* Header */}
      <div className="p-2 rounded-t-lg bg-black/20 flex justify-between items-center cursor-move">
        <span className="font-bold text-sm text-white/90 shadow-black drop-shadow-md">{config.title}</span>
        <button
          onMouseDown={(e) => e.stopPropagation()} // Stop drag start on delete button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="p-1 rounded-full hover:bg-red-800/50 text-gray-400 hover:text-white transition-colors"
          aria-label={`Delete ${config.title} node`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Area - BLOCKS DRAG */}
      {/* This ensures interactions with inputs/textareas don't move the node */}
      <div 
        className="cursor-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
         {children}
      </div>

      {/* Inputs Column */}
      <div className="absolute top-0 left-0 h-full -translate-x-1/2 flex flex-col justify-around pointer-events-none">
        {config.inputs.map((input, i) => (
          <div key={i} className="pointer-events-auto" title={input}>
             <Handle
                type="input"
                ref={(el) => {
                    const key = `input-${node.id}-${i}`;
                    if (el) connectorRefs.current[key] = el;
                    else delete connectorRefs.current[key];
                }}
                isConnected={checkInputConnection(i)}
                onMouseUp={(e) => onConnectorMouseUp(e, node.id, i)}
                onDisconnect={() => onDisconnectInput && onDisconnectInput(node.id, i)}
                className="relative shadow-md"
             />
          </div>
        ))}
      </div>

      {/* Outputs Column */}
      <div className="absolute top-0 right-0 h-full translate-x-1/2 flex flex-col justify-center pointer-events-none">
        {config.outputs.map((output, i) => (
             <div key={i} className="pointer-events-auto group/handle relative flex items-center justify-center">
                {/* Tooltip on hover */}
                <span className="absolute right-full top-1/2 -translate-y-1/2 mr-3 text-xs text-gray-200 opacity-0 group-hover/handle:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-black/80 px-2 py-1 rounded border border-gray-600 z-50">
                    {output}
                </span>
                <Handle
                    type="output"
                    ref={(el) => {
                        const key = `output-${node.id}-${i}`;
                        if (el) connectorRefs.current[key] = el;
                        else delete connectorRefs.current[key];
                    }}
                    onMouseDown={(e) => onConnectorMouseDown(e, node.id, i)}
                    className="relative shadow-md"
                />
            </div>
        ))}
      </div>

    </div>
  );
}