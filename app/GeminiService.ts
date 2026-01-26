import { GoogleGenerativeAI } from "@google/generative-ai";

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
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  /**
   * Initializes the Gemini client by fetching the key from our backend.
   */
  private async initialize() {
    if (this.genAI) return;

    try {
      // Fetch key from our secure API route
      // Ensure we're using the correct path. In Expo Router, /api/... routes are available at the root.
      // We might need an absolute URL if running on a device vs simulator, but usually relative works
      // if the app is served from the same origin (web). For native, we might need the host.
      // However, for this prototype, if we are in dev, localhost might work or the machine IP.
      // If we are strictly client-side calling EAS hosting, we assume the environment
      // provides the base URL or we use a relative path if it's a web build.
      // For native, `fetch('/api/gemini-key')` might fail if not configured correctly.
      // But let's stick to the requested plan.
      const response = await fetch('/api/gemini-key');
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();

      if (data.key) {
        this.genAI = new GoogleGenerativeAI(data.key);
        // "gemini-1.5-flash" is the current standard. 
        // If 404s persist, ensure the API Key has the "Generative Language API" enabled in Google Cloud Console.
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      } else {
        console.error("GeminiService: No API Key returned from server");
      }
    } catch (error) {
      console.error("GeminiService: Failed to fetch API key", error);
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
    
    await this.initialize();
    if (!this.model) return null;

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
      1. Assemble the Dish Name, Description, and Price for the item closest to the click.
      2. Infer macro nutrients (e.g., "High Carb", "Gluten Free") based on ingredients.
      3. Generate a descriptive prompt for an AI image generator to visualize this specific food.

      RETURN JSON ONLY (No Markdown):
      {
        "dishName": "String",
        "description": "String",
        "price": "String",
        "nutrients": "String",
        "imagePrompt": "String"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Cleanup: Gemini sometimes wraps JSON in markdown blocks
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      return JSON.parse(cleanJson) as DishAnalysisResult;
    } catch (error) {
      console.error("GeminiService Error:", error);
      return null;
    }
  }
}

export const geminiService = new GeminiService();
