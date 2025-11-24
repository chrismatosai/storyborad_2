import { ScriptScene } from '../types/graph';

export const parseScriptCSV = (text: string, nodeId: string): ScriptScene[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // Regla de negocio: Omitir siempre la primera fila (Header)
  if (lines.length < 2) return [];
  const dataLines = lines.slice(1); 

  return dataLines.map((line, index) => {
    // Detección básica de CSV: Maneja comas, pero si hay comillas las respeta (básico)
    // Si la línea tiene comillas, usa regex, si no, split simple.
    let parts: string[] = [];
    if (line.includes('"')) {
        const regex = /(?:^|,)("(?:[^"]|"")*"|[^,]*)/g;
        let match;
        while ((match = regex.exec(line))) {
            // Eliminar comillas envolventes y comas iniciales
            let val = match[1].startsWith(',') ? match[1].substring(1) : match[1];
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            parts.push(val.trim());
        }
    } else {
        parts = line.split(',');
    }

    // Asumimos Columna 0 = Escena/Título, Columna 1 = Descripción/Acción
    // Si solo hay 1 columna, usamos esa como descripción.
    const title = parts.length > 1 ? parts[0] : `Scene ${index + 1}`;
    const description = parts.length > 1 ? parts[1] : parts[0];

    return {
      id: `scene-${nodeId}-${Date.now()}-${index}`,
      title: title || `Scene ${index + 1}`,
      description: description || "",
      isExpanded: true,
      selectedSettingId: undefined
    };
  });
};