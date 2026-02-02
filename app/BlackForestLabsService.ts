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

class BlackForestLabsService {
  // Client no longer holds the API key. All work is proxied through our server.

  public async pollForImage(pollUrl: string): Promise<any | null> {
    logger.log(`pollForImage at (${pollUrl})`);
    try {
      if (!pollUrl) {
        logger.error('pollUrl is required');
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
      let response;
      try {
        response = await fetch('/api/black-forest-proxy', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'poll', pollUrl }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Proxy API error: ${response.status} - ${errorText}`);
        return { error: `Proxy returned ${response.status}`, details: errorText };
      }

      const data = await response.json();
      logger.log('Poll response (proxied): ' + JSON.stringify(data, null, 2));
      return data;
    } catch (error: any) {
      logger.error('Error polling result:', error);
      if (error.name === 'AbortError') {
        return { error: 'Request timeout', message: 'The request took too long to complete' };
      } else if (error.cause?.code === 'EHOSTUNREACH') {
        return { error: 'Network error', message: 'Unable to reach the API server. Please check your internet connection.' };
      } else {
        return { error: error.message, type: error.name };
      }
    }
  }

  public async generateDishImage(dishDescription: string): Promise<string> {
    logger.log(`generateDishImage for (${dishDescription})`);
    // Build the request body for the proxy (API expects 'prompt')
    const requestBody = {
      action: 'generate',
      prompt: dishDescription,
      seed: 42,
      width: 512,
      height: 512,
      safety_tolerance: 5,
      steps: 10,
      guidance: 10.0
    };

    const response = await fetch('/api/black-forest-proxy', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Proxy API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Proxy API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.log('Generate response (proxied): ' + JSON.stringify(data, null, 2));
    // Expecting polling_url in the response
    if (!data.polling_url) {
      logger.error('No polling_url in proxied response', data);
      throw new Error('No polling_url in response');
    }
    return data.polling_url;
  }
}

export const blackForestLabsService = new BlackForestLabsService();
