export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;

    const key = process.env.BLACK_FOREST_LABS_API_KEY;
    if (!key) {
      return Response.json({ error: 'Server misconfiguration: BLACK_FOREST_LABS_API_KEY not found' }, { status: 500 });
    }

    if (action === 'generate') {
      const prompt = body?.prompt;
      if (!prompt) {
        return Response.json({ error: 'Missing prompt' }, { status: 400 });
      }

      const requestBody = {
        prompt,
        seed: body?.seed ?? 42,
        width: body?.width ?? 512,
        height: body?.height ?? 512,
        safety_tolerance: body?.safety_tolerance ?? 5,
        steps: body?.steps ?? 10,
        guidance: body?.guidance ?? 10.0,
      };

      const resp = await fetch('https://api.bfl.ai/v1/flux-2-pro', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'x-key': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } });
      } catch {
        return new Response(text, { status: resp.status, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    if (action === 'poll') {
      const pollUrl = body?.pollUrl;
      if (!pollUrl) {
        return Response.json({ error: 'Missing pollUrl' }, { status: 400 });
      }

      const resp = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-key': key
        }
      });

      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } });
      } catch {
        return new Response(text, { status: resp.status, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
