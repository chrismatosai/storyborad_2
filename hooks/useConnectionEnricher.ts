
import { useEffect } from 'react';
import { Node, Connection, NodeType, ScriptData, ImageData, TransformationData, CharacterData, SettingData } from '../types/graph';
import { fetchCinematicSpec, fetchCharacterPassport, enrichSceneDescription } from '../services/promptArchitect';

export const useConnectionEnricher = (
  nodes: Node[],
  connections: Connection[],
  updateNodeData: (id: string, data: any) => void,
  // We accept this argument to keep the signature compatible with existing calls, 
  // but internally we might prioritize the V2 architecture functions
  legacyEnricher: (text: string) => Promise<any>
) => {
  useEffect(() => {
    connections.forEach(async (conn) => {
      const targetNode = nodes.find((n) => n.id === conn.toNodeId);
      const sourceNode = nodes.find((n) => n.id === conn.fromNodeId);

      if (!targetNode || !sourceNode) return;

      // 1. Script -> Image Enrichment (Upgraded to V2 Architecture)
      if (targetNode.type === NodeType.Image && sourceNode.type === NodeType.Script) {
          const imageData = targetNode.data as ImageData;
          const scriptData = sourceNode.data as ScriptData;

          // Skip if we are in transformation mode to prevent overwriting with standard script logic
          if (imageData.mode === 'transformation') return;

          // Skip if already enriched, loading, or success
          if (
            imageData.enrichedSceneJson ||
            imageData.sceneEnrichmentStatus === 'loading' ||
            imageData.sceneEnrichmentStatus === 'success'
          ) {
            return;
          }

          const fromOutput = conn.fromOutput;
          let sceneText = '';
          let selectedSettingId: string | undefined;

          if (typeof fromOutput === 'string') {
            const scene = scriptData.scenes.find((s) => s.id === fromOutput);
            if (scene) {
                sceneText = scene.description;
                selectedSettingId = scene.selectedSettingId;
            }
          } else {
            const scene = scriptData.scenes[fromOutput as number];
            if (scene) {
                sceneText = scene.description;
                selectedSettingId = scene.selectedSettingId;
            }
          }

          if (!sceneText) return;

          // Trigger Enrichment
          updateNodeData(targetNode.id, { sceneEnrichmentStatus: 'loading' });

          try {
            // V2 ARCHITECTURE IMPLEMENTATION
            // 1. Try to find a connected character to the SCRIPT node (not the image node)
            const charConn = connections.find(c => c.toNodeId === sourceNode.id && c.toInputIndex === 0);
            const charNode = charConn ? nodes.find(n => n.id === charConn.fromNodeId) : null;
            
            let passport = null;

            if (charNode && charNode.type === NodeType.Character) {
                const charData = charNode.data as CharacterData;
                
                // Strategy: If we have a cached passport, use it. 
                // If not, but we have a prompt, generate it on the fly to ensure V2 consistency.
                if (charData.characterPassport) {
                    passport = charData.characterPassport;
                } else if (charData.prompt) {
                    // Generate passport ad-hoc (without updating the char node to avoid side-effects in this hook)
                    passport = await fetchCharacterPassport(charData.prompt);
                    // Optionally cache it back if desired:
                    if (passport) {
                        updateNodeData(charNode.id, { characterPassport: passport });
                    }
                }
            }

            // 2. Try to find a connected setting to the SCRIPT node
            // Find ALL connected settings to the script node
            const settingConns = connections.filter(c => c.toNodeId === sourceNode.id && c.toInputIndex === 1);
            const connectedSettings = settingConns.map(c => nodes.find(n => n.id === c.fromNodeId)).filter(n => n) as Node<SettingData>[];
            
            let settingNode: Node<SettingData> | undefined;

            if (selectedSettingId) {
                settingNode = connectedSettings.find(n => n.id === selectedSettingId);
                if(settingNode) console.log(`🎯 [Enricher] Selected Setting: ${settingNode.id}`);
            }
            
            // Fallback: Use the first available setting if selected one is not found
            if (!settingNode && connectedSettings.length > 0) {
                settingNode = connectedSettings[0];
                console.log("⚠️ [Enricher] Default Setting");
            }

            let settingPassport = null;
            if (settingNode && settingNode.type === NodeType.Setting) {
                const settingData = settingNode.data as SettingData;
                if (settingData.settingPassport) {
                    settingPassport = settingData.settingPassport;
                }
            }

            // 3. Generate the Scene Spec using the new V2 prompt architect
            const resultJson = await fetchCinematicSpec(sceneText, passport, settingPassport);
            
            updateNodeData(targetNode.id, {
              sceneEnrichmentStatus: 'success',
              enrichedSceneJson: resultJson,
              mode: 'standard'
            });

          } catch (error) {
            console.error('Scene enrichment failed:', error);
            updateNodeData(targetNode.id, { sceneEnrichmentStatus: 'error' });
          }
      }

      // 2. Image -> Transformation Sync (Flow: Left to Right)
      // Grabs generated image from Source Image Node and stores it as reference in Transformation Node
      if (targetNode.type === NodeType.Transformation && sourceNode.type === NodeType.Image) {
          const sourceData = sourceNode.data as ImageData;
          const targetData = targetNode.data as TransformationData;

          // Only update if source has image and it's different from target's reference
          if (sourceData.image && targetData.referenceImage !== sourceData.image) {
              updateNodeData(targetNode.id, { referenceImage: sourceData.image });
          }
      }

      // 3. Transformation -> Image Sync (Flow: Left to Right)
      // Propagates Transformation JSON and Reference Image to the Destination Image Node
      if (targetNode.type === NodeType.Image && sourceNode.type === NodeType.Transformation) {
          const transformData = sourceNode.data as TransformationData;
          const imageData = targetNode.data as ImageData;
          
          const json = transformData.transformationJson;
          const base64 = transformData.referenceImage;

          // Only propagate if we have valid transformation data (Reference Image + JSON Instruction)
          if (json && base64) {
              
              const incomingJsonStr = JSON.stringify(json);
              const currentJsonStr = JSON.stringify(imageData.incomingTransformationData?.json);
              const incomingRef = base64;
              const currentRef = imageData.incomingTransformationData?.referenceImage;

              // Check if update is needed to avoid infinite loop
              if (
                  imageData.mode !== 'transformation' || 
                  incomingJsonStr !== currentJsonStr || 
                  incomingRef !== currentRef
              ) {
                  updateNodeData(targetNode.id, {
                      mode: 'transformation',
                      incomingTransformationData: {
                          json: json,
                          referenceImage: base64 
                      },
                      enrichedSceneJson: null,
                      sceneEnrichmentStatus: 'success'
                  });
              }
          }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, nodes]); 
};
