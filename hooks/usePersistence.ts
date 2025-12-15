import { useState, useEffect, useRef, useCallback } from 'react';
import { saveProject, loadProject, deleteProject } from '../services/persistence/db';
import { Graph } from '../types/graph';

export type SavingStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export const usePersistence = (
  currentGraph: Graph, 
  projectId: string = 'main-storyboard'
) => {
  const [status, setStatus] = useState<SavingStatus>('idle');
  const isLoadedRef = useRef(false);
  
  // ALMACÉN DE ESTADO: Guardamos la "huella digital" (string JSON) del último guardado exitoso.
  const lastSavedStr = useRef<string>("");

  // 1. Cargar Datos Iniciales
  const loadInitialData = useCallback(async (): Promise<Graph | null> => {
    setStatus('loading');
    try {
      const data = await loadProject(projectId);
      if (data) {
          // Generamos la huella inicial para no guardar nada más cargar
          const content = { nodes: data.nodes, connections: data.connections };
          lastSavedStr.current = JSON.stringify(content);
      }
      isLoadedRef.current = true; // Habilitamos el sistema
      setStatus('idle');
      return data || null;
    } catch (error) {
      console.error("Error loading project:", error);
      setStatus('error');
      isLoadedRef.current = true;
      return null;
    }
  }, [projectId]);

  // 2. Efecto de Auto-Guardado Inteligente
  useEffect(() => {
    // Si no hemos cargado aún, no hacemos nada.
    if (!isLoadedRef.current) return;

    // A. CREAR HUELLA DIGITAL ACTUAL
    // Solo nos importan los nodos y las conexiones. Ignoramos timestamps, IDs de sesión, zoom, etc.
    const currentContent = { 
        nodes: currentGraph.nodes, 
        connections: currentGraph.connections 
    };
    const currentStr = JSON.stringify(currentContent);

    // B. COMPARACIÓN ESTRICTA (EL ESCUDO)
    // Si la cadena de texto es idéntica a la última guardada, NO HAY CAMBIOS REALES.
    if (currentStr === lastSavedStr.current) {
        // Silenciosamente ignoramos la actualización.
        return;
    }

    // C. Si llegamos aquí, ES PORQUE EL USUARIO CAMBIÓ ALGO.
    setStatus('saving');

    const timeoutId = setTimeout(() => {
        const idleId = window.requestIdleCallback(async () => {
            try {
                // Doble chequeo por seguridad (por si el usuario deshizo el cambio rápido)
                if (currentStr === lastSavedStr.current) {
                    setStatus('saved');
                    return;
                }

                console.log(`💾 Persisting changes (${currentGraph.nodes.length} nodes)...`);
                await saveProject(projectId, currentGraph);
                
                // Actualizamos la huella de referencia
                lastSavedStr.current = currentStr;
                setStatus('saved');
            } catch (error) {
                console.error("Error auto-saving:", error);
                setStatus('error');
            }
        });

        return () => window.cancelIdleCallback(idleId);
    }, 2000); // Debounce de 2 segundos

    return () => clearTimeout(timeoutId);

  }, [currentGraph, projectId]); 

  // 3. Limpieza Manual
  const clearStorage = useCallback(async () => {
    setStatus('saving');
    try {
      await deleteProject(projectId);
      lastSavedStr.current = ""; 
      setStatus('idle');
    } catch (e) {
      console.error("Error clearing storage:", e);
      setStatus('error');
    }
  }, [projectId]);

  return { status, loadInitialData, clearStorage };
};