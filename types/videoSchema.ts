
import { FacialComposite } from './cinematicSchema';

export interface VideoMetadata {
  project_name: string;
  version: string;
  request_id: string;
  model_target: string; // 'veo-3.1-generate-preview'
}

export interface OutputSpecifications {
  duration_seconds: number;
  resolution: string; // '1080p'
  aspect_ratio: string; // '16:9'
  fps: number;
  seed?: number;
}

export interface VideoAsset {
  asset_id: string; // 'image_start' | 'image_end'
  source_url: string;
}

export interface TimelineKeyframe {
  timestamp: number;
  asset_id_ref: string;
}

export interface VideoTimeline {
  interpolation_mode: string; // 'semantic_aware'
  keyframes: TimelineKeyframe[];
}

export interface VideoActor {
  actor_id: string;
  description: string;
  facialCompositeProfile?: FacialComposite;
}

export interface VideoScene {
  location: string;
  time_of_day: string;
  weather: string;
  elements?: string[];
}

export interface VideoStyle {
  visual_style: string;
  lighting?: any;
  color_palette?: any;
}

export interface VideoCamera {
  lens?: any;
  composition: string;
  camera_movements?: string[];
}

export interface VoiceProfile {
  language: string;
  accent: string;
  voice: string;
}

export interface Utterance {
  line: string;
  start_time: string;
  delivery: string;
  voice_profile: VoiceProfile;
}

export interface DialogueLine {
  speaker_id: string;
  utterance: Utterance;
}

export interface SequenceEvent {
  start_time: string;
  end_time: string;
  description: string;
  actions: string[];
  dialogue?: DialogueLine[];
}

export interface AudioScape {
  ambient_sound: string[];
  sound_effects: string[];
}

export interface VideoPrompt {
  metadata: VideoMetadata;
  output_specifications: OutputSpecifications;
  assets: VideoAsset[];
  timeline: VideoTimeline;
  actors: VideoActor[];
  scene: VideoScene;
  scene_description: string;
  style: VideoStyle;
  camera: VideoCamera;
  sequence: SequenceEvent[];
  audio_scape: AudioScape;
  negative_prompts: string[];
}
