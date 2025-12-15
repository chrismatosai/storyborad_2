import React, { useState, memo, useEffect, useMemo } from 'react';
import { Node, VideoData, Connection, NodeType, ImageData } from '../../types/graph';
import { JSONInspectorModal } from '../ui/JSONInspectorModal';

interface VideoNodeProps { 
    node: Node<VideoData>; 
    updateNodeData: (nodeId: string, data: Partial<VideoData>) => void; 
    onGenerate?: (node: Node) => void; 
    connectorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>; 
    onConnectorMouseDown: (e: React.MouseEvent, nodeId: string, outputId: string | number) => void;
    allNodes: Node[];
    allConnections: Connection[];
}

export const VideoNode = memo(({ node, updateNodeData, onGenerate, allNodes, allConnections }: VideoNodeProps) => { 
    const [activeTab, setActiveTab] = useState<'timeline' | 'preview' | 'json'>('timeline');
    const [copied, setCopied] = useState(false);
    const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

    // Lógica de búsqueda de imágenes
    const connectedImages = useMemo(() => {
        const getInputImage = (inputId: string): string | undefined => {
            const connection = allConnections.find(c => c.toNodeId === node.id && c.toInputIndex === (inputId === 'start-frame' ? 0 : 1));
            // Fallback for older connections that might use string IDs if needed, though updated logic uses index
            // But verify how FlowCanvas passes index. FlowCanvas passes index 0 for start, 1 for end.
            if (!connection) return undefined;
            const sourceNode = allNodes.find(n => n.id === connection.fromNodeId);
            if (sourceNode && sourceNode.type === NodeType.Image && (sourceNode.data as ImageData).image) {
                return (sourceNode.data as ImageData).image;
            }
            return undefined;
        };
        return { start: getInputImage('start-frame'), end: getInputImage('end-frame') };
    }, [allNodes, allConnections, node.id]);

    useEffect(() => {
        if (!node.data.segments || node.data.segments.length === 0) {
            updateNodeData(node.id, { duration: node.data.duration || 4, segments: [""] });
        }
    }, []);

    const duration = node.data.duration || 4;
    const segments = node.data.segments || [""];
    const timePerSegment = duration / segments.length;

    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDuration = parseInt(e.target.value);
        let newSegments = [...segments];
        if (newSegments.length > newDuration) newSegments = newSegments.slice(0, newDuration);
        updateNodeData(node.id, { duration: newDuration, segments: newSegments });
    };

    const addAction = () => {
        if (segments.length < duration) updateNodeData(node.id, { segments: [...segments, ""] });
    };

    const removeAction = () => {
        if (segments.length > 1) updateNodeData(node.id, { segments: segments.slice(0, -1) });
    };

    const updateSegmentText = (index: number, text: string) => {
        const newSegments = [...segments];
        newSegments[index] = text;
        updateNodeData(node.id, { segments: newSegments });
    };

    const handleCopy = () => {
        if (node.data.promptSchema) {
            navigator.clipboard.writeText(JSON.stringify(node.data.promptSchema, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const isReady = (!!connectedImages.start || !!connectedImages.end) && segments.some(s => s.trim().length > 0);
    const hasJson = !!node.data.promptSchema;

    return (
    // FIX VISUAL: h-auto y rounded-b-lg en el contenedor principal para contener a los hijos
    <div className="w-full min-w-[350px] h-auto flex flex-col rounded-lg overflow-hidden">
      {/* HEADER */}
      <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-950 to-gray-900">
        <span className="text-xs font-bold text-indigo-300 flex items-center gap-2">
            🎥 Veo Director <span className="text-indigo-500/50 text-[9px]">{duration}s • {segments.length} Acts</span>
        </span>
        <div className="flex gap-1 bg-black/30 rounded p-0.5">
            <button onClick={() => setActiveTab('timeline')} className={`px-2 py-0.5 text-[9px] rounded transition-colors ${activeTab === 'timeline' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Edit</button>
            <button onClick={() => setActiveTab('preview')} className={`px-2 py-0.5 text-[9px] rounded transition-colors ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Refs</button>
            <button onClick={() => setActiveTab('json')} className={`px-2 py-0.5 text-[9px] rounded transition-colors ${activeTab === 'json' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>JSON</button>
        </div>
      </div>

      {/* CONTENT AREA (FIX: rounded-b-lg para que no corte esquinas del padre) */}
      <div className="p-3 space-y-4 bg-gray-900/50 flex-1 rounded-b-lg">
        
        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
            <div className="space-y-4 animate-in fade-in">
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                        <span>Total Duration</span>
                        <span className="text-indigo-300">{duration} Seconds</span>
                    </div>
                    <input type="range" min="1" max="8" step="1" value={duration} onChange={handleDurationChange} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    <div className="flex justify-between text-[8px] text-gray-600 font-mono"><span>1s</span><span>8s</span></div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Action Sequence</label>
                        <div className="flex gap-1">
                             <button onClick={removeAction} disabled={segments.length <= 1} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] hover:bg-red-900/50 disabled:opacity-30">-</button>
                            <button onClick={addAction} disabled={segments.length >= duration} className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 rounded text-[10px] hover:bg-indigo-800 disabled:opacity-30 disabled:cursor-not-allowed border border-indigo-500/30">+ Split Action</button>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {segments.map((seg, idx) => {
                            const start = idx * timePerSegment;
                            const end = (idx + 1) * timePerSegment;
                            return (
                                <div key={idx} className="relative group">
                                    <div className="absolute top-0 right-0 bg-black/40 text-gray-500 text-[9px] px-1.5 py-0.5 rounded-bl font-mono border-l border-b border-gray-800">{start.toFixed(1)}s ➝ {end.toFixed(1)}s</div>
                                    <textarea className="w-full p-2 pt-5 bg-black/20 rounded border border-gray-700 focus:border-indigo-500 focus:outline-none text-xs text-gray-300 resize-none transition-colors" placeholder={`Action ${idx + 1}...`} rows={2} value={seg} onChange={(e) => updateSegmentText(idx, e.target.value)} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
            <div className="flex gap-2 h-32 animate-in fade-in">
                <div className="flex-1 bg-black/40 rounded border border-blue-900/30 flex flex-col items-center justify-center overflow-hidden relative">
                    {connectedImages.start ? <img src={`data:image/png;base64,${connectedImages.start}`} className="w-full h-full object-cover opacity-80" /> : <span className="text-[9px] text-blue-400">Start Frame</span>}
                    <div className="absolute top-1 left-1 bg-blue-900/80 text-white text-[8px] px-1.5 py-0.5 rounded font-mono">0.0s</div>
                </div>
                <div className="flex flex-col items-center justify-center text-gray-600 gap-1"><div className="w-8 h-[1px] bg-gray-700"></div><span className="text-[9px] font-mono text-indigo-400">{duration}s</span><div className="w-8 h-[1px] bg-gray-700"></div></div>
                <div className="flex-1 bg-black/40 rounded border border-purple-900/30 flex flex-col items-center justify-center overflow-hidden relative">
                    {connectedImages.end ? <img src={`data:image/png;base64,${connectedImages.end}`} className="w-full h-full object-cover opacity-80" /> : <span className="text-[9px] text-purple-400">End Frame</span>}
                    <div className="absolute top-1 right-1 bg-purple-900/80 text-white text-[8px] px-1.5 py-0.5 rounded font-mono">{duration}.0s</div>
                </div>
            </div>
        )}

        {/* TAB: JSON */}
        {activeTab === 'json' && (
            <div className="bg-gray-950 rounded-lg border border-indigo-500/30 flex flex-col h-[250px] overflow-hidden shadow-inner animate-in fade-in relative group">
                <div className="flex justify-between items-center px-2 py-1.5 bg-indigo-900/20 border-b border-indigo-500/20 shrink-0">
                    <span className="text-[9px] font-bold text-indigo-300 uppercase">VEO Prompt Schema</span>
                    <div className="flex gap-1">
                         {/* BOTÓN EXPANDIR (SIEMPRE VISIBLE, DISABLED SI NO HAY JSON) */}
                        <button 
                            onClick={() => setIsJsonModalOpen(true)}
                            disabled={!hasJson}
                            className={`text-[10px] px-2 py-0.5 rounded transition-all ${hasJson ? 'bg-black/40 hover:bg-indigo-500/20 text-indigo-200 cursor-pointer' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                            title={hasJson ? "Expand JSON Inspector" : "Generate Video Spec to inspect"}
                        >
                            ⤢
                        </button>
                        {hasJson && (
                            <button onClick={handleCopy} className="text-[10px] bg-black/40 hover:bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded transition-all">
                                {copied ? "✅" : "📋"}
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {node.data.promptSchema ? (
                        <pre className="text-[9px] text-indigo-100 font-mono leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(node.data.promptSchema, null, 2)}
                        </pre>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                            <span className="text-2xl opacity-20">📄</span>
                            <span className="text-[10px] italic">Generate Spec to view JSON</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        <button
            onClick={() => onGenerate && onGenerate({ ...node, data: { ...node.data, startImage: connectedImages.start, endImage: connectedImages.end } })}
            disabled={!isReady || node.data.isLoading}
            className={`w-full py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg border border-transparent ${isReady ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20 hover:border-indigo-400' : 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700'}`}
        >
            {node.data.isLoading ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>✨ Generate Video Spec</span>}
        </button>

        <JSONInspectorModal
            isOpen={isJsonModalOpen}
            onClose={() => setIsJsonModalOpen(false)}
            title="Video Prompt Specification (Veo)"
            data={node.data.promptSchema}
        />

      </div>
    </div>
    ); 
});