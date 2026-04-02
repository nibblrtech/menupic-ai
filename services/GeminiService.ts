// --- Utility: Logging ---
const APP_LAUNCH_TIME = Date.now();

const formatLog = (msg: string) => {
  const now = Date.now();
  const absolute = new Date(now).toISOString();
  const relative = now - APP_LAUNCH_TIME;
  return `[${absolute}] [+${relative}ms] [GeminiService] ${msg}`;
};

const logger = {
  log: (msg: string, ...args: any[]) => console.log(formatLog(msg), ...args),
  warn: (msg: string, ...args: any[]) => console.warn(formatLog(msg), ...args),
  error: (msg: string, ...args: any[]) => console.error(formatLog(msg), ...args),
};

export interface TextBlock {
  text: string;
  frame: { x: number; y: number; width: number; height: number };
}

export interface NutritionFacts {
  servingSize: string;
  calories: number;
  totalFat: { grams: number; dailyValue: number };
  saturatedFat: { grams: number; dailyValue: number };
  transFat: { grams: number };
  cholesterol: { mg: number; dailyValue: number };
  sodium: { mg: number; dailyValue: number };
  totalCarbohydrates: { grams: number; dailyValue: number };
  dietaryFiber: { grams: number; dailyValue: number };
  totalSugars: { grams: number };
  addedSugars: { grams: number; dailyValue: number };
  protein: { grams: number; dailyValue: number };
  vitaminsAndMinerals: Array<{ name: string; dailyValue: number }>;
}

export interface DishAnalysisResult {
  dishName: string;
  description: string;
  nutrition: NutritionFacts;
  imagePrompt: string;
  generatedImage?: string;
}

class GeminiService {

  /**
   * NOTE: We no longer instantiate the Generative AI client in-browser.
   * The API key must remain server-side. Calls are proxied to
   * `/api/gemini-proxy` which performs the request using the
   * `GEMINI_API_KEY` environment variable.
   */
  private async initialize() {
    // no-op: server-side proxy handles credentials
    return;
  }

  /**
   * Main function: Takes the click location + OCR blocks and returns dish info.
   */
  async identifyDish(
    clickX: number, 
    clickY: number, 
    blocks: TextBlock[],
    locale?: string
  ): Promise<DishAnalysisResult | null> {
    const start = Date.now();
    logger.log(`identifyDish started at (${clickX}, ${clickY}) locale=${locale}`);
    
    await this.initialize();

    // Filter blocks to reduce token usage (simple heuristic: closer blocks first)
    // You might want to sort these blocks by distance to clickX/Y before sending.
    const relevantBlocks = blocks.slice(0, 50); 

    // Determine the language the user expects results in
    const languageInstruction = locale
      ? `IMPORTANT: The user's device locale is "${locale}". You MUST write ALL text fields (dishName, description, imagePrompt) in the language corresponding to that locale. For example, if the locale is "en-US", respond in US English. If it is "fr-FR", respond entirely in French. Translate dish names, descriptions, and all other text into this language regardless of the menu's original language.`
      : '';

    const prompt = `
      You are an AI assistant for a food menu app.
      A user clicked on a menu at coordinates X:${clickX}, Y:${clickY}.
      
      Below is a JSON list of OCR text blocks found on the screen.
      These blocks are fragments. You must semantically and spatially group them to find the ONE dish the user selected.
      
      Look at the 'frame' coordinates. Text on the same Y-axis is likely the same line. 
      Titles are often above descriptions. Prices are often to the right.

      ${languageInstruction}

      DATA:
      ${JSON.stringify(relevantBlocks)}

      TASK:
      1. Assemble the Dish Name.
      2. Write a rich, engaging description (3-5 sentences) that includes:
         - What the dish is and how it is typically prepared.
         - A brief history or origin story of the dish.
         - Any local traditions, regional variations, or colorful cultural details.
         - Flavor profile or what makes this dish special.
      3. Provide ESTIMATED nutrition facts for a single typical serving of this dish.
         These are estimates — do your best based on common recipes and portion sizes.
         Include: serving size, calories, total fat (g & %DV), saturated fat (g & %DV),
         trans fat (g), cholesterol (mg & %DV), sodium (mg & %DV),
         total carbohydrates (g & %DV), dietary fiber (g & %DV),
         total sugars (g), added sugars (g & %DV), protein (g & %DV),
         and any pertinent vitamins & minerals with their %DV.
         %DV = percent daily value based on a 2,000 calorie diet.
      4. Generate a descriptive prompt for an AI image generator to visualize this specific food.

      RETURN JSON ONLY (No Markdown):
      {
        "dishName": "String",
        "description": "String",
        "nutrition": {
          "servingSize": "e.g. 1 plate (350g)",
          "calories": 550,
          "totalFat": { "grams": 22, "dailyValue": 28 },
          "saturatedFat": { "grams": 8, "dailyValue": 40 },
          "transFat": { "grams": 0 },
          "cholesterol": { "mg": 85, "dailyValue": 28 },
          "sodium": { "mg": 900, "dailyValue": 39 },
          "totalCarbohydrates": { "grams": 55, "dailyValue": 20 },
          "dietaryFiber": { "grams": 4, "dailyValue": 14 },
          "totalSugars": { "grams": 8 },
          "addedSugars": { "grams": 2, "dailyValue": 4 },
          "protein": { "grams": 30, "dailyValue": 60 },
          "vitaminsAndMinerals": [
            { "name": "Vitamin D", "dailyValue": 6 },
            { "name": "Calcium", "dailyValue": 15 },
            { "name": "Iron", "dailyValue": 20 },
            { "name": "Potassium", "dailyValue": 10 }
          ]
        },
        "imagePrompt": "String"
      }
    `;

    try {
      const resp = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        logger.error(`identifyDish proxy failed: ${resp.status} ${errText}`);
        return null;
      }

      const { text, error } = await resp.json();
      if (error) {
        logger.error(`identifyDish proxy returned error: ${error}`);
        return null;
      }

      const cleanJson = (text || '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson) as DishAnalysisResult;

      logger.log(`identifyDish completed for "${parsed.dishName}" in ${Date.now() - start}ms`);
      return parsed;
    } catch (error: any) {
      logger.error(`identifyDish Error (after ${Date.now() - start}ms):`, error);
      const raw = String(error?.message || error);
      const quotaDetected = /quota|exceeded|429/.test(raw.toLowerCase()) || error?.status === 429 || error?.statusCode === 429;
      if (quotaDetected) {
        throw error;
      }
      return null;
    }
  }
}

export const geminiService = new GeminiService();
