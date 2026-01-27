export function GET(request: Request) {
  const key = process.env.BLACK_FOREST_LABS_API_KEY;

  if (!key) {
    return Response.json(
      { error: "Server misconfiguration: GEMINI_API_KEY not found" },
      { status: 500 }
    );
  }

  return Response.json({ key });
}
