
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
      if (targetNode.type === NodeType.Transformation && sourceNode.type === NodeType.Image) {
          const sourceData = sourceNode.data as ImageData;
          const targetData = targetNode.data as TransformationData;

          // [FIX] DETECT SOURCE TYPE:
          // Si el nodo de imagen viene de una transformación previa, usamos "incomingTransformationData".
          // Si viene de un script estándar, usamos "enrichedSceneJson".
          const activeJson = sourceData.mode === 'transformation'
              ? sourceData.incomingTransformationData?.json
              : sourceData.enrichedSceneJson;

          // Serializamos para comparar cambios
          const sourceJsonStr = JSON.stringify(activeJson);
          const targetJsonStr = JSON.stringify(targetData.sourceJson);

          // Si hay una imagen válida Y un JSON válido (de cualquiera de los dos orígenes)
          if (sourceData.image && activeJson) {
              if (
                  targetData.referenceImage !== sourceData.image ||
                  sourceJsonStr !== targetJsonStr
              ) {
                  console.log(`🔄 [Enricher] Propagating Data to Transformation: ${sourceData.mode === 'transformation' ? '(Chained)' : '(Standard)'}`);
                  
                  updateNodeData(targetNode.id, { 
                      referenceImage: sourceData.image,
                      sourceJson: activeJson as any // Pasamos el JSON activo, sea cual sea su origen
                  });
              }
          }
      }

      // 3. Transformation -> Image Sync (Recursividad Infinita)
      if (targetNode.type === NodeType.Image && sourceNode.type === NodeType.Transformation) {
          const transformData = sourceNode.data as TransformationData;
          const imageData = targetNode.data as ImageData;
          
          // Datos que salen del nodo de transformación anterior
          const jsonOut = transformData.transformationJson;
          
          // IMPORTANTE: Para la imagen, priorizamos la que se muestra en el nodo de transformación (si existiera una preview final)
          // Pero como el nodo de transformación es "lógico", la imagen resultante en realidad se genera en el SIGUIENTE nodo de imagen.
          // Por lo tanto, lo que pasamos aquí es la "Instrucción" para que el nodo de imagen se autogenere.
          
          const refImage = transformData.referenceImage; // La imagen base original

          if (jsonOut && refImage) {
              const incomingJsonStr = JSON.stringify(jsonOut);
              const currentJsonStr = JSON.stringify(imageData.incomingTransformationData?.json);

              // Evitar bucles infinitos
              if (
                  imageData.mode !== 'transformation' || 
                  incomingJsonStr !== currentJsonStr
              ) {
                  console.log(`🔗 Chaining Transformation: ${sourceNode.id} -> ${targetNode.id}`);
                  
                  updateNodeData(targetNode.id, {
                      mode: 'transformation',
                      incomingTransformationData: {
                          json: jsonOut,        // El JSON transformado se convierte en el nuevo "Script"
                          referenceImage: refImage // Pasamos la imagen base (o podríamos pasar la resultante si la tuviéramos)
                      },
                      enrichedSceneJson: null, // Limpiamos datos viejos
                      sceneEnrichmentStatus: 'success'
                  });
              }
          }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, nodes]); 
};
