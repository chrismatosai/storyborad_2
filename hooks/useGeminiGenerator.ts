
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

          let promptString = "";
          let referenceImages: string[] = [];
          let cinematicSpec: any = null;

          // 1. Identificar Conexiones por Puerto
          // Input 1 = Script / Prompt (Texto) or Transformation
          const scriptConnection = connections.find(c => c.toNodeId === imageNode.id && c.toInputIndex === 1);
          // Input 0 = Visual Ref (Imagen)
          const refConnection = connections.find(c => c.toNodeId === imageNode.id && c.toInputIndex === 0);
          
          // Resolve Input Node
          const inputNode = scriptConnection ? nodes.find(n => n.id === scriptConnection.fromNodeId) : null;

          // PRIORITY 1: Pre-injected Transformation Data (Chaining / Recursion)
          // Si este nodo ya recibió un JSON transformado desde el paso anterior, ÚSALO.
          if (imageNode.data.mode === 'transformation' && imageNode.data.incomingTransformationData?.json) {
              console.log("♻️ Using chained transformation JSON");
              cinematicSpec = imageNode.data.incomingTransformationData.json;
              promptString = JSON.stringify(cinematicSpec, null, 2);
              
              currentTrace.architectOutput = cinematicSpec;
              currentTrace.inputs!.sceneText = `[Transformation] based on previous node`;

              // También necesitamos la imagen de referencia que viene del nodo anterior
              if (imageNode.data.incomingTransformationData.referenceImage) {
                 referenceImages.push(imageNode.data.incomingTransformationData.referenceImage);
              }
          }
          // PRIORITY 2: Direct Script Connection (Standard Flow)
          else if (inputNode && inputNode.type === NodeType.Script) {
                  const scriptNode = inputNode as Node<ScriptData>;
                  const fromOutput = scriptConnection!.fromOutput;
                  const scene = typeof fromOutput === 'string'
                      ? scriptNode.data.scenes.find(s => s.id === fromOutput)
                      : scriptNode.data.scenes[fromOutput as number];
                  
                  if (!scene) throw new Error("Invalid scene index or ID.");
                  
                  currentTrace.inputs!.sceneText = scene.description;

                  // Contexto Personaje (Conectado al Script)
                  const charConnection = connections.find(c => c.toNodeId === scriptNode.id && c.toInputIndex === 0);
                  const characterNode = nodes.find(n => n.id === charConnection?.fromNodeId) as Node<CharacterData> | undefined;
                  
                  // Contexto Escenario (Conectado al Script)
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
                  cinematicSpec = await fetchCinematicSpec(scene.description, passport || null, settingPassport);
                  
                  if (!cinematicSpec) throw new Error("Failed to generate cinematic specification.");
                  
                  currentTrace.architectOutput = cinematicSpec;
                  promptString = JSON.stringify(cinematicSpec, null, 2);
                  
                  // Inyectar imágenes de contexto del script (Legacy/Implicit Refs)
                  if (characterNode?.data.image) referenceImages.push(characterNode.data.image);
                  if (targetSettingNode?.data.image) referenceImages.push(targetSettingNode.data.image);
          } 
          // PRIORITY 3: Fallback (Manual Prompt)
          else {
              // Si tiene prompt manual (legacy), lo usamos
               if (imageNode.data.prompt) promptString = imageNode.data.prompt;
          }

          // --- FINAL CHECK ---
          if (!promptString && !imageNode.data.image) {
               throw new Error("Connect a Script (Input 2) or Upload an Image.");
          }

          // --- VISUAL REF INJECTION (Input 0 - GLOBAL) ---
          if (refConnection) {
               const refNode = nodes.find(n => n.id === refConnection.fromNodeId);
               // Si el nodo conectado tiene una imagen, la agregamos al array referenceImages
               if (refNode && (refNode.data as any).image) {
                   // Evitar duplicados exactos si es posible, aunque la API suele manejarlos
                   const img = (refNode.data as any).image;
                   if (!referenceImages.includes(img)) {
                        referenceImages.push(img);
                        console.log("🎨 Visual Reference injected from node:", refNode.id);
                   }
               }
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
              enrichedSceneJson: cinematicSpec,
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
    // MODIFICADO: Ahora filtramos también si YA tiene imagen para no gastar créditos.
    const imageNodesToGenerate = nodes.filter((node): node is Node<ImageData> => {
        return node.type === NodeType.Image && 
               !(node.data as ImageData).isLoading &&
               !(node.data as ImageData).image; // Skip si ya existe imagen
    });

    for (const node of imageNodesToGenerate) {
        await generateImage(node);
    }

    setIsGeneratingAll(false);
  }, [nodes, connections, generateImage]);

  return { generateImage, generateAll, isGeneratingAll };
};
