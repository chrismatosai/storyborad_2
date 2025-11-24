import { NodeType } from '../../types/graph';

export interface NodeConfigItem {
  title: string;
  width: number;
  inputs: string[];
  outputs: string[];
  color: string;
}

export const NODE_CONFIG: Record<NodeType, NodeConfigItem> = {
  [NodeType.Character]: {
    title: 'Character',
    width: 250,
    inputs: [],
    outputs: ['character'],
    color: 'bg-blue-800',
  },
  [NodeType.Setting]: {
    title: 'Setting',
    width: 250,
    inputs: [],
    outputs: ['setting'],
    color: 'bg-green-800',
  },
  [NodeType.Script]: {
    title: 'Script',
    width: 350,
    inputs: [], // Custom rendered in component
    outputs: [], // Dynamically generated
    color: 'bg-purple-800',
  },
  [NodeType.Image]: {
    title: 'Image Scene',
    width: 300,
    inputs: ['prompt'],
    outputs: [], // Custom rendered in component to ensure persistence
    color: 'bg-yellow-800',
  },
  [NodeType.Transformation]: {
    title: 'Transformation',
    width: 300,
    inputs: ['Ref Image'],
    outputs: ['To Image'],
    color: 'bg-pink-800',
  },
  [NodeType.Video]: {
    title: 'Video Prompter',
    width: 340,
    inputs: ['Start Frame', 'End Frame'],
    outputs: [],
    color: 'bg-indigo-900',
  },
};