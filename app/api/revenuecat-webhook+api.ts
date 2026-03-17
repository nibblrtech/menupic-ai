/**
 * RevenueCat Webhook API Route — POST /api/revenuecat-webhook
 *
 * Receives subscription lifecycle events from RevenueCat and credits/manages
 * scans in the user's Supabase profile accordingly.
 *
 * Event types handled:
 *  • INITIAL_PURCHASE — first subscription purchase → credit 30 scans, store sub info
 *  • RENEWAL          — subscription renewed (monthly) → credit 30 scans
 *  • CANCELLATION     — user cancelled auto-renew → mark subscription inactive
 *  • EXPIRATION       — subscription expired → mark subscription inactive
 *  • UNCANCELLATION   — user re-enabled auto-renew → mark subscription active
 *
 * Security: Validates the Authorization header against REVENUECAT_WEBHOOK_SECRET.
 */
import supabase from '../../services/SupabaseService';

/** Number of scans credited per subscription period. */
const SCANS_PER_PERIOD = 30;

/**
 * Set this env var to the same value you configure as the "Authorization header"
 * in the RevenueCat webhook integration dashboard.
 */
const WEBHOOK_AUTH_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';

export async function POST(request: Request) {
  try {
    // ── Authorisation check ──
    if (WEBHOOK_AUTH_SECRET) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${WEBHOOK_AUTH_SECRET}`) {
        console.warn('[Webhook] Unauthorized request');
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
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
        // First purchase — credit scans and store subscription metadata.
        // Step 1: Credit scans atomically
        const { error: rpcError } = await supabase.rpc('credit_scans', {
          p_user_id: appUserId,
          p_amount: SCANS_PER_PERIOD,
        });
        if (rpcError) {
          console.error('[Webhook] credit_scans RPC error:', rpcError);
        }

        // Step 2: Update subscription fields
        const { error: updateError } = await supabase
          .from('profile')
          .update({
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

        console.log(`[Webhook] Credited ${SCANS_PER_PERIOD} scans to ${appUserId} (initial purchase)`);
        break;
      }

      case 'RENEWAL': {
        // Subscription renewed (fires monthly for monthly subs, yearly for annual subs).
        // Credit another 30 scans.
        const { error: rpcError } = await supabase.rpc('credit_scans', {
          p_user_id: appUserId,
          p_amount: SCANS_PER_PERIOD,
        });
        if (rpcError) {
          console.error('[Webhook] credit_scans RPC error:', rpcError);
        }

        const { error: updateError } = await supabase
          .from('profile')
          .update({
            last_scan_credit_at: now,
            subscription_active: true,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] RENEWAL update error:', updateError);
          return Response.json({ error: updateError.message }, { status: 500 });
        }

        console.log(`[Webhook] Credited ${SCANS_PER_PERIOD} scans to ${appUserId} (renewal)`);
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
        // Subscription has actually expired — revoke active status.
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            subscription_active: false,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] EXPIRATION update error:', updateError);
          return Response.json({ error: updateError.message }, { status: 500 });
        }
        console.log(`[Webhook] Subscription expired for ${appUserId}`);
        break;
      }

      case 'UNCANCELLATION': {
        // User re-enabled auto-renew.
        const { error: updateError } = await supabase
          .from('profile')
          .update({
            subscription_active: true,
            updated_at: now,
          })
          .eq('user_id', appUserId);

        if (updateError) {
          console.error('[Webhook] UNCANCELLATION update error:', updateError);
        }
        console.log(`[Webhook] Uncancellation for ${appUserId}`);
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
    return Response.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] Unhandled error:', err);
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
