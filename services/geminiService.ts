import { GoogleGenAI, Modality } from "@google/genai";
import type { Part } from "@google/genai";
import { safeJsonParse } from "../utils/jsonRepair";
import { CharacterPassport, SettingPassport } from "../types/cinematicSchema";
import { VideoPrompt } from "../types/videoSchema";

export interface GenerationPayload {
  prompt: string;
  images?: string[]; // base64 strings
}

const fileToPart = (base64Data: string, mimeType: string): Part => {
  return {
    inlineData: {
      data: base64Data.split(',')[1] || base64Data, // Handle with or without prefix
      mimeType,
    },
  };
};

export const generateSceneImage = async (payload: GenerationPayload): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts: Part[] = [];
    let systemInstruction: string | undefined;
    
    // Check if we have reference images (Image-to-Image / Transformation Mode)
    if (payload.images && payload.images.length > 0) {
        payload.images.forEach(img => {
            // Ensure we aren't adding empty strings
            if(img) parts.push(fileToPart(img, 'image/png'));
        });

        // Specific instruction for editing tasks
        systemInstruction = "You are an expert image editor. You will receive an input image and a JSON description of changes. Generate a NEW image that maintains the consistency/identity of the input image but applies the described changes.";
    }
    
    // Add the master prompt (JSON)
    parts.push({ text: payload.prompt });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE],
            systemInstruction: systemInstruction,
        },
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
    }

    throw new Error("No image was generated. The response may have been blocked or the format was unexpected.");
};

/**
 * Analyzes an uploaded character image to generate a biometric profile (CharacterPassport).
 */
export const analyzeCharacterImage = async (base64Image: string, clothingImage?: string): Promise<CharacterPassport | null> => {
  if (!process.env.API_KEY) {
      console.error("API Key is missing");
      return null;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    ROLE: Expert Forensic Artist and Casting Director.
    TASK: Analyze the uploaded image(s) to generate a biometric profile.
    
    INPUTS:
    - IMAGE 1 (Face/Head): Primary reference for "facialCompositeProfile".
    - IMAGE 2 (Body/Clothing - Optional): If provided, STRICTLY use this image to define "visual_dna.body" and "visual_dna.clothing".
    
    OUTPUT FORMAT: JSON ONLY (No markdown, no plain text intro).
    
    REQUIREMENTS:
    1. "description": A natural language summary (e.g., "A rugged man in his 40s...").
    2. "facialCompositeProfile": Analyze features strictly from the image.
    3. "character_id": Suggest a generic ID (e.g., "main_actor").

    TARGET JSON STRUCTURE:
    {
      "character_id": "string",
      "description": "Natural language description here...",
      "facialCompositeProfile": {
        "faceShape": "e.g. Oval, Square",
        "skinTone": "e.g. Fair with cool undertones",
        "forehead": "e.g. High, broad",
        "eyebrows": { "shape": "...", "density": "..." },
        "eyes": { "color": "...", "shape": "..." },
        "nose": { "shape": "...", "size": "..." },
        "mouth": { "shape": "...", "expression": "..." }
      },
      "visual_dna": {
         "body": "Inferred body type",
         "clothing": "Current visible clothing"
      }
    }
  `;

  try {
    const parts: any[] = [
        { text: prompt },
        fileToPart(base64Image, 'image/png')
    ];

    if (clothingImage) {
        parts.push(fileToPart(clothingImage, 'image/png'));
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
          parts: parts
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;
    
    return safeJsonParse<CharacterPassport>(text, {} as CharacterPassport);
  } catch (error) {
    console.error("Character analysis failed:", error);
    return null;
  }
};

/**
 * Analyzes an uploaded environmental image to extract its visual style (SettingPassport).
 */
export const analyzeSettingImage = async (base64Image: string): Promise<SettingPassport | null> => {
  if (!process.env.API_KEY) {
      console.error("API Key is missing");
      return null;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    ROLE: Expert Production Designer and Art Director.
    TASK: Analyze the uploaded environmental image to extract its visual style.
    
    OUTPUT FORMAT: JSON ONLY (No markdown).
    
    REQUIREMENTS:
    1. "scene_description": A general descriptive text prompt of the location.
    2. "style": Extract the visual DNA (lighting, colors, architectural style).

    TARGET JSON STRUCTURE:
    {
      "scene_description": "A natural language description of the place...",
      "style": {
        "visual_style": "e.g., Brutalist architecture, messy bedroom, forest clearing",
        "lighting": { 
            "type": "e.g., Diffused soft light", 
            "mood": "e.g., Eerie, Romantic" 
        },
        "color_palette": { 
            "dominant": "Main colors", 
            "accents": "Highlight colors" 
        }
      }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
          parts: [
              { text: prompt },
              fileToPart(base64Image, 'image/png')
          ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;
    
    return safeJsonParse<SettingPassport>(text, {} as SettingPassport);
  } catch (error) {
    console.error("Setting analysis failed:", error);
    return null;
  }
};

/**
 * Generates a visual asset (Character or Setting) from a text description.
 * Uses Gemini's image generation capabilities (Text-to-Image).
 */
export const generateReferenceAsset = async (prompt: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt }
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        
        throw new Error("No image generated by Gemini.");
    } catch (error) {
        console.error("Asset generation failed:", error);
        throw error;
    }
};

/**
 * Generates a VEO-compatible JSON prompt based on start/end frames and user description.
 */
export const generateVeoPrompt = async (
  startImage: string | undefined, 
  endImage: string | undefined, 
  movementText: string
): Promise<VideoPrompt | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Validación básica
    if (!startImage && !endImage) throw new Error("At least one image is required.");

    const parts: Part[] = [];
    
    // Instrucción Maestra
    parts.push({ text: `
    ROLE: Expert AI Video Director using Google VEO.
    TASK: Create a precise JSON specification for a video shot based on the provided assets and movement description.
    
    INPUTS:
    - Movement/Action Goal: "${movementText}"
    - Start Frame: Provided (if any)
    - End Frame: Provided (if any)

    OUTPUT FORMAT: JSON ONLY (Strictly following the schema below).
    
    REQUIREMENTS:
    1. Analyze the images to infer the "actors", "scene", "style", and "camera" details.
    2. Fill in the "sequence" array to describe how the video transitions from Start to End using the requested Movement.
    3. Do NOT halluncinate assets not present, but describe those present in great detail.

    TARGET JSON SCHEMA:
    {
        "metadata": {
            "project_name": "AI Storyboard Shot",
            "version": "1.0",
            "request_id": "GEN-VEO-001",
            "model_target": "veo-3.1-generate-preview"
        },
        "output_specifications": {
            "duration_seconds": 8.0,
            "resolution": "1080p",
            "aspect_ratio": "16:9",
            "fps": 24
        },
        "timeline": {
            "interpolation_mode": "semantic_aware",
            "keyframes": []
        },
        "actors": [
            {
            "actor_id": "main_actor",
            "description": "Detailed visual description inferred from images...",
            "facialCompositeProfile": {
                "faceShape": "String",
                "skinTone": "String",
                "eyes": { "color": "String" }
            }
            }
        ],
        "scene": {
            "location": "Inferred location...",
            "time_of_day": "Inferred...",
            "weather": "Inferred..."
        },
        "scene_description": "A concise prompt describing the full 8s shot...",
        "style": {
            "visual_style": "Cinematic, Photorealistic...",
            "lighting": { "type": "String" }
        },
        "camera": {
            "composition": "e.g. Medium Shot",
            "camera_movements": ["Inferred movement e.g. Pan Right"]
        },
        "sequence": [
            {
            "start_time": "0.0s",
            "end_time": "8.0s",
            "description": "Detailed narrative of the action...",
            "actions": ["Action 1", "Action 2"]
            }
        ],
        "audio_scape": {
            "ambient_sound": ["Inferred..."],
            "sound_effects": []
        },
        "negative_prompts": ["text", "watermark", "distortion"]
    }
    `});

    // Adjuntar imágenes si existen
    if (startImage) parts.push(fileToPart(startImage, 'image/png'));
    if (endImage) parts.push(fileToPart(endImage, 'image/png'));

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Usamos el modelo multimodal estándar para analizar y escribir JSON
            contents: { parts },
            config: { responseMimeType: 'application/json' }
        });
        
        return safeJsonParse<VideoPrompt>(response.text, {} as VideoPrompt);
    } catch (e) {
        console.error("VEO Prompt generation failed:", e);
        throw e;
    }
};