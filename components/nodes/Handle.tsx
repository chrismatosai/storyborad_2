import React, { forwardRef } from 'react';

interface HandleProps {
  type: 'input' | 'output';
  isConnected?: boolean;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDisconnect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Handle = forwardRef<HTMLDivElement, HandleProps>(({ 
  type, 
  isConnected, 
  onMouseDown, 
  onMouseUp,
  onDisconnect,
  className = '',
  style
}, ref) => {
  
  const handleInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Detener propagación siempre
    e.preventDefault(); // Evitar drag del nodo padre

    // CASO A: Está conectado y es una entrada -> DESCONECTAR
    if (isConnected && type === 'input' && onDisconnect) {
      console.log("✂️ Cortando conexión...");
      onDisconnect();
      return;
    }

    // CASO B: No está conectado o es salida -> INICIAR CONEXIÓN
    if (onMouseDown) onMouseDown(e);
  };

  return (
    <div
      ref={ref}
      onMouseDown={handleInteraction}
      onMouseUp={onMouseUp}
      style={style}
      className={`
        w-4 h-4 rounded-full border-2 z-50 transition-all duration-200
        ${isConnected 
           ? 'bg-yellow-500 border-yellow-200 hover:bg-red-500 hover:border-red-300 cursor-alias' // Conectado: Se pone rojo al hover (Indica borrar)
           : 'bg-gray-600 border-gray-400 hover:bg-white hover:border-blue-500 cursor-crosshair' // Desconectado: Se pone blanco
        }
        ${className}
      `}
      title={isConnected ? "Click para desconectar" : "Arrastrar para conectar"}
    />
  );
});