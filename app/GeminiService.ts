import { GoogleGenerativeAI } from "@google/generative-ai";

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

export interface DishAnalysisResult {
  dishName: string;
  description: string;
  price: string;
  nutrients: string;
  imagePrompt: string;
  generatedImage?: string;
}

class GeminiService {

    private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private apiKey: string | null = null;

  /**
   * Initializes the Gemini client by fetching the key from our backend.
   */
  private async initialize() {
    if (this.genAI) return;
    
    try {
      // Fetch key from our secure API route
      const response = await fetch('/api/gemini-key');
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.key) {
        this.apiKey = data.key;
        this.genAI = new GoogleGenerativeAI(data.key);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      } else {
        logger.error("No API Key returned from server");
      }
    } catch (error) {
      logger.error("Failed to fetch API key", error);
    }
  }

  /**
   * Main function: Takes the click location + OCR blocks and returns dish info.
   */
  async identifyDish(
    clickX: number, 
    clickY: number, 
    blocks: TextBlock[]
  ): Promise<DishAnalysisResult | null> {
    const start = Date.now();
    logger.log(`identifyDish started at (${clickX}, ${clickY})`);
    
    await this.initialize();
    if (!this.model) {
      logger.warn("identifyDish aborted: Model not initialized.");
      return null;
    }

    // Filter blocks to reduce token usage (simple heuristic: closer blocks first)
    // You might want to sort these blocks by distance to clickX/Y before sending.
    const relevantBlocks = blocks.slice(0, 50); 

    const prompt = `
      You are an AI assistant for a food menu app.
      A user clicked on a menu at coordinates X:${clickX}, Y:${clickY}.
      
      Below is a JSON list of OCR text blocks found on the screen.
      These blocks are fragments. You must semantically and spatially group them to find the ONE dish the user selected.
      
      Look at the 'frame' coordinates. Text on the same Y-axis is likely the same line. 
      Titles are often above descriptions. Prices are often to the right.

      DATA:
      ${JSON.stringify(relevantBlocks)}

      TASK:
      1. Assemble the Dish Name, Description
      3. Generate a descriptive prompt for an AI image generator to visualize this specific food.

      RETURN JSON ONLY (No Markdown):
      {
        "dishName": "String",
        "description": "String",
        "imagePrompt": "String"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      // Cleanup: Gemini sometimes wraps JSON in markdown blocks
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsed = JSON.parse(cleanJson) as DishAnalysisResult;
      
      logger.log(`identifyDish completed for "${parsed.dishName}" in ${Date.now() - start}ms`);
      return parsed;
    } catch (error) {
      logger.error(`identifyDish Error (after ${Date.now() - start}ms):`, error);
      return null;
    }
  }
}

export const geminiService = new GeminiService();
