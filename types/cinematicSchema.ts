
export interface LightingGlobals {
  type: string;
  quality: string[];
  color_temperature: string;
}

export interface CompositionElement {
  description: string;
  focus_target_id?: string;
  position?: string;
  focus_state?: string;
  texture?: string;
}

export interface EntityDetail {
  pose: string;
  facial_expression: string;
  clothing: string;
  skin_texture: string;
}

export interface SceneEntity {
  id: string;
  type: string;
  description: string;
  placement_plane: string;
  details: EntityDetail;
}

export interface CameraSettings {
  lens_focal_length: string;
  aperture: string;
  depth_of_field: string;
  shot_type: string;
  angle: string;
  aspect_ratio: string;
}

export interface Presentation {
    camera: CameraSettings;
    film_grain?: string;
    color_grading?: string;
}

export interface SceneGlobals {
    lighting: LightingGlobals;
    atmosphere?: string;
    time_of_day?: string;
    weather?: string;
}

export interface CinematicPrompt {
  scene_globals: SceneGlobals;
  composition: CompositionElement[];
  entities: SceneEntity[];
  presentation: Presentation;
}

// --- V2 Schema Definitions ---

export interface FacialComposite {
  faceShape: string;
  skinTone: string;
  forehead: string;
  eyebrows: { shape: string; density: string }; 
  eyes: { color: string; shape: string };
  nose: { shape: string; size: string };
  mouth: { shape: string; expression: string };
}

export interface CharacterPassport {
  character_id: string;
  description: string; 
  facialCompositeProfile: FacialComposite;
  visual_dna?: {
    body: string;
    clothing: string;
  };
}

// UPDATED INTERFACE V2
export interface CinematicJSON {
  subjects: {
    main_subject: string; // e.g., "A grizzled detective in a trench coat"
    clothing_details: string; // e.g., "Wet, rumpled beige trench coat over a dark suit"
    action_pose: string; // e.g., "Standing hunched, lighting a cigarette"
    expression_mood: string; // e.g., "Weary, cynical expression"
  };
  scene_globals: {
    description: string;
    mood: string;
  };
  composition: {
    frame_size: string; // e.g., "Medium Shot"
    depth_of_field: string; // e.g., "Shallow Focus"
    angle: string; // e.g., "Eye Level"
    foreground: { description: string };
    background: { description: string };
  };
  style: {
    visual_style: string;
    color_palette: { dominant: string[]; accents: string[] };
    lighting: { type: string; mood: string };
  };
  presentation: {
    camera: { lens_focal_length: string; aperture: string; shot_type: string };
  };
}

// Estructura para el "Pasaporte del Escenario"
export interface SettingPassport {
  scene_description: string;
  style: {
    visual_style: string;
    lighting: {
      type: string;
      mood: string;
    };
    color_palette: {
      dominant: string;
      accents: string;
    };
  };
}
