import React, { useState, useCallback, useRef, MouseEvent, WheelEvent, MutableRefObject } from 'react';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface UseViewportResult {
  viewTransform: Viewport;
  setViewTransform: React.Dispatch<React.SetStateAction<Viewport>>;
  isPanning: boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  handlers: {
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
    onWheel: (e: WheelEvent) => void;
  };
}

export const useViewport = (initialViewport: Viewport = { x: 0, y: 0, zoom: 1 }): UseViewportResult => {
  const [viewTransform, setViewTransform] = useState<Viewport>(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: MouseEvent) => {
    // Only start panning if clicking directly on the container (not on a node)
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
      setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
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
    e.preventDefault(); // Prevent browser zoom/scroll

    const zoomSpeed = 0.1;
    const newZoom = viewTransform.zoom - e.deltaY * zoomSpeed * 0.05;
    const clampedZoom = Math.max(0.2, Math.min(2, newZoom));

    const canvasRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    // Calculate position relative to canvas origin (0,0) before zoom
    const mouseOnCanvasX = (mouseX - viewTransform.x) / viewTransform.zoom;
    const mouseOnCanvasY = (mouseY - viewTransform.y) / viewTransform.zoom;

    // Calculate new transform to keep mouse over same canvas point
    const newX = mouseX - mouseOnCanvasX * clampedZoom;
    const newY = mouseY - mouseOnCanvasY * clampedZoom;

    setViewTransform({ x: newX, y: newY, zoom: clampedZoom });
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