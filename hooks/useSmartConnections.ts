
import { useEffect } from 'react';
import { Node, Connection, NodeType, ScriptData, CharacterData, SettingData } from '../types/graph';
import { enrichCharacter, enrichSetting } from '../services/promptArchitect';

export const useSmartConnections = (
  nodes: Node[],
  connections: Connection[],
  updateNodeData: (id: string, data: any) => void
) => {
  useEffect(() => {
    nodes.forEach(node => {
      if (node.type !== NodeType.Script) return;
      const scriptData = node.data as ScriptData;

      // 1. Handle Character Connection (Input 0)
      const charConn = connections.find(c => c.toNodeId === node.id && c.toInputIndex === 0);
      if (charConn) {
        const charNode = nodes.find(n => n.id === charConn.fromNodeId) as Node<CharacterData>;
        // If a character is connected, and it's a NEW connection (or ID mismatch), trigger enrichment
        if (charNode && scriptData.cachedCharacterId !== charNode.id && !scriptData.isCharacterLoading) {
             
             // Mark as loading immediately to prevent duplicate calls
             updateNodeData(node.id, { isCharacterLoading: true });
             
             enrichCharacter("Main Character", charNode.data.prompt, charNode.data.image)
                .then(json => {
                    updateNodeData(node.id, { 
                        isCharacterLoading: false, 
                        cachedCharacterId: charNode.id,
                        cachedCharacterJson: json 
                    });
                })
                .catch(err => {
                    console.error("Character enrichment failed", err);
                    // Reset loading but keep ID so we don't loop endlessly on failure
                    updateNodeData(node.id, { isCharacterLoading: false, cachedCharacterId: charNode.id });
                });
        }
      } else {
          // Disconnected - clear cache if it exists
          if (scriptData.cachedCharacterId) {
              updateNodeData(node.id, { 
                  cachedCharacterId: undefined, 
                  cachedCharacterJson: undefined,
                  isCharacterLoading: false 
              });
          }
      }

      // 2. Handle Setting Connection (Input 1)
      const settingConn = connections.find(c => c.toNodeId === node.id && c.toInputIndex === 1);
      if (settingConn) {
        const settingNode = nodes.find(n => n.id === settingConn.fromNodeId) as Node<SettingData>;
        if (settingNode && scriptData.cachedSettingId !== settingNode.id && !scriptData.isSettingLoading) {
             
             updateNodeData(node.id, { isSettingLoading: true });
             
             enrichSetting(settingNode.data.prompt, settingNode.data.image)
                .then(json => {
                    updateNodeData(node.id, { 
                        isSettingLoading: false, 
                        cachedSettingId: settingNode.id,
                        cachedSettingJson: json 
                    });
                })
                .catch(err => {
                    console.error("Setting enrichment failed", err);
                    updateNodeData(node.id, { isSettingLoading: false, cachedSettingId: settingNode.id });
                });
        }
      } else {
           if (scriptData.cachedSettingId) {
              updateNodeData(node.id, { 
                  cachedSettingId: undefined, 
                  cachedSettingJson: undefined,
                  isSettingLoading: false 
              });
          }
      }

    });
  }, [nodes, connections, updateNodeData]);
};
