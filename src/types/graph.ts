import { CinematicPrompt, CharacterPassport, CinematicJSON, SettingPassport } from './cinematicSchema';
import { VideoPrompt } from './videoSchema';

export enum NodeType {
  Character = 'CHARACTER',
  Setting = 'SETTING',
  Script = 'SCRIPT',
  Image = 'IMAGE',
  Transformation = 'TRANSFORMATION',
  Video = 'VIDEO'
}

export interface NodeData {}

export interface CharacterData extends NodeData {
  prompt: string;
  image?: string;
  characterPassport?: CharacterPassport;
}

export interface SettingData extends NodeData {
  prompt: string;
  image?: string;
  settingPassport?: SettingPassport;
}

export interface ScriptScene {
  id: string;
  title: string;
  description: string;
  isExpanded: boolean;
  selectedSettingId?: string;
}

export interface ScriptData extends NodeData {
  script: string;
  scenes: ScriptScene[];
  cachedCharacterId?: string;
  cachedCharacterJson?: any;
  isCharacterLoading?: boolean;
  cachedSettingId?: string;
  cachedSettingJson?: any;
  isSettingLoading?: boolean;
}

export interface GenerationTrace {
  status: 'success' | 'error';
  timestamp: number;
  stepFailed?: 'traversal' | 'architect_json' | 'image_api';
  inputs?: {
    sceneText: string;
    characterText?: string;
    settingText?: string;
  };
  architectOutput?: any;
  rawError?: string;
}

export interface ImageData extends NodeData {
  prompt: string;
  image?: string;
  isLoading: boolean;
  error?: string;
  debugTrace?: GenerationTrace;
  sceneEnrichmentStatus?: 'idle' | 'loading' | 'success' | 'error';
  enrichedSceneJson?: Partial<CinematicPrompt> | CinematicJSON | null;
  mode?: 'standard' | 'transformation';
  incomingTransformationData?: {
      json?: Partial<CinematicPrompt> | CinematicJSON | null;
      referenceImage?: string;
  };
}

export interface TransformationData extends NodeData {
  modificationPrompt: string;
  transformationJson?: Partial<CinematicPrompt> | null;
  isProcessing?: boolean;
  referenceImage?: string;
}

export interface VideoData extends NodeData {
  promptSchema?: VideoPrompt | null;
  videoUrl?: string;
  isLoading: boolean;
  error?: string;
  startImage?: string;
  endImage?: string;
}

export type AnyNodeData = CharacterData | SettingData | ScriptData | ImageData | TransformationData | VideoData;

export interface Node<T extends AnyNodeData = AnyNodeData> {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: T;
}

export interface Connection {
  id:string;
  fromNodeId: string;
  fromOutput: string | number;
  toNodeId: string;
  toInputIndex: number;
}

export interface ConnectorPosition {
  nodeId: string;
  index: number;
  position: { x: number; y: number };
}

export interface Graph {
  id: string;
  name: string;
  nodes: Node[];
  connections: Connection[];
  lastModified: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
}