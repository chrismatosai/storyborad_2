import React, { useRef, useEffect } from 'react';
import { Node } from '../../types/graph';
import { Viewport } from '../../hooks/useViewport';

// Sincronizado con useViewport (4000x4000 de radio = 8000 de ancho total)
const WORLD_SIZE = 8000; 
const MAP_SIZE = 150; // Tamaño visual del minimapa en px

interface MiniMapProps {
  nodes: Node[];
  viewTransform: Viewport;
  setViewTransform: React.Dispatch<React.SetStateAction<Viewport>>;
}

export const MiniMap: React.FC<MiniMapProps> = ({ nodes, viewTransform, setViewTransform }) => {
  
  // 1. Escala: Convertir Coordenadas del Mundo -> MiniMapa
  // El mundo va de -4000 a +4000. El mapa va de 0 a 150.
  const worldToMap = (val: number) => {
      return ((val + (WORLD_SIZE / 2)) / WORLD_SIZE) * MAP_SIZE;
  };

  // 2. Escala Inversa: MiniMapa -> Mundo (Para hacer click y viajar)
  const mapToWorld = (val: number) => {
      return (val / MAP_SIZE) * WORLD_SIZE - (WORLD_SIZE / 2);
  };

  // 3. Calcular el Rectángulo de Visión (Tu pantalla actual)
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  
  // Ancho del viewport en coordenadas de mundo = Pantalla / Zoom
  const viewportWorldW = screenW / viewTransform.zoom;
  const viewportWorldH = screenH / viewTransform.zoom;

  // Posición del viewport en el minimapa
  // Nota: viewTransform.x/y es el desplazamiento del origen.
  // El centro de la pantalla en el mundo es: -viewTransform.x / zoom + screenCenter / zoom
  // Simplificación visual: Mostramos el área visible relativa al origen 0,0
  const viewportX = worldToMap((-viewTransform.x) / viewTransform.zoom);
  const viewportY = worldToMap((-viewTransform.y) / viewTransform.zoom);
  const viewportW = (viewportWorldW / WORLD_SIZE) * MAP_SIZE;
  const viewportH = (viewportWorldH / WORLD_SIZE) * MAP_SIZE;

  // Acciones
  const handleMapClick = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Calcular dónde queremos ir (en coordenadas de mundo)
      const targetWorldX = mapToWorld(clickX);
      const targetWorldY = mapToWorld(clickY);

      // Centrar la cámara ahí
      // Nuevo Pan = (ScreenCenter - TargetWorld * Zoom)
      const newX = (screenW / 2) - (targetWorldX * viewTransform.zoom);
      const newY = (screenH / 2) - (targetWorldY * viewTransform.zoom);

      setViewTransform(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleZoom = (delta: number) => {
      const newZoom = Math.max(0.1, Math.min(3, viewTransform.zoom + delta));
      // Zoom hacia el centro de la pantalla
      // Math simplificado para mantener el centro aproximado
      setViewTransform(prev => ({ ...prev, zoom: newZoom }));
  };

  const handleFitView = () => {
      if (nodes.length === 0) {
          setViewTransform({ x: 0, y: 0, zoom: 1 });
          return;
      }
      // Algoritmo Auto-Fit (Reutilizado lógicamente)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(n => {
          if(n.position.x < minX) minX = n.position.x;
          if(n.position.y < minY) minY = n.position.y;
          if(n.position.x + 300 > maxX) maxX = n.position.x + 300;
          if(n.position.y + 300 > maxY) maxY = n.position.y + 300;
      });
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const zoomX = (screenW - 100) / contentW;
      const zoomY = (screenH - 100) / contentH;
      const targetZoom = Math.max(0.2, Math.min(1, Math.min(zoomX, zoomY)));
      
      const centerX = minX + contentW / 2;
      const centerY = minY + contentH / 2;
      const targetX = (screenW / 2) - (centerX * targetZoom);
      const targetY = (screenH / 2) - (centerY * targetZoom);

      setViewTransform({ x: targetX, y: targetY, zoom: targetZoom });
  };

  return (
    <div className="absolute bottom-20 right-4 z-50 flex flex-col gap-2 items-end animate-in fade-in slide-in-from-bottom-4">
        
        {/* Controls */}
        <div className="flex bg-gray-900/90 rounded-lg border border-gray-700 overflow-hidden shadow-xl backdrop-blur-sm">
            <button onClick={() => handleZoom(0.1)} className="p-1.5 hover:bg-gray-700 text-gray-300" title="Zoom In">➕</button>
            <div className="w-[1px] bg-gray-700"></div>
            <button onClick={() => handleZoom(-0.1)} className="p-1.5 hover:bg-gray-700 text-gray-300" title="Zoom Out">➖</button>
            <div className="w-[1px] bg-gray-700"></div>
            <button onClick={handleFitView} className="p-1.5 hover:bg-gray-700 text-gray-300 px-2 font-bold text-xs" title="Fit View">⤢ FIT</button>
        </div>

        {/* Map Display */}
        <div 
            className="bg-gray-900/80 border-2 border-gray-700 rounded-lg shadow-2xl relative overflow-hidden cursor-crosshair hover:border-gray-500 transition-colors"
            style={{ width: MAP_SIZE, height: MAP_SIZE }}
            onClick={handleMapClick}
        >
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-20" 
                 style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
            />

            {/* Nodes (Dots) */}
            {nodes.map(node => (
                <div 
                    key={node.id}
                    className="absolute bg-indigo-500 rounded-full shadow-sm"
                    style={{
                        left: worldToMap(node.position.x),
                        top: worldToMap(node.position.y),
                        width: 4, 
                        height: 4,
                        transform: 'translate(-50%, -50%)' // Center anchor
                    }}
                />
            ))}

            {/* Viewport Rect (Camera) */}
            <div 
                className="absolute border-2 border-yellow-500/80 bg-yellow-500/10 pointer-events-none transition-all duration-75"
                style={{
                    left: viewportX,
                    top: viewportY,
                    width: viewportW,
                    height: viewportH,
                }}
            />
            
            {/* Center Crosshair (0,0 of World) */}
            <div className="absolute top-1/2 left-1/2 w-2 h-0.5 bg-gray-600 -translate-x-1/2 -translate-y-1/2 opacity-50" />
            <div className="absolute top-1/2 left-1/2 w-0.5 h-2 bg-gray-600 -translate-x-1/2 -translate-y-1/2 opacity-50" />
        </div>
    </div>
  );
};