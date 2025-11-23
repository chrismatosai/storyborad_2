
import { useState, useCallback } from 'react';
import { Node, Connection, NodeType, ScriptData, CharacterData, SettingData, ImageData, TransformationData, GenerationTrace } from '../types/graph';
import { generateSceneImage } from '../services/geminiService';
import { enrichSceneDescription, assembleMasterPrompt, fetchCharacterPassport, fetchCinematicSpec } from '../services/promptArchitect';

export const useGeminiGenerator = (
  nodes: Node[], 
  connections: Connection[], 
  updateNodeData: (id: string, data: any) => void
) => {
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const generateImage = useCallback(async (imageNode: Node<ImageData>) => {
      // Initialize Trace Object
      const currentTrace: GenerationTrace = {
          status: 'success',
          timestamp: Date.now(),
          stepFailed: undefined,
          inputs: {
              sceneText: '',
          }
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

          // --- PATH 1: SCRIPT -> IMAGE (V2 Architect Flow) ---
          if (inputNode.type === NodeType.Script) {
              const scriptNode = inputNode as Node<ScriptData>;
              const fromOutput = inputConnection.fromOutput;
              const scene = typeof fromOutput === 'string'
                  ? scriptNode.data.scenes.find(s => s.id === fromOutput)
                  : scriptNode.data.scenes[fromOutput as number];
              
              if (!scene) throw new Error("Invalid scene index or ID.");
              
              currentTrace.inputs!.sceneText = scene.description;

              // 1. Get Character Context (Input 0)
              const charConnection = connections.find(c => c.toNodeId === scriptNode.id && c.toInputIndex === 0);
              const characterNode = nodes.find(n => n.id === charConnection?.fromNodeId) as Node<CharacterData> | undefined;
              
              if (characterNode?.data.prompt) currentTrace.inputs!.characterText = characterNode.data.prompt;

              // 2. Get Setting Context (Input 1) - NEW SELECTION LOGIC
              // Find ALL connected settings
              const settingConnections = connections.filter(c => c.toNodeId === scriptNode.id && c.toInputIndex === 1);
              const connectedSettings = settingConnections
                                          .map(c => nodes.find(n => n.id === c.fromNodeId) as Node<SettingData>)
                                          .filter(n => n);
              
              let targetSettingNode: Node<SettingData> | undefined;

              // A. Explicit Selection
              if (scene.selectedSettingId) {
                  targetSettingNode = connectedSettings.find(n => n.id === scene.selectedSettingId);
                  if (targetSettingNode) {
                      console.log(`🎯 [Generator] Using Selected Setting: ${targetSettingNode.id}`);
                  }
              }
              
              // B. Fallback: If no selection (or selected node disconnected), use the first one available
              if (!targetSettingNode && connectedSettings.length > 0) {
                  targetSettingNode = connectedSettings[0];
                  console.log("⚠️ [Generator] Using Default Setting (First found)");
              }

              if (targetSettingNode?.data.prompt) currentTrace.inputs!.settingText = targetSettingNode.data.prompt;


              // 3. Handle Character Passport (The "Visual DNA")
              let passport = characterNode?.data.characterPassport;
              
              // If we have a character description but no passport yet, generate and cache it.
              if (characterNode && characterNode.data.prompt && !passport) {
                   console.log("🧬 Generating Character Passport...");
                   passport = await fetchCharacterPassport(characterNode.data.prompt);
                   if (passport) {
                       // Cache it in the character node so we don't regenerate every time
                       updateNodeData(characterNode.id, { characterPassport: passport });
                   }
              }

              // 4. Handle Setting Passport (The "Environment DNA")
              let settingPassport = targetSettingNode?.data.settingPassport || null;

              // 5. Architect Step: Generate Cinematic JSON
              currentTrace.stepFailed = 'architect_json';
              
              // We use the V2 "buildScenePrompt" flow which handles the prompt construction internally
              const cinematicSpec = await fetchCinematicSpec(scene.description, passport || null, settingPassport);
              
              if (!cinematicSpec) throw new Error("Failed to generate cinematic specification.");
              
              currentTrace.architectOutput = cinematicSpec;
              
              // 6. Serialize for Image Gen
              promptString = JSON.stringify(cinematicSpec, null, 2);
              
              // Add references if available
              if (characterNode?.data.image) referenceImages.push(characterNode.data.image);
              if (targetSettingNode?.data.image) referenceImages.push(targetSettingNode.data.image);

          } 
          // --- PATH 2: TRANSFORMATION -> IMAGE ---
          else if (inputNode.type === NodeType.Transformation) {
              const transformNode = inputNode as Node<TransformationData>;
              const modificationPrompt = transformNode.data.modificationPrompt;
              
              if (!modificationPrompt) throw new Error("Transformation prompt is empty.");
              
              currentTrace.inputs!.sceneText = `[Transformation] ${modificationPrompt}`;

              // Ensure JSON exists (Architect step)
              currentTrace.stepFailed = 'architect_json';
              let transformationJson = transformNode.data.transformationJson;
              
              if (!transformationJson) {
                  // If not present (didn't trigger blur), generate it now
                  transformationJson = await enrichSceneDescription(modificationPrompt);
                  // We update the node data so the UI reflects this generation
                  updateNodeData(transformNode.id, { transformationJson }); 
              }
              
              currentTrace.architectOutput = transformationJson;
              promptString = JSON.stringify(transformationJson, null, 2);

              // Look Back Further: Find the node connected to the *Input* of that Transformation Node.
              const refConnection = connections.find(c => c.toNodeId === transformNode.id);
              if (!refConnection) throw new Error("Transformation node needs a reference image input.");
              
              const refImageNode = nodes.find(n => n.id === refConnection.fromNodeId);
              // Verify it is an ImageNode
              if (!refImageNode || refImageNode.type !== NodeType.Image) throw new Error("Transformation input must be an Image Node.");
              
              // Retrieve its generated base64 image
              const refImageData = refImageNode.data as ImageData;
              if (!refImageData.image) throw new Error("Reference image is missing from the previous node. Please generate the source image first.");
              
              referenceImages.push(refImageData.image);
          } 
          else {
              throw new Error(`Unsupported input node type: ${inputNode.type}`);
          }
          
          // Step E: Generate Image with Gemini Service
          currentTrace.stepFailed = 'image_api';

          // Use the updated generateSceneImage signature which accepts optional images
          const imageData = await generateSceneImage({
              prompt: promptString, // The Transformation JSON or Master Prompt JSON
              images: referenceImages // The reference image for Image-to-Image
          });

          // Success - Clean up trace
          delete currentTrace.stepFailed;

          // Update node with image and the full JSON prompt used
          updateNodeData(imageNode.id, { 
              image: imageData, 
              isLoading: false, 
              prompt: promptString, 
              debugTrace: currentTrace
          });

      } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
          
          // Record failure in trace
          currentTrace.status = 'error';
          currentTrace.rawError = errorMessage;

          updateNodeData(imageNode.id, { 
              isLoading: false, 
              error: errorMessage,
              debugTrace: currentTrace
          });
      }
  }, [nodes, connections, updateNodeData]);

  const generateAll = useCallback(async () => {
    setIsGeneratingAll(true);
    const imageNodesToGenerate = nodes.filter(
        (node): node is Node<ImageData> => {
            if (node.type !== NodeType.Image) {
                return false;
            }
            const data = node.data as ImageData;
            // Generate if connected, even if it has a prompt (re-generate) or if it's empty
            const isConnected = connections.some(c => c.toNodeId === node.id);
            return isConnected && !data.isLoading;
        }
    );

    if (imageNodesToGenerate.length === 0) {
        alert("No connected and ready image scenes to generate.");
        setIsGeneratingAll(false);
        return;
    }
    
    const generationPromises = imageNodesToGenerate.map(node => generateImage(node).catch(e => e));

    try {
        await Promise.all(generationPromises);
    } catch (error) {
        console.error("An error occurred during bulk generation:", error);
        alert("One or more images failed to generate. Check individual nodes for errors.");
    } finally {
        setIsGeneratingAll(false);
    }
  }, [nodes, connections, generateImage]);

  return { generateImage, generateAll, isGeneratingAll };
};
