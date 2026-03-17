# RevenueCat + In-App Purchases — Setup Checklist

> This document walks you through everything you need to do **outside the codebase** to wire up RevenueCat with Apple and Google so the subscription and consumable products actually work.

---

## 1  Create a RevenueCat Account & Project

| Step | Details |
|------|---------|
| Sign up | [https://app.revenuecat.com/signup](https://app.revenuecat.com/signup) — free tier is generous. |
| Create a **Project** | Name it `menupic-ai`. |
| Note your **Project ID** | You'll need it for webhook configuration later. |

---

## 2  Apple — App Store Connect Setup

### 2a  Create the App (if not already)
- Go to **App Store Connect → My Apps → +** and register your app with bundle ID `com.nibblr.menupicai`.

### 2b  Create a Shared Secret
- Go to **App Store Connect → My Apps → [menupic-ai] → General → App Information → App-Specific Shared Secret** and generate one.
- Copy it — you'll paste it into RevenueCat.

### 2c  Create Products in App Store Connect
Navigate to **App Store Connect → My Apps → [menupic-ai] → Monetization → Subscriptions** (and **In-App Purchases** for consumables).

| Product Type | Product ID | Reference Name | Price / Duration |
|---|---|---|---|
| **Auto-Renewable Subscription** | `MENUPICAIPREMIUM` | MenuPicAI Monthly | Choose your price / 1 month |
| **Auto-Renewable Subscription** | `MENUPICAIPREMIUMANNUAL` | MenuPicAI Annual | Choose your price / 1 year |

**For the subscriptions:**
1. Create a **Subscription Group** called `MenuPicAI Plans`.
2. Add the product `MENUPICAIPREMIUM` to that group.
3. Set the duration to **1 Month**.
4. Add the product `MENUPICAIPREMIUMANNUAL` to that group.
5. Set the duration to **1 Year**.
6. Add localisation (display name, description) for both.

### 2d  Set up In-App Purchase Keys (StoreKit 2)
- Go to **Users and Access → Integrations → In-App Purchases** and generate a **Subscription Key** (for StoreKit 2 server notifications).
- Download the `.p8` key file and note the **Key ID** and **Issuer ID**.

### 2e  App Store Server Notifications V2
- In **App Store Connect → My Apps → [menupic-ai] → General → App Information**, set the **App Store Server Notifications URL** to:
  ```
  https://api.revenuecat.com/v1/subscribers/apple
  ```
  (RevenueCat will give you the exact URL in your dashboard under **Apple App Store settings**.)

---

## 3  Google — Google Play Console Setup

### 3a  Create Products in Google Play Console
Navigate to **Google Play Console → [menupic-ai] → Monetize → Products**.

| Product Type | Product ID | Price / Duration |
|---|---|---|
| **Subscription** | `MENUPICAIPREMIUM` | Choose price / 1 month base plan |
| **Subscription** | `MENUPICAIPREMIUMANNUAL` | Choose price / 1 year base plan |

**For the monthly subscription:**
1. Go to **Subscriptions → Create subscription**.
2. Product ID: `MENUPICAIPREMIUM`.
3. Add a **Base plan** with 1-month billing period.
4. Set the price.
5. Activate the base plan.

**For the annual subscription:**
1. Go to **Subscriptions → Create subscription**.
2. Product ID: `MENUPICAIPREMIUMANNUAL`.
3. Add a **Base plan** with 1-year billing period.
4. Set the price.
5. Activate the base plan.

### 3b  Service Account for RevenueCat
1. Go to **Google Cloud Console → IAM & Admin → Service Accounts**.
2. Create a service account (or use an existing one).
3. Grant it the **Pub/Sub Editor** role.
4. In **Google Play Console → Setup → API access**, link the service account and grant **Financial data** + **Manage orders** permissions.
5. Generate a **JSON key** for the service account — you'll upload this to RevenueCat.

### 3c  Real-Time Developer Notifications (RTDN)
- In **Google Play Console → [menupic-ai] → Monetize → Monetization setup**, set the **Topic name** for real-time notifications to the topic RevenueCat gives you in the dashboard.

---

## 4  Configure RevenueCat Dashboard

### 4a  Connect the Stores
| Store | What to add |
|-------|-------------|
| **Apple** | Shared secret, StoreKit 2 key (.p8), Key ID, Issuer ID |
| **Google** | Upload the service account JSON key |

### 4b  Add Products
In RevenueCat, go to **Products** and register both:
- `MENUPICAIPREMIUM` (Apple + Google)
- `MENUPICAIPREMIUMANNUAL` (Apple + Google)

### 4c  Create an Entitlement
| Entitlement ID | Products |
|---|---|
| `MenuPicAI` | `MENUPICAIPREMIUM`, `MENUPICAIPREMIUMANNUAL` |

> Both subscription products map to the same `MenuPicAI` entitlement.

### 4d  Create an Offering
| Offering ID | Packages |
|---|---|
| `MENUPICAIOFFERING` | `$rc_monthly` → `MENUPICAIPREMIUM`  •  `$rc_annual` → `MENUPICAIPREMIUMANNUAL` |

1. Create an Offering called `MENUPICAIOFFERING` and mark it as **Current**.
2. Add a **Monthly** package pointing to `MENUPICAIPREMIUM`.
3. Add an **Annual** package pointing to `MENUPICAIPREMIUMANNUAL`.
4. Create a paywall called **MenuPicAIPaywall** and attach it to this offering.

> See `REVENUECAT_PAYWALL_SETUP.md` for full paywall configuration details.

### 4e  Get Your API Keys
- Go to **Project Settings → API Keys**.
- Copy the **Apple public key** → paste into `services/RevenueCatService.ts` as `RC_IOS_API_KEY`.
- Copy the **Google public key** → paste into `services/RevenueCatService.ts` as `RC_ANDROID_API_KEY`.

---

## 5  Server-Side Webhook (Crediting Scans)

When a user purchases a subscription, RevenueCat fires webhook events to your server to credit scans.

### Webhook Implementation (Production — already built)
The webhook handler is at `app/api/revenuecat-webhook+api.ts` and handles:
- `INITIAL_PURCHASE` → credit 30 scans, store subscription info
- `RENEWAL` → credit 30 scans (fires monthly for monthly subs, yearly for annual)
- `EXPIRATION` → mark subscription inactive
- `CANCELLATION` → log (user keeps access until expiration)
- `UNCANCELLATION` → re-activate subscription

### Annual Subscriber Monthly Crediting
Since RevenueCat only fires `RENEWAL` once per year for annual subs, a `pg_cron`
job inside Supabase runs daily to credit 30 scans to annual subscribers whose
last credit was ≥ 30 days ago. No external scheduler or API route needed.

> See `REVENUECAT_PAYWALL_SETUP.md` for complete webhook + pg_cron setup steps.

---

## 6  Testing

### Sandbox / TestFlight (iOS)
1. Create **Sandbox test accounts** in App Store Connect (Users & Access → Sandbox → Testers).
2. On your test device, sign into the sandbox account under **Settings → App Store → Sandbox Account**.
3. Build with `npx expo run:ios` (dev client) or via EAS Build.
4. Purchases will go through Apple's sandbox — subscriptions renew on an accelerated schedule (monthly = 5 minutes).

### Google Play Internal Testing
1. Add your Google account to a **License testing** list in **Google Play Console → Settings → License Testing**.
2. Upload an internal test build via EAS Build or `npx expo run:android`.
3. Purchases will be test purchases — no real charges.

### RevenueCat Sandbox Mode
- Enable **Debug Logs** (already done in `RevenueCatService.ts` for `__DEV__`).
- Use the **RevenueCat Dashboard → Customers** tab to inspect sandbox purchases in real time.

---

## 7  EAS Build Note

Since `react-native-purchases` is a native module, you **must** use a development build (not Expo Go):

```bash
# Build a dev client for iOS
eas build --profile development --platform ios

# Build a dev client for Android
eas build --profile development --platform android
```

Or use local builds:
```bash
npx expo run:ios
npx expo run:android
```

---

## 8  Checklist Summary

- [ ] RevenueCat account created + project set up
- [ ] Apple: Products created in App Store Connect (`MENUPICAIPREMIUM`, `MENUPICAIPREMIUMANNUAL`)
- [ ] Apple: Subscription group created
- [ ] Apple: Shared secret generated and added to RevenueCat
- [ ] Apple: StoreKit 2 key (`.p8`) uploaded to RevenueCat
- [ ] Apple: Server Notifications V2 URL configured
- [ ] Google: Products created in Play Console (`MENUPICAIPREMIUM`, `MENUPICAIPREMIUMANNUAL`)
- [ ] Google: Service account JSON key uploaded to RevenueCat
- [ ] Google: RTDN topic configured
- [ ] RevenueCat: Products registered
- [ ] RevenueCat: `MenuPicAI` entitlement created and mapped to both products
- [ ] RevenueCat: `MENUPICAIOFFERING` offering created with monthly + annual packages
- [ ] RevenueCat: `MenuPicAIPaywall` paywall created and attached to offering
- [ ] RevenueCat: Webhook configured (see `REVENUECAT_PAYWALL_SETUP.md`)
- [ ] RevenueCat: API keys copied into `services/RevenueCatService.ts`
- [ ] Server: `REVENUECAT_WEBHOOK_SECRET` env var set
- [ ] Supabase: `pg_cron` extension enabled
- [ ] Supabase: Migration run (`20260314000000_add_subscription_fields.sql`)
- [ ] Supabase: Migration run (`20260314000001_add_pg_cron_annual_crediting.sql`)
- [ ] Testing: Sandbox accounts configured (Apple + Google)
- [ ] Build: Dev client built via EAS or local `expo run`
