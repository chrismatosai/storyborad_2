
import React, { useState } from 'react';
import { CinematicJSON } from '../../types/cinematicSchema';

interface CinematicInspectorProps {
  data: CinematicJSON | null;
  className?: string;
  onRegenerate?: () => void;
}

/**
 * Sub-component for collapsible sections
 */
const Section = ({ title, icon, children, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-yellow-500/20 last:border-0">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-full flex items-center justify-between p-2 text-xs font-bold text-yellow-500 hover:bg-yellow-500/10 transition-colors"
      >
        <span className="flex items-center gap-2">{icon} {title}</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div className="p-2 bg-black/20 text-xs text-gray-300 space-y-2">{children}</div>}
    </div>
  );
};

/**
 * Sub-component for Key-Value rows
 */
const Row = ({ label, value }: { label: string, value: any }) => {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs mb-1">
      <span className="text-yellow-600/80 min-w-[80px] font-mono shrink-0">{label}:</span>
      <span className="text-gray-200 break-words leading-relaxed font-medium">
        {Array.isArray(value) ? value.join(', ') : value.toString()}
      </span>
    </div>
  );
};

export const CinematicInspector: React.FC<CinematicInspectorProps> = ({ 
  data, 
  className = "",
  onRegenerate 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If no data and no regenerate function, show simple waiting state
  if (!data && !onRegenerate) return <div className="text-xs text-gray-500 italic p-4">Waiting for generation...</div>;

  return (
    <div className={`bg-gray-900 rounded-md border border-yellow-600/30 overflow-hidden shadow-inner ${className}`}>
      
      {/* HEADER WITH ACTIONS */}
      <div className="flex justify-between items-center p-2 bg-yellow-900/20 border-b border-yellow-600/30">
        <span className="text-[10px] uppercase tracking-wider font-bold text-yellow-500">Scene Spec (JSON)</span>
        
        <div className="flex gap-2">
            {/* RE-ROLL BUTTON */}
            {onRegenerate && (
              <button 
                onClick={(e) => {
                    e.stopPropagation(); 
                    onRegenerate();
                }}
                className="text-[10px] bg-yellow-600/20 hover:bg-yellow-500/40 text-yellow-200 px-2 py-1 rounded transition-all flex items-center gap-1 border border-yellow-600/30"
                title="Regenerate JSON Specification"
              >
                🔄 <span className="hidden sm:inline">Re-Roll</span>
              </button>
            )}

            <button 
              onClick={(e) => {
                  e.stopPropagation(); 
                  handleCopy();
              }}
              className="text-[10px] bg-black/40 hover:bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded transition-all flex items-center gap-1"
              title="Copy JSON"
            >
              {copied ? "✅" : "📋"}
            </button>
        </div>
      </div>

      {!data ? (
          <div className="p-4 text-center text-xs text-gray-500">
              <p>No specification generated.</p>
              <p>Click "Re-Roll" to generate.</p>
          </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            
            {/* 1. GLOBALS & ATMOSPHERE */}
            <Section title="Atmosphere & Lighting" icon="⚡" defaultOpen={true}>
            <Row label="Desc" value={data.scene_globals?.description} />
            <Row label="Mood" value={data.scene_globals?.mood} />
            <div className="mt-2 pt-2 border-t border-white/5">
                <p className="text-[10px] text-yellow-600 mb-1 uppercase">Lighting</p>
                <Row label="Type" value={data.scene_globals?.lighting_globals?.type} />
                <Row label="Quality" value={data.scene_globals?.lighting_globals?.quality} />
                <Row label="Color" value={data.scene_globals?.lighting_globals?.color_temperature} />
            </div>
            </Section>

            {/* 2. COMPOSITION */}
            <Section title="Composition" icon="🖼️">
            <Row label="Foreground" value={data.composition?.foreground?.description} />
            <Row label="Midground" value={data.composition?.midground?.description} />
            <Row label="Background" value={data.composition?.background?.description} />
            {data.composition?.frame_element && (
                <Row label="Framing" value={`${data.composition.frame_element.description} (${data.composition.frame_element.position})`} />
            )}
            </Section>

            {/* 3. CHARACTER */}
            {data.character?.map((char, idx) => (
            <Section key={idx} title={`Character: ${char.id}`} icon="👤" defaultOpen={true}>
                <Row label="Who" value={char.description} />
                <Row label="Action" value={char.details?.pose} />
                <Row label="Emotion" value={char.details?.facial_expression?.emotion} />
                <Row label="Clothing" value={char.details?.clothing?.items} />
                <Row label="Skin" value={char.details?.skin_texture?.details} />
            </Section>
            ))}

            {/* 4. CAMERA & TECH */}
            <Section title="Camera & Tech" icon="🎥">
            <Row label="Shot" value={data.presentation?.camera?.shot_type} />
            <Row label="Lens" value={`${data.presentation?.camera?.lens_focal_length} @ ${data.presentation?.camera?.aperture}`} />
            <Row label="Angle" value={data.presentation?.camera?.angle} />
            <Row label="Style" value={data.presentation?.style} />
            </Section>

        </div>
      )}
    </div>
  );
};
