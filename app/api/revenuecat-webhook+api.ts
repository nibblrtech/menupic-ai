/**
 * RevenueCat Webhook API Route — POST /api/revenuecat-webhook
 *
 * Receives subscription lifecycle events from RevenueCat and credits/manages
 * scans in the user's Supabase profile accordingly.
 *
 * Event types handled:
 *  • INITIAL_PURCHASE — first subscription purchase → credit 30 scans (all plans), store sub info
 *  • RENEWAL          — subscription renewed → credit 30 scans
 *  • CANCELLATION     — user cancelled auto-renew → mark subscription inactive
 *  • EXPIRATION       — subscription expired → mark subscription inactive
 *  • UNCANCELLATION   — user re-enabled auto-renew → mark subscription active
 *
 * Security: Validates the Authorization header against REVENUECAT_WEBHOOK_SECRET.
 */
import supabase from '../../services/SupabaseService';

/**
 * Number of scans credited per subscription period (monthly OR annual).
 * Annual subscribers receive 30 scans up front and then 30 more each month
 * via the pg_cron job `credit_annual_subscribers` (months 2-12).
 */
const SCANS_PER_PERIOD = 30;

/**
 * Set this env var to the same value you configure as the "Authorization header"
 * in the RevenueCat webhook integration dashboard.
 */
const WEBHOOK_AUTH_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';

/**
 * GET /api/revenuecat-webhook — health check.
 * Hit this from a browser or curl to verify the route is reachable.
 */
export async function GET() {
  console.log('[Webhook] ✅ GET health-check hit');
  return Response.json({
    status: 'ok',
    route: '/api/revenuecat-webhook',
    timestamp: new Date().toISOString(),
    authConfigured: !!WEBHOOK_AUTH_SECRET,
  });
}

export async function POST(request: Request) {
  // ── Loud entry log — impossible to miss in terminal ──
  console.log('\n========================================');
  console.log('[Webhook] 🔔 INCOMING WEBHOOK REQUEST');
  console.log(`[Webhook] Time: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // ── Authorisation check ──
    if (WEBHOOK_AUTH_SECRET) {
      const authHeader = request.headers.get('Authorization');
      // RevenueCat sends the secret directly (no "Bearer " prefix), so
      // accept both the raw value and the "Bearer <secret>" form.
      const matches =
        authHeader === WEBHOOK_AUTH_SECRET ||
        authHeader === `Bearer ${WEBHOOK_AUTH_SECRET}`;
      if (!matches) {
        console.warn('[Webhook] ❌ Unauthorized — received header:', authHeader?.substring(0, 20) + '...');
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('[Webhook] ✅ Auth header validated');
    } else {
      console.warn('[Webhook] ⚠️  REVENUECAT_WEBHOOK_SECRET is NOT set — skipping auth check');
    }

    const body = await request.json();
    const event = body?.event;

    if (!event) {
      return Response.json({ error: 'Missing event payload' }, { status: 400 });
    }

    const eventType: string = event.type;
    const appUserId: string | undefined = event.app_user_id;
    const productId: string | undefined = event.product_id;
    const environment: string | undefined = event.environment;

    console.log(`[Webhook] Received ${eventType} for user=${appUserId} product=${productId} env=${environment}`);

    if (!appUserId) {
      return Response.json({ error: 'Missing app_user_id' }, { status: 400 });
    }

    const now = new Date().toISOString();

    switch (eventType) {
      case 'INITIAL_PURCHASE': {
        // First purchase — credit 30 scans regardless of plan (monthly or annual).
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            scans: SCANS_PER_PERIOD,
            subscription_product_id: productId ?? null,
            subscription_started_at: now,
            last_scan_credit_at: now,
            subscription_active: true,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] INITIAL_PURCHASE update error:', updateError);
          return Response.json({ error: updateError.message }, { status: 500 });
        }

        console.log(`[Webhook] Set scans to ${SCANS_PER_PERIOD} for ${appUserId} (initial purchase, product=${productId})`);
        break;
      }

      case 'RENEWAL': {
        // Subscription renewed — credit 30 scans for the new period.
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            scans: SCANS_PER_PERIOD,
            last_scan_credit_at: now,
            subscription_active: true,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] RENEWAL update error:', updateError);
          return Response.json({ error: updateError.message }, { status: 500 });
        }

        console.log(`[Webhook] Set scans to ${SCANS_PER_PERIOD} for ${appUserId} (renewal, product=${productId})`);
        break;
      }

      case 'CANCELLATION': {
        // User cancelled auto-renew — they keep access until expiration.
        // We mark the subscription as still active (it hasn't expired yet).
        // The EXPIRATION event will fire when it actually ends.
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] CANCELLATION update error:', updateError);
        }
        console.log(`[Webhook] Cancellation recorded for ${appUserId}`);
        break;
      }

      case 'EXPIRATION': {
        // Subscription has actually expired — revoke active status and zero out scans.
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            scans: 0,
            subscription_active: false,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] EXPIRATION update error:', updateError);
          return Response.json({ error: updateError.message }, { status: 500 });
        }
        console.log(`[Webhook] Subscription expired for ${appUserId} — scans set to 0`);
        break;
      }

      case 'UNCANCELLATION': {
        // User re-enabled auto-renew — restore 30 scans.
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            scans: SCANS_PER_PERIOD,
            subscription_active: true,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] UNCANCELLATION update error:', updateError);
        }
        console.log(`[Webhook] Uncancellation for ${appUserId} — scans set to ${SCANS_PER_PERIOD} (product=${productId})`);
        break;
      }

      case 'TEST': {
        // RevenueCat sends a TEST event when you verify your webhook URL.
        console.log('[Webhook] Test event received');
        break;
      }

      default: {
        // Log but don't error — RevenueCat may add new event types.
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
        break;
      }
    }

    // Always respond 200 quickly — RevenueCat retries on 4xx/5xx.
    console.log(`[Webhook] ✅ Responded 200 for ${eventType}`);
    console.log('========================================\n');
    return Response.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] ❌ Unhandled error:', err);
    console.log('========================================\n');
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
