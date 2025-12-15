
import { useState, useCallback, useRef, MouseEvent, WheelEvent, MutableRefObject, Dispatch, SetStateAction } from 'react';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface UseViewportResult {
  viewTransform: Viewport;
  setViewTransform: Dispatch<SetStateAction<Viewport>>;
  isPanning: boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  handlers: {
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
    onWheel: (e: WheelEvent) => void;
  };
}

// 🌍 CONSTANTES DEL MUNDO (Finito)
const CANVAS_SIZE = 4000; // El mundo va de -4000 a +4000 en X e Y
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

export const useViewport = (initialViewport: Viewport = { x: 0, y: 0, zoom: 1 }): UseViewportResult => {
  const [viewTransform, setViewTransform] = useState<Viewport>(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper para mantener la cámara dentro de los límites
  const clampPosition = (val: number, zoom: number) => {
      // Calculamos el límite dinámico basado en el zoom para que el borde del canvas nunca cruce el centro de la pantalla demasiado
      // Esto es una simplificación, pero efectiva.
      const limit = CANVAS_SIZE * zoom; 
      return Math.max(-limit, Math.min(limit, val));
  };

  const onMouseDown = useCallback((e: MouseEvent) => {
    // Solo iniciar pan si es click directo en el fondo (el contenedor)
    if (e.target === e.currentTarget) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    }
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      setViewTransform(prev => ({ 
          ...prev, 
          // Aplicamos límites al mover
          x: prev.x + dx, // clampPosition(prev.x + dx, prev.zoom), <-- Opcional: Clamping estricto aquí o libre
          y: prev.y + dy 
      }));
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [isPanning]);

  const onMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.currentTarget as HTMLElement).style.cursor = 'grab';
    }
  }, [isPanning]);

  const onWheel = useCallback((e: WheelEvent) => {
    if (!containerRef.current) return;
    // e.preventDefault(); // Nota: React 18+ a veces lanza error si el evento es pasivo. Lo manejamos en CSS (overscroll-behavior).

    const zoomSpeed = 0.001; 
    const newZoom = viewTransform.zoom - e.deltaY * zoomSpeed;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    const canvasRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    const mouseOnCanvasX = (mouseX - viewTransform.x) / viewTransform.zoom;
    const mouseOnCanvasY = (mouseY - viewTransform.y) / viewTransform.zoom;

    const newX = mouseX - mouseOnCanvasX * clampedZoom;
    const newY = mouseY - mouseOnCanvasY * clampedZoom;

    setViewTransform({ 
        x: newX, 
        y: newY, 
        zoom: clampedZoom 
    });
  }, [viewTransform]);

  return {
    viewTransform,
    setViewTransform,
    isPanning,
    containerRef,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onWheel
    }
  };
};
