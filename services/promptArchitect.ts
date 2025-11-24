
import { GoogleGenAI } from "@google/genai";
import { CinematicPrompt, SceneEntity, CompositionElement, CinematicJSON, CharacterPassport, SettingPassport } from "../types/cinematicSchema";
import { CharacterData, SettingData } from "../types/graph";
import { safeJsonParse } from "../utils/jsonRepair";

const SCHEMA_DEFINITION = `
interface LightingGlobals {
  type: string;
  quality: string[];
  color_temperature: string;
}

interface CompositionElement {
  description: string;
  focus_target_id?: string;
  position?: string;
  focus_state?: string;
  texture?: string;
}

interface EntityDetail {
  pose: string;
  facial_expression: string;
  clothing: string;
  skin_texture: string;
}

interface SceneEntity {
  id: string;
  type: string;
  description: string;
  placement_plane: string; // e.g. foreground, midground, background
  details: EntityDetail;
}

interface CameraSettings {
  lens_focal_length: string; // e.g. 35mm, 85mm
  aperture: string; // e.g. f/1.8
  depth_of_field: string; // e.g. shallow, deep
  shot_type: string; // e.g. close-up, wide shot
  angle: string; // e.g. eye-level, low angle
  aspect_ratio: string; // e.g. 16:9, 2.39:1
}

interface Presentation {
    camera: CameraSettings;
    film_grain?: string;
    color_grading?: string;
}

interface SceneGlobals {
    lighting: LightingGlobals;
    atmosphere?: string;
    time_of_day?: string;
    weather?: string;
}

interface CinematicPrompt {
  scene_globals: SceneGlobals;
  composition: CompositionElement[];
  entities: SceneEntity[];
  presentation: Presentation;
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

  const systemInstruction = `You are a Cinematographer AI. Analyze the user's scene description and output a VALID JSON object matching the CinematicPrompt structure provided below.
  Infer mood, lighting, and camera details if not specified to create a cinematic shot.
  
  Schema:
  ${SCHEMA_DEFINITION}
  `;

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
    
    // Use safeJsonParse to handle potential markdown wrapping or malformed strings
    return safeJsonParse<Partial<CinematicPrompt>>(text, {});

  } catch (error) {
    console.error("Failed to enrich scene description:", error);
    return {};
  }
};

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
    } else if (characterData && characterData.prompt) {
        const charEntity: SceneEntity = {
            id: "character_main_provided",
            type: "character",
            description: characterData.prompt,
            placement_plane: "foreground",
            details: {
                pose: "contextual",
                facial_expression: "contextual",
                clothing: "as described",
                skin_texture: "detailed"
            }
        };
        master.entities.push(charEntity);
    }

    if (settingJson) {
         master.composition.push(settingJson);
    } else if (settingData && settingData.prompt) {
        const settingElement: CompositionElement = {
            description: settingData.prompt,
            position: "background",
            focus_state: "in focus",
            texture: "detailed"
        };
        master.composition.push(settingElement);
    }

    return master;
};

export const generateCharacterProfilePrompt = (userInput: string): string => {
  return `
    ACT AS A CINEMATIC CHARACTER DESIGNER.
    Analyze the following character description or input: "${userInput}".
    
    Output a strictly valid JSON object (no markdown, no comments) representing the "Visual DNA" of this character.
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
 * Construye el Prompt Maestro para convertir texto de guion en JSON Cinematográfico.
 * @param scriptText - El texto que viene del nodo verde (Script Node).
 * @param characterProfile - (Opcional) Datos del nodo de personaje si está conectado.
 * @param settingProfile - (Opcional) Datos del nodo de escenario si está conectado.
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
      You MUST use the provided Character Profile.
      - ID: "${characterProfile.character_id}"
      - DESCRIPTION: "${characterProfile.description}"
      
      MANDATORY VISUAL TRAITS (Copy strictly to JSON):
      ${JSON.stringify(characterProfile.facialCompositeProfile)}
      `
    : "";

  // 2. LÓGICA DE OVERRIDE DE ESCENARIO
  const settingSection = settingProfile
    ? `
      [[🟢 CRITICAL INSTRUCTION: SETTING VISUAL LOCK]]
      The scene MUST take place in this exact environment.
      
      MANDATORY SETTING STYLE:
      ${JSON.stringify(settingProfile.style)}
      
      Context Description: ${settingProfile.scene_description}
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
    2. character[0].description -> MUST be exactly "${characterProfile ? characterProfile.description : "Inferred from script"}" (Do not hallucinate a new description).
    3. character[0].facialCompositeProfile -> MUST be the "MANDATORY VISUAL TRAITS" JSON provided above.
    
    OUTPUT FORMAT: JSON ONLY (No markdown).
    
    TARGET JSON SCHEMA (Strict):
    {
      "scene_globals": {
        "description": "The cinematic scene description based on SCRIPT ACTION",
        "mood": ["Mood1", "Mood2"],
        "lighting_globals": {
          "type": "Primary lighting type",
          "quality": ["High contrast", "Soft"],
          "color_temperature": "e.g. Cool cyan vs Warm orange"
        }
      },
      "composition": {
        "background": { "description": "Distant elements" },
        "midground": { "description": "Mid-plane elements" },
        "foreground": { "description": "Closest elements" },
        "frame_element": {
          "description": "Optional framing object",
          "position": "Overlay",
          "focus_state": "Blurred",
          "texture": "Texture details"
        }
      },
      "character": [
        {
          "id": "${characterProfile ? characterProfile.character_id : "main_subject"}",
          "type": "person",
          "description": "The character description text",
          "placement_plane": "foreground OR midground",
          "facialCompositeProfile": {
            "faceShape": "String",
            "skinTone": "String",
            "forehead": "String",
            "eyebrows": { "shape": "String", "density": "String" },
            "eyes": { "color": "String", "shape": "String" },
            "nose": { "shape": "String", "size": "String" },
            "mouth": { "shape": "String", "expression": "String" }
          },
          "details": {
            "pose": "Action/Pose based on SCRIPT ACTION",
            "facial_expression": {
              "emotion": "Inferred emotion",
              "description": "Micro-expressions"
            },
            "clothing": {
              "items": "Clothing description",
              "texture": "Fabric details"
            },
            "skin_texture": {
              "details": "Pores, sweat, makeup",
              "imperfections": "Scars, moles"
            }
          }
        }
      ],
      "presentation": {
        "style": ["Photorealistic", "Cinematic", "8k"],
        "materials": { "film_grain": "ISO value" },
        "camera": {
          "lens_focal_length": "e.g. 35mm, 85mm",
          "aperture": "e.g. f/1.8",
          "depth_of_field": "Shallow/Deep",
          "shot_type": "Wide / Medium / Close-up",
          "angle": "Low / High / Eye-level",
          "aspect_ratio": "16:9"
        }
      }
    }
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
