
import { GoogleGenAI } from "@google/genai";
import { CinematicPrompt, SceneEntity, CompositionElement, CinematicJSON, CharacterPassport, SettingPassport } from "../types/cinematicSchema";
import { CharacterData, SettingData } from "../types/graph";
import { safeJsonParse } from "../utils/jsonRepair";

const SCHEMA_DEFINITION = `
interface CinematicJSON {
  subjects: {
    main_subject: string;
    clothing_details: string;
    action_pose: string;
    expression_mood: string;
  };
  scene_globals: {
    description: string;
    mood: string;
  };
  composition: {
    frame_size: string;
    depth_of_field: string;
    angle: string;
    foreground: { description: string };
    background: { description: string };
  };
  style: {
    visual_style: string;
    color_palette: { dominant: string[]; accents: string[] };
    lighting: { type: string; mood: string };
  };
  presentation: {
    camera: { lens_focal_length: string; aperture: string; shot_type: string };
  };
}
`;

const ENTITY_SCHEMA = `
interface EntityDetail {
  pose: string;
  facial_expression: string;
  clothing: string;
  skin_texture: string;
}

interface SceneEntity {
  id: string;
  type: string; // "character"
  description: string;
  placement_plane: string;
  details: EntityDetail;
}
`;

const SETTING_SCHEMA = `
interface CompositionElement {
  description: string;
  focus_target_id?: string;
  position?: string;
  focus_state?: string;
  texture?: string;
}
`;

// Helper to prepare content parts with optional image
const prepareContent = (text: string, imageBase64?: string) => {
    const parts: any[] = [{ text }];
    if (imageBase64 && imageBase64.includes(',')) {
        const [meta, data] = imageBase64.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        parts.push({ inlineData: { data, mimeType } });
    }
    return parts;
};

export const enrichCharacter = async (name: string, description: string, imageBase64?: string): Promise<SceneEntity | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: prepareContent(`Analyze this character description (and image if provided) and return a JSON object matching the SceneEntity schema. Name: ${name}. Description: ${description}`, imageBase64) },
            config: {
                systemInstruction: `You are a Character Artist AI. Output VALID JSON only. Schema: ${ENTITY_SCHEMA}`,
                responseMimeType: 'application/json',
            }
        });
        return safeJsonParse<SceneEntity>(response.text, {} as SceneEntity);
    } catch (e) {
        console.error("Character enrichment failed:", e);
        return null;
    }
};

export const enrichSetting = async (description: string, imageBase64?: string): Promise<CompositionElement | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: prepareContent(`Analyze this setting description (and image if provided) and return a JSON object matching the CompositionElement schema. Description: ${description}`, imageBase64) },
            config: {
                systemInstruction: `You are a Environment Artist AI. Output VALID JSON only. Schema: ${SETTING_SCHEMA}`,
                responseMimeType: 'application/json',
            }
        });
        return safeJsonParse<CompositionElement>(response.text, {} as CompositionElement);
    } catch (e) {
        console.error("Setting enrichment failed:", e);
        return null;
    }
};

export const enrichSceneDescription = async (userDescription: string): Promise<Partial<CinematicPrompt>> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing");
    return {};
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // NOTE: This function returns Partial<CinematicPrompt> for legacy support, 
  // but fetchCinematicSpec below uses the new CinematicJSON.
  // We keep this function as is for now or deprecated.
  
  const systemInstruction = `You are a Cinematographer AI. Analyze the user's scene description and output a VALID JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: userDescription,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return {};
    
    return safeJsonParse<Partial<CinematicPrompt>>(text, {});

  } catch (error) {
    console.error("Failed to enrich scene description:", error);
    return {};
  }
};

// Legacy function kept for reference but might not be used in V2 pipeline
export const assembleMasterPrompt = (
  sceneJson: Partial<CinematicPrompt>, 
  characterData?: CharacterData, 
  settingData?: SettingData,
  characterJson?: SceneEntity,
  settingJson?: CompositionElement
): CinematicPrompt => {
    const master: CinematicPrompt = {
        scene_globals: sceneJson.scene_globals || { 
            lighting: { type: "natural", quality: ["soft"], color_temperature: "neutral" },
            atmosphere: "neutral",
            time_of_day: "day", 
            weather: "clear"
        },
        composition: [...(sceneJson.composition || [])],
        entities: [...(sceneJson.entities || [])],
        presentation: sceneJson.presentation || {
            camera: { 
                lens_focal_length: "35mm", 
                aperture: "f/5.6", 
                depth_of_field: "medium", 
                shot_type: "medium shot", 
                angle: "eye-level", 
                aspect_ratio: "16:9" 
            }
        }
    };

    if (characterJson) {
        master.entities.push(characterJson);
    }

    if (settingJson) {
         master.composition.push(settingJson);
    }

    return master;
};

export const generateCharacterProfilePrompt = (userInput: string): string => {
  return `
    ACT AS A CINEMATIC CHARACTER DESIGNER.
    Analyze the following character description or input: "${userInput}".
    
    Output a strictly valid JSON object.
    Structure:
    {
      "character_id": "main_subject",
      "description": "Concise summary",
      "facialCompositeProfile": {
        "faceShape": "e.g. Oval, Square",
        "skinTone": "e.g. Fair, Olive, Dark",
        "forehead": "e.g. High, Narrow",
        "eyebrows": { "shape": "Arched", "density": "Thick" },
        "eyes": { "color": "Blue", "shape": "Almond" },
        "nose": { "shape": "Straight", "size": "Medium" },
        "mouth": { "shape": "Full", "expression": "Neutral" }
      },
      "visual_dna": {
        "body": "Body type and build",
        "clothing": "Clothing style and materials"
      }
    }
  `;
};

export const fetchCharacterPassport = async (description: string): Promise<CharacterPassport | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = generateCharacterProfilePrompt(description);
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });
        return safeJsonParse<CharacterPassport>(response.text, {} as CharacterPassport);
    } catch (e) {
        console.error("Character Passport generation failed", e);
        return null;
    }
};

/**
 * Construye el Prompt Maestro para convertir texto de guion en JSON Cinematográfico (NUEVO ESQUEMA).
 */
export const buildScenePrompt = (
  scriptText: string, 
  characterProfile: CharacterPassport | null,
  settingProfile: SettingPassport | null 
): string => {

  // 1. LÓGICA DE OVERRIDE DE PERSONAJE
  const charSection = characterProfile 
    ? `
      [[🔴 CRITICAL INSTRUCTION: CHARACTER VISUAL LOCK]]
      You MUST use the provided Character Profile to populate "subjects".
      - Main Subject: "${characterProfile.description}"
      - Clothing: "${characterProfile.visual_dna?.clothing || "As defined"}"
      `
    : "";

  // 2. LÓGICA DE OVERRIDE DE ESCENARIO
  const settingSection = settingProfile
    ? `
      [[🟢 CRITICAL INSTRUCTION: SETTING VISUAL LOCK]]
      The scene MUST take place in this exact environment.
      - Setting Description: ${settingProfile.scene_description}
      - Style/Mood: ${JSON.stringify(settingProfile.style)}
      `
    : "";

  return `
    ROLE: Technical Director enforcing strict continuity.
    
    INPUT CONTEXT:
    - SCRIPT ACTION: "${scriptText}"
    ${characterProfile ? `- CHARACTER REF: Included` : '- CHARACTER REF: None'}
    ${settingProfile ? `- SETTING REF: Included` : '- SETTING REF: None'}

    ${charSection}
    ${settingSection}

    TASK: Generate the Scene JSON based on the INPUT SCRIPT ACTION.
    
    DATA MAPPING RULES (STRICT):
    1. scene_globals.description -> MUST correspond to "SCRIPT ACTION".
    2. subjects.main_subject -> "${characterProfile ? characterProfile.description : "Inferred from script"}"
    3. subjects.clothing_details -> "${characterProfile ? (characterProfile.visual_dna?.clothing || "Standard") : "Inferred"}"
    4. subjects.action_pose -> Inferred from SCRIPT ACTION.
    
    OUTPUT FORMAT: JSON ONLY (No markdown).
    
    TARGET JSON SCHEMA (Strict):
    ${SCHEMA_DEFINITION}
  `;
};

export const fetchCinematicSpec = async (
  scriptText: string, 
  passport: CharacterPassport | null,
  settingPassport: SettingPassport | null = null
): Promise<CinematicJSON | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = buildScenePrompt(scriptText, passport, settingPassport);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });
        return safeJsonParse<CinematicJSON>(response.text, {} as CinematicJSON);
    } catch (e) {
         console.error("Cinematic Spec generation failed", e);
         return null;
    }
};

/**
 * Toma un JSON Cinemático existente y aplica modificaciones basadas en lenguaje natural.
 * Mantiene la estructura estricta pero actualiza los valores solicitados.
 */
export const transformCinematicSpec = async (
  sourceJson: CinematicJSON, 
  modificationPrompt: string
): Promise<CinematicJSON | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
    ROLE: Expert Technical Director and JSON Editor.
    TASK: You will receive a SOURCE JSON representing a scene and a MODIFICATION PROMPT.
    
    GOAL: Update the SOURCE JSON to reflect the requested changes while preserving strict schema validity and keeping unchanged elements intact.
    
    SOURCE JSON:
    ${JSON.stringify(sourceJson)}
    
    MODIFICATION PROMPT:
    "${modificationPrompt}"
    
    TARGET SCHEMA:
    ${SCHEMA_DEFINITION}
    
    INSTRUCTIONS:
    1. Analyze the Modification Prompt to identify what needs to change.
    2. Apply these changes to the relevant fields in the JSON.
    3. KEEP ALL OTHER FIELDS UNCHANGED unless they contradict the modification.
    4. Ensure the output is a VALID JSON object matching the CinematicJSON schema exactly.
    
    OUTPUT FORMAT: JSON ONLY (No markdown).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });
        
        return safeJsonParse<CinematicJSON>(response.text, sourceJson);
    } catch (e) {
         console.error("Cinematic Transformation failed", e);
         return null;
    }
};
