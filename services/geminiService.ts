
import { GoogleGenAI, Modality } from "@google/genai";
import type { Part } from "@google/genai";
import { safeJsonParse } from "../utils/jsonRepair";
import { CharacterPassport, SettingPassport } from "../types/cinematicSchema";

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
export const analyzeCharacterImage = async (base64Image: string): Promise<CharacterPassport | null> => {
  if (!process.env.API_KEY) {
      console.error("API Key is missing");
      return null;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    ROLE: Expert Forensic Artist and Casting Director.
    TASK: Analyze the uploaded image of a person and generate a detailed biometric profile.
    
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