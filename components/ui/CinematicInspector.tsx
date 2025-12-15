
import React, { useState } from 'react';
import { CinematicJSON } from '../../types/cinematicSchema';
import { JSONInspectorModal } from './JSONInspectorModal';

interface CinematicInspectorProps {
  data: any; // Allow CinematicJSON or SettingPassport
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Type detection
  const isSettingPassport = data && 'style' in data && !('subjects' in data);

  // If no data and no regenerate function, show simple waiting state
  if (!data && !onRegenerate) return <div className="text-xs text-gray-500 italic p-4">Waiting for generation...</div>;

  return (
    <div className={`bg-gray-900 rounded-md border border-yellow-600/30 overflow-hidden shadow-inner ${className}`}>
      
      {/* HEADER WITH ACTIONS */}
      <div className="flex justify-between items-center p-2 bg-yellow-900/20 border-b border-yellow-600/30">
        <span className="text-[10px] uppercase tracking-wider font-bold text-yellow-500">
            {isSettingPassport ? "Setting Spec (JSON)" : "Scene Spec (JSON)"}
        </span>
        
        <div className="flex gap-2">
            {/* EXPAND BUTTON */}
            <button 
              onClick={(e) => {
                  e.stopPropagation(); 
                  setIsModalOpen(true);
              }}
              className="text-[10px] bg-black/40 hover:bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded transition-all flex items-center gap-1"
              title="Expand JSON Inspector"
            >
              ⤢
            </button>

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
            
            {isSettingPassport ? (
                /* CASO A: SETTING PASSPORT (Datos de Estilo) */
                <>
                    <Section title="Visual Style" icon="🎨" defaultOpen={true}>
                        <div className="text-gray-300 italic mb-2">"{data.scene_description}"</div>
                        <Row label="Architecture" value={data.style?.visual_style} />
                    </Section>

                    <Section title="Lighting & Color" icon="💡" defaultOpen={true}>
                        <Row label="Light Type" value={data.style?.lighting?.type} />
                        <Row label="Mood" value={data.style?.lighting?.mood} />
                        <div className="mt-2 pt-1 border-t border-white/5">
                            <Row label="Dominant" value={data.style?.color_palette?.dominant} />
                            <Row label="Accents" value={data.style?.color_palette?.accents} />
                        </div>
                    </Section>
                </>
            ) : (
                /* CASO B: NEW CINEMATIC JSON SPEC (Schema Updated) */
                <>
                    {/* 1. GLOBALS */}
                    <Section title="Scene & Mood" icon="🎬" defaultOpen={true}>
                       <Row label="Description" value={data.scene_globals?.description} />
                       <Row label="Mood" value={data.scene_globals?.mood} />
                    </Section>

                    {/* 2. SUBJECTS (NEW) */}
                    <Section title="Main Subject" icon="👤" defaultOpen={true}>
                       <Row label="Subject" value={data.subjects?.main_subject} />
                       <Row label="Action" value={data.subjects?.action_pose} />
                       <Row label="Expression" value={data.subjects?.expression_mood} />
                       <Row label="Clothing" value={data.subjects?.clothing_details} />
                    </Section>

                    {/* 3. COMPOSITION */}
                    <Section title="Composition" icon="🖼️">
                       <Row label="Frame" value={data.composition?.frame_size} />
                       <Row label="Angle" value={data.composition?.angle} />
                       <Row label="Depth" value={data.composition?.depth_of_field} />
                       <Row label="Foreground" value={data.composition?.foreground?.description} />
                       <Row label="Background" value={data.composition?.background?.description} />
                    </Section>

                    {/* 4. STYLE */}
                     <Section title="Style & Lighting" icon="🎨">
                       <Row label="Visual Style" value={data.style?.visual_style} />
                       <Row label="Lighting" value={`${data.style?.lighting?.type} (${data.style?.lighting?.mood})`} />
                       <Row label="Palette" value={data.style?.color_palette?.dominant} />
                       <Row label="Accents" value={data.style?.color_palette?.accents} />
                     </Section>

                    {/* 5. CAMERA */}
                    <Section title="Camera" icon="🎥">
                       <Row label="Lens" value={data.presentation?.camera?.lens_focal_length} />
                       <Row label="Aperture" value={data.presentation?.camera?.aperture} />
                       <Row label="Shot Type" value={data.presentation?.camera?.shot_type} />
                    </Section>
                </>
            )}
        </div>
      )}

      {/* JSON INSPECTOR MODAL */}
      <JSONInspectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isSettingPassport ? "Setting Specification" : "Cinematic Specification"}
        data={data}
      />
    </div>
  );
};
