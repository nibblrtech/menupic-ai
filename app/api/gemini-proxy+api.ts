import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;

    if (!prompt) {
      return Response.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json({ error: 'Server misconfiguration: GEMINI_API_KEY not found' }, { status: 500 });
    }

    const client = new GoogleGenerativeAI(key);
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(prompt);
    // result.response.text() mirrors what the client-side code expects
    const text = result?.response?.text?.() ?? JSON.stringify(result);

    return Response.json({ text });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
