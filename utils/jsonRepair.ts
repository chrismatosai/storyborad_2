
export const safeJsonParse = <T>(inputString: string, fallback: T): T => {
  if (!inputString) return fallback;

  let cleanString = inputString;

  // 1. Remove common Markdown code block markers
  cleanString = cleanString.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "");

  // 2. Find the first '{' and the last '}' to extract the JSON object
  // This handles cases where the model adds preamble text like "Here is the JSON:"
  const firstBrace = cleanString.indexOf('{');
  const lastBrace = cleanString.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanString = cleanString.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanString) as T;
  } catch (error) {
    console.warn("safeJsonParse: Standard JSON.parse failed.", error);
    console.debug("safeJsonParse: Failed string content:", inputString);
    
    // Return the fallback if parsing fails
    return fallback;
  }
};
