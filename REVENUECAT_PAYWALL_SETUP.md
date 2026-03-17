# MenuPicAIPaywall — RevenueCat Configuration Guide

> Step-by-step instructions for configuring RevenueCat to work with the paywall implementation in this codebase.

---

## 1  RevenueCat Dashboard — Products

Create the following products in the RevenueCat dashboard (**Project → Products**):

| Display Name | Product ID | Stores |
|---|---|---|
| MenuPicAI Monthly | `MENUPICAIPREMIUM` | Apple App Store, Google Play |
| MenuPicAI Annual | `MENUPICAIPREMIUMANNUAL` | Apple App Store, Google Play |

> These IDs must **exactly** match what's in `services/RevenueCatService.ts` → `Products`.

---

## 2  App Store Connect — Create Products

### Monthly Subscription
1. Go to **App Store Connect → [menupic-ai] → Monetization → Subscriptions**.
2. Create a **Subscription Group** called `MenuPicAI Plans`.
3. Add a product:
   - **Product ID:** `MENUPICAIPREMIUM`
   - **Reference Name:** MenuPicAI Monthly
   - **Duration:** 1 Month
   - Set your price and add localisation.

### Annual Subscription
1. In the same subscription group `MenuPicAI Plans`, add another product:
   - **Product ID:** `MENUPICAIPREMIUMANNUAL`
   - **Reference Name:** MenuPicAI Annual
   - **Duration:** 1 Year
   - Set your price (typically with a discount vs. monthly × 12).
   - Add localisation.

---

## 3  Google Play Console — Create Products

### Monthly Subscription
1. Go to **Google Play Console → [menupic-ai] → Monetize → Subscriptions → Create subscription**.
2. **Product ID:** `MENUPICAIPREMIUM`
3. Add a **Base plan** with 1-month billing period.
4. Set the price and activate.

### Annual Subscription
1. Create another subscription:
2. **Product ID:** `MENUPICAIPREMIUMANNUAL`
3. Add a **Base plan** with 1-year billing period.
4. Set the price and activate.

---

## 4  RevenueCat Dashboard — Entitlement

Create one entitlement:

| Entitlement ID | Products |
|---|---|
| `MenuPicAI` | `MENUPICAIPREMIUM`, `MENUPICAIPREMIUMANNUAL` |

Both products map to the **same** entitlement — either subscription grants `MenuPicAI` access.

---

## 5  RevenueCat Dashboard — Offering

| Offering ID | Current? | Packages |
|---|---|---|
| `MENUPICAIOFFERING` | ✅ Yes | Monthly (`$rc_monthly`) → `MENUPICAIPREMIUM`  ·  Annual (`$rc_annual`) → `MENUPICAIPREMIUMANNUAL` |

Steps:
1. Go to **Offerings → + New**.
2. **Identifier:** `MENUPICAIOFFERING`
3. Mark it as **Current Offering**.
4. Add packages:
   - **Monthly** package → map to `MENUPICAIPREMIUM`
   - **Annual** package → map to `MENUPICAIPREMIUMANNUAL`

---

## 6  RevenueCat Dashboard — Paywall

1. Go to **Paywalls** in the RevenueCat dashboard.
2. Create a new paywall called **MenuPicAIPaywall**.
3. Attach it to the **MENUPICAIOFFERING** offering.
4. Design the paywall using RevenueCat's paywall editor:
   - Add a title (e.g. "Unlock MenuPic AI Premium")
   - Add a subtitle (e.g. "Get 30 menu scans per month")
   - The monthly and annual packages will appear automatically.
5. Save and publish the paywall.

> The `react-native-purchases-ui` SDK automatically renders the paywall you designed in the dashboard.

---

## 7  RevenueCat Dashboard — Webhook Configuration

This is **critical** for the scan crediting system to work.

### 7a  Set up the Webhook
1. Go to **Project Settings → Integrations → + New → Webhooks**.
2. Configure:
   - **Name:** `MenuPicAI Production Webhook`
   - **URL:** `https://<YOUR_DEPLOYED_URL>/api/revenuecat-webhook`
     - Replace `<YOUR_DEPLOYED_URL>` with your Expo server's production URL (from EAS or your hosting provider).
   - **Authorization Header:** `Bearer <YOUR_WEBHOOK_SECRET>`
     - Generate a random secret string (e.g. `openssl rand -hex 32`).
     - Save this value — you'll need it as an environment variable.

### 7b  Set the Environment Variable
On your hosting platform (EAS, Vercel, etc.), set:

```bash
REVENUECAT_WEBHOOK_SECRET=<the_secret_you_generated>
```

This must match the "Authorization Header" value you entered in RevenueCat (without the `Bearer ` prefix — the code adds that).

### 7c  Event Types to Enable
Enable at least these event types in the webhook configuration:
- ✅ `INITIAL_PURCHASE`
- ✅ `RENEWAL`
- ✅ `CANCELLATION`
- ✅ `EXPIRATION`
- ✅ `UNCANCELLATION`
- ✅ `TEST` (for testing)

### 7d  Test the Webhook
1. In the RevenueCat dashboard, click **Send Test Webhook**.
2. Check your server logs for `[Webhook] Test event received`.
3. If you get a 200 response, the webhook is working.

---

## 8  pg_cron — Monthly Scan Crediting for Annual Subscribers

**Why:** RevenueCat only fires `RENEWAL` once per year for annual subscriptions,
but annual subscribers need 30 scans credited every month. Monthly subscribers
are already handled by the RENEWAL webhook (fires every month).

**How:** A `pg_cron` job runs daily inside Supabase itself — no external
scheduler, no API route, no extra secrets.

### Setup

1. **Enable pg_cron** in Supabase Dashboard → **Database → Extensions** → search
   `pg_cron` → toggle **ON**.

2. **Run the migration** `supabase/migrations/20260314000001_add_pg_cron_annual_crediting.sql`:
   ```bash
   # Via Supabase CLI:
   supabase db push

   # Or paste the SQL into the Supabase SQL Editor.
   ```

This creates:
- `credit_annual_subscribers()` — finds active annual subs with `last_scan_credit_at` ≥ 30 days ago, credits 30 scans, updates the timestamp.
- A cron schedule `credit-annual-scans` that calls it daily at 3:00 AM UTC.

### Verify
```sql
-- Check scheduled jobs:
SELECT * FROM cron.job;

-- Check recent runs:
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Test manually:
SELECT credit_annual_subscribers();
```

### Unschedule (if needed)
```sql
SELECT cron.unschedule('credit-annual-scans');
```

---

## 9  Supabase Database Migration

Run the migration in `supabase/migrations/20260314000000_add_subscription_fields.sql`:

```bash
# If using Supabase CLI:
supabase db push

# Or copy-paste the SQL into the Supabase SQL Editor.
```

This adds:
- `subscription_product_id` — tracks which product the user subscribes to
- `subscription_started_at` — when the subscription started
- `last_scan_credit_at` — when scans were last credited (for cron tracking)
- `subscription_active` — boolean flag set by webhooks
- `credit_scans()` — Postgres function for atomic scan incrementing
- Index for efficient cron queries

---

## 10  RevenueCat API Keys

Copy the **public** SDK API keys from **Project Settings → API Keys** in RevenueCat:

| Key | Goes in |
|---|---|
| Apple public key | `services/RevenueCatService.ts` → `RC_IOS_API_KEY` |
| Google public key | `services/RevenueCatService.ts` → `RC_ANDROID_API_KEY` |

> ⚠️ Replace the placeholder `test_ycfBeqJBBuSclaJeltyNSeruYRp` values.

---

## 11  Environment Variables Summary

| Variable | Where | Purpose |
|---|---|---|
| `REVENUECAT_WEBHOOK_SECRET` | Server / EAS | Validates incoming webhook requests from RevenueCat |
| `SUPABASE_URL` | Server / EAS | Supabase project URL (already set) |
| `SUPABASE_SECRET_KEY` | Server / EAS | Supabase service role key (already set) |

---

## 12  How the Paywall Flow Works

```
User logs in
    ↓
Profile fetched (GET /api/profile)
    ↓
Profile has scans === 0?  ──No──→  Show scan page normally
    ↓ Yes
User has active "MenuPicAI" entitlement?  ──Yes──→  Show scan page
    ↓ No
Show RevenueCat Paywall (MenuPicAIPaywall / MENUPICAIOFFERING)
    ↓
User purchases MENUPICAIPREMIUM or MENUPICAIPREMIUMANNUAL
    ↓
RevenueCat fires INITIAL_PURCHASE webhook
    ↓
Webhook credits 30 scans + stores subscription info
    ↓
Client refreshes profile → scans > 0 → scan page unlocked
```

### Monthly Renewal (Monthly Sub):
```
RevenueCat fires RENEWAL webhook (every month)
    ↓
Webhook credits 30 scans
```

### Monthly Renewal (Annual Sub):
```
pg_cron runs daily at 3:00 AM UTC (inside Supabase)
    ↓
credit_annual_subscribers() finds annual subs
  with last_scan_credit_at ≥ 30 days ago
    ↓
Credits 30 scans + updates last_scan_credit_at
```

---

## 13  Checklist

- [ ] Products created in App Store Connect (`MENUPICAIPREMIUM`, `MENUPICAIPREMIUMANNUAL`)
- [ ] Subscription group created in App Store Connect
- [ ] Products created in Google Play Console
- [ ] Products registered in RevenueCat
- [ ] `MenuPicAI` entitlement created in RevenueCat, mapped to both products
- [ ] `MENUPICAIOFFERING` offering created in RevenueCat with monthly + annual packages
- [ ] **MenuPicAIPaywall** paywall created and attached to offering
- [ ] Webhook configured in RevenueCat with your server URL
- [ ] `REVENUECAT_WEBHOOK_SECRET` env var set on server
- [ ] Supabase migration run: `20260314000000_add_subscription_fields.sql` (subscription fields + `credit_scans` function)
- [ ] `pg_cron` extension enabled in Supabase Dashboard
- [ ] Supabase migration run: `20260314000001_add_pg_cron_annual_crediting.sql` (annual crediting cron)
- [ ] RevenueCat API keys updated in `services/RevenueCatService.ts`
- [ ] Apple Server Notifications V2 URL configured for RevenueCat
- [ ] Google RTDN topic configured for RevenueCat
- [ ] Test webhook sent successfully from RevenueCat dashboard
- [ ] Sandbox purchase tested end-to-end
