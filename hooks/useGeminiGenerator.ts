import { useState, useCallback } from 'react';
import { Node, Connection, NodeType, ScriptData, CharacterData, SettingData, ImageData, TransformationData, VideoData, GenerationTrace } from '../types/graph';
import { generateSceneImage, generateVeoPrompt } from '../services/geminiService';
import { enrichSceneDescription, fetchCharacterPassport, fetchCinematicSpec } from '../services/promptArchitect';

export const useGeminiGenerator = (
  nodes: Node[], 
  connections: Connection[], 
  updateNodeData: (id: string, data: any) => void
) => {
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Ahora aceptamos cualquier tipo de nodo compatible
  const generateImage = useCallback(async (targetNode: Node<any>) => {
      
      // --- RAMA DE VIDEO (VEO DIRECTOR) ---
      if (targetNode.type === NodeType.Video) {
          const videoNode = targetNode as Node<VideoData>;
          updateNodeData(videoNode.id, { isLoading: true, error: undefined });

          try {
              // 1. Rastrear Inputs (Imágenes de Inicio y Fin)
              const startConn = connections.find(c => c.toNodeId === videoNode.id && c.toInputIndex === 0);
              const endConn = connections.find(c => c.toNodeId === videoNode.id && c.toInputIndex === 1);

              let startImage: string | undefined;
              let endImage: string | undefined;

              if (startConn) {
                  const source = nodes.find(n => n.id === startConn.fromNodeId);
                  if (source && (source.data as ImageData).image) {
                      startImage = (source.data as ImageData).image;
                  }
              }
              if (endConn) {
                  const source = nodes.find(n => n.id === endConn.fromNodeId);
                  if (source && (source.data as ImageData).image) {
                      endImage = (source.data as ImageData).image;
                  }
              }

              // 2. Obtener Prompt de Movimiento
              const movement = videoNode.data.movementPrompt || "Cinematic shot";

              // 3. Llamar al Cerebro VEO
              const promptSchema = await generateVeoPrompt(startImage, endImage, movement);

              if (!promptSchema) throw new Error("Failed to generate VEO prompt.");

              // 4. Guardar Resultado
              updateNodeData(videoNode.id, {
                  isLoading: false,
                  promptSchema: promptSchema,
                  startImage, // Guardamos snapshot de qué se usó
                  endImage
              });

          } catch (err) {
              console.error(err);
              const msg = err instanceof Error ? err.message : "Video generation failed";
              updateNodeData(videoNode.id, { isLoading: false, error: msg });
          }
          return; // Terminamos aquí para Video
      }

      // --- RAMA DE IMAGEN (STANDARD / TRANSFORMATION) ---
      const imageNode = targetNode as Node<ImageData>;
      
      // Initialize Trace Object
      const currentTrace: GenerationTrace = {
          status: 'success',
          timestamp: Date.now(),
          stepFailed: undefined,
          inputs: { sceneText: '' }
      };

      updateNodeData(imageNode.id, { isLoading: true, error: undefined, debugTrace: undefined });
      
      try {
          // Step A: Traversal & Input Resolution
          currentTrace.stepFailed = 'traversal';

          const inputConnection = connections.find(c => c.toNodeId === imageNode.id);
          if (!inputConnection) throw new Error("Image node is not connected.");

          const inputNode = nodes.find(n => n.id === inputConnection.fromNodeId);
          if (!inputNode) throw new Error("Input node not found.");

          let promptString = "";
          let referenceImages: string[] = [];

          // --- CASO 1: SCRIPT -> IMAGE ---
          if (inputNode.type === NodeType.Script) {
              const scriptNode = inputNode as Node<ScriptData>;
              const fromOutput = inputConnection.fromOutput;
              const scene = typeof fromOutput === 'string'
                  ? scriptNode.data.scenes.find(s => s.id === fromOutput)
                  : scriptNode.data.scenes[fromOutput as number];
              
              if (!scene) throw new Error("Invalid scene index or ID.");
              
              currentTrace.inputs!.sceneText = scene.description;

              // Contexto Personaje
              const charConnection = connections.find(c => c.toNodeId === scriptNode.id && c.toInputIndex === 0);
              const characterNode = nodes.find(n => n.id === charConnection?.fromNodeId) as Node<CharacterData> | undefined;
              
              // Contexto Escenario
              const settingConnections = connections.filter(c => c.toNodeId === scriptNode.id && c.toInputIndex === 1);
              const connectedSettings = settingConnections
                                          .map(c => nodes.find(n => n.id === c.fromNodeId) as Node<SettingData>)
                                          .filter(n => n);
              
              let targetSettingNode: Node<SettingData> | undefined;
              if (scene.selectedSettingId) {
                  targetSettingNode = connectedSettings.find(n => n.id === scene.selectedSettingId);
              }
              if (!targetSettingNode && connectedSettings.length > 0) {
                  targetSettingNode = connectedSettings[0];
              }

              // Pasaportes
              let passport = characterNode?.data.characterPassport;
              if (characterNode && characterNode.data.prompt && !passport) {
                   passport = await fetchCharacterPassport(characterNode.data.prompt);
                   if (passport) updateNodeData(characterNode.id, { characterPassport: passport });
              }
              let settingPassport = targetSettingNode?.data.settingPassport || null;

              // Generación JSON
              currentTrace.stepFailed = 'architect_json';
              const cinematicSpec = await fetchCinematicSpec(scene.description, passport || null, settingPassport);
              
              if (!cinematicSpec) throw new Error("Failed to generate cinematic specification.");
              
              currentTrace.architectOutput = cinematicSpec;
              promptString = JSON.stringify(cinematicSpec, null, 2);
              
              if (characterNode?.data.image) referenceImages.push(characterNode.data.image);
              if (targetSettingNode?.data.image) referenceImages.push(targetSettingNode.data.image);

          } 
          // --- CASO 2: TRANSFORMATION -> IMAGE ---
          else if (inputNode.type === NodeType.Transformation) {
              const transformNode = inputNode as Node<TransformationData>;
              const modificationPrompt = transformNode.data.modificationPrompt;
              
              if (!modificationPrompt) throw new Error("Transformation prompt is empty.");
              
              currentTrace.inputs!.sceneText = `[Transformation] ${modificationPrompt}`;
              currentTrace.stepFailed = 'architect_json';
              
              let transformationJson = transformNode.data.transformationJson;
              if (!transformationJson) {
                  // Fallback: Generate V2 spec if not already processed by node
                  transformationJson = await fetchCinematicSpec(modificationPrompt, null, null);
                  if (transformationJson) {
                      updateNodeData(transformNode.id, { transformationJson }); 
                  }
              }
              
              if (!transformationJson) throw new Error("Failed to generate transformation spec.");

              currentTrace.architectOutput = transformationJson;
              promptString = JSON.stringify(transformationJson, null, 2);

              const refConnection = connections.find(c => c.toNodeId === transformNode.id);
              if (!refConnection) throw new Error("Transformation node needs a reference image input.");
              const refImageNode = nodes.find(n => n.id === refConnection.fromNodeId);
              if (!refImageNode || refImageNode.type !== NodeType.Image) throw new Error("Transformation input must be an Image Node.");
              
              const refImageData = refImageNode.data as ImageData;
              if (!refImageData.image) throw new Error("Reference image is missing.");
              
              referenceImages.push(refImageData.image);
          } 
          
          // Step E: Generate Image
          currentTrace.stepFailed = 'image_api';
          const imageData = await generateSceneImage({
              prompt: promptString, 
              images: referenceImages
          });

          delete currentTrace.stepFailed;
          updateNodeData(imageNode.id, { 
              image: imageData, 
              isLoading: false, 
              prompt: promptString, 
              debugTrace: currentTrace
          });

      } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "Error";
          currentTrace.status = 'error';
          currentTrace.rawError = errorMessage;
          updateNodeData(imageNode.id, { isLoading: false, error: errorMessage, debugTrace: currentTrace });
      }
  }, [nodes, connections, updateNodeData]);

  const generateAll = useCallback(async () => {
    setIsGeneratingAll(true);
    
    // Explicitly check type and cast data to ImageData to satisfy TS check for isLoading
    const imageNodesToGenerate = nodes.filter((node): node is Node<ImageData> => {
        return node.type === NodeType.Image && !(node.data as ImageData).isLoading;
    });

    for (const node of imageNodesToGenerate) {
        await generateImage(node);
    }

    setIsGeneratingAll(false);
  }, [nodes, connections, generateImage]);

  return { generateImage, generateAll, isGeneratingAll };
};