import { useState, useEffect, useRef, useCallback } from 'react';
import { saveProject, loadProject, deleteProject } from '../services/persistence/db';
import { Graph } from '../types/graph';

export type SavingStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export const usePersistence = (
  currentGraph: Graph, 
  projectId: string = 'main-storyboard'
) => {
  const [status, setStatus] = useState<SavingStatus>('idle');
  
  // Safety Lock: Do not save until we have attempted to load at least once.
  // This prevents overwriting the DB with an empty state on initial mount.
  const isLoadedRef = useRef(false);

  // 1. Function to load initial data (Called once by the consumer)
  const loadInitialData = useCallback(async (): Promise<Graph | null> => {
    setStatus('loading');
    try {
      const data = await loadProject(projectId);
      isLoadedRef.current = true; // It is now safe to save future changes
      setStatus('idle');
      return data || null;
    } catch (error) {
      console.error("Error loading project:", error);
      setStatus('error');
      // Unlock to allow future saves even if load failed (e.g. fresh start)
      isLoadedRef.current = true; 
      return null;
    }
  }, [projectId]);

  // 2. Auto-Save Effect (Debounced)
  useEffect(() => {
    // If we haven't loaded initial data yet, DO NOT save.
    if (!isLoadedRef.current) return;

    setStatus('saving');

    let idleCallbackId: number | undefined;

    // Wait 2 seconds of inactivity before saving
    const timeoutId = setTimeout(() => {
      // NON-BLOCKING SAVE:
      // Use requestIdleCallback to schedule serialization/saving when the main thread is free.
      // This prevents the UI from freezing if the graph contains large images.
      idleCallbackId = window.requestIdleCallback(async () => {
        try {
          await saveProject(projectId, currentGraph);
          setStatus('saved');
        } catch (error) {
          console.error("Error auto-saving:", error);
          setStatus('error');
        }
      });
    }, 2000);

    // Cleanup: If user makes changes before 2s OR before the idle callback runs, cancel everything.
    return () => {
      clearTimeout(timeoutId);
      if (idleCallbackId !== undefined) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };

  }, [currentGraph, projectId]);

  // 3. Manual Cleanup Function
  const clearStorage = useCallback(async () => {
    // Block visual status to prevent confusion, though technically auto-save effect might still be pending.
    setStatus('saving'); 
    try {
      await deleteProject(projectId);
      // Optional: Reset isLoadedRef if you want to stop subsequent auto-saves until reload
      // isLoadedRef.current = false; 
      setStatus('idle');
    } catch (e) {
      console.error("Error clearing storage:", e);
      setStatus('error');
    }
  }, [projectId]);

  return { status, loadInitialData, clearStorage };
};