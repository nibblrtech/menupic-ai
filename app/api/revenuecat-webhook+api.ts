/**
 * RevenueCat Webhook API Route — consumables-only no-op.
 *
 * The app no longer supports subscriptions. Scan credits are persisted via
 * /api/credit-scans after each successful consumable purchase.
 *
 * This endpoint intentionally responds with 200 to avoid retries if a legacy
 * webhook URL is still configured in RevenueCat.
 */

export async function GET() {
  return Response.json({
    status: 'ok',
    route: '/api/revenuecat-webhook',
    mode: 'consumables-only',
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  return Response.json({
    status: 'ignored',
    reason: 'Subscriptions are disabled; webhook events are not processed.',
  });
}
