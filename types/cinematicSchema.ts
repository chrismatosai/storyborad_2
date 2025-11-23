
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
  description: string; // La descripción natural va aquí
  facialCompositeProfile: FacialComposite;
  // Mantenemos visual_dna por compatibilidad si lo usabas, o lo adaptamos
  visual_dna?: {
    body: string;
    clothing: string;
  };
}

export interface CinematicJSON {
  scene_globals: {
    description: string;
    mood: string[];
    lighting_globals: {
      type: string;
      quality: string[];
      color_temperature: string;
    };
  };
  composition: {
    background: { description: string };
    midground: { description: string };
    foreground: { 
      description: string;
      focus_target_id?: string; 
    };
    frame_element?: {
      description: string;
      position: string;
      focus_state: string;
      texture: string;
    };
  };
  character: Array<{
    id: string;
    type: string;
    description: string;
    placement_plane: string; // 'foreground' | 'midground' | 'background'
    facialCompositeProfile?: FacialComposite;
    details: {
      pose: string;
      facial_expression: {
        emotion: string;
        description: string;
      };
      clothing: {
        items: string;
        texture: string;
      };
      skin_texture?: {
        details: string;
        imperfections: string;
      };
    };
  }>;
  presentation: {
    style: string[];
    materials?: { film_grain?: string };
    camera: {
      lens_focal_length: string;
      aperture: string;
      depth_of_field: string;
      focus_target_id?: string;
      shot_type: string;
      angle: string;
      aspect_ratio: string;
    };
  };
}

// Estructura para el "Pasaporte del Escenario"
export interface SettingPassport {
  scene_description: string; // Descripción general en texto
  style: {
    visual_style: string; // Ej: "Cyberpunk", "Art Deco", "Post-Apocalyptic"
    lighting: {
      type: string;       // Ej: "Natural sunlight"
      mood: string;       // Ej: "Hopeful"
    };
    color_palette: {
      dominant: string;   // Ej: "Teal and Orange"
      accents: string;    // Ej: "Neon Pink"
    };
  };
}
