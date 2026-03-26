/**
 * RevenueCatService — SDK initialisation helpers for MenuPic AI.
 *
 * Call `configureRevenueCat()` once at app launch (inside the root layout).
 * Everything here runs on the **client** side.
 *
 * Product / entitlement identifiers must match what you configure in the
 * RevenueCat dashboard, App Store Connect, and Google Play Console.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type LogHandler } from 'react-native-purchases';

// ─── Revenue Cat API keys ────────────────────────────────────────────────────
// Replace these with your real keys from the RevenueCat dashboard.
// They are *public* SDK keys — safe to ship in-app.
const RC_IOS_API_KEY = 'appl_gRIrZbxUVWrnwTkYFkxUJqxkcjh';
const RC_ANDROID_API_KEY = 'test_ycfBeqJBBuSclaJeltyNSeruYRp';

// ─── Product identifiers ────────────────────────────────────────────────────
// These must match the product IDs you create in App Store Connect / Google
// Play Console **and** register in the RevenueCat dashboard.
export const Products = {
  /** Monthly premium subscription — 30 scans / month */
  PREMIUM_MONTHLY: 'MENUPICAIPREMIUM',
  /** Annual premium subscription — 12 months at a discount */
  PREMIUM_ANNUAL: 'MENUPICAIPREMIUMANNUAL',
} as const;

// ─── Entitlement identifiers ────────────────────────────────────────────────
export const Entitlements = {
  /** Granted when the user has an active MenuPicAI subscription */
  PREMIUM: 'MenuPicAI',
} as const;

// ─── Offering identifiers ───────────────────────────────────────────────────
export const OfferingIds = {
  /** The MenuPicAI paywall offering */
  MENUPICAI: 'MENUPICAIOFFERING',
} as const;

// ─── Initialisation ─────────────────────────────────────────────────────────

let _configured = false;

/**
 * Initialise the RevenueCat SDK. Safe to call multiple times — will no-op
 * after the first successful configuration.
 */
export async function configureRevenueCat(): Promise<void> {
  if (_configured) return;

  if (__DEV__) {
    // Custom log handler: suppress purchase-cancellation errors that the SDK
    // logs at ERROR level (they trigger LogBox / red-bar in dev).
    const cancelPattern = /cancel/i;

    const handler: LogHandler = (logLevel, message) => {
      if (logLevel === LOG_LEVEL.ERROR && cancelPattern.test(message)) {
        // Silently swallow cancellation errors
        return;
      }

      switch (logLevel) {
        case LOG_LEVEL.ERROR:
          console.error(`[RevenueCat] ${message}`);
          break;
        case LOG_LEVEL.WARN:
          console.warn(`[RevenueCat] ${message}`);
          break;
        default:
          console.log(`[RevenueCat] ${message}`);
          break;
      }
    };

    Purchases.setLogHandler(handler);
  }

  const apiKey = Platform.OS === 'ios' ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;

  await Purchases.configure({ apiKey });
  _configured = true;
}

/**
 * After the user signs in (Apple / Google), call this so RevenueCat can
 * associate purchases with your app-level user ID.
 */
export async function identifyUser(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}

/**
 * On sign-out, reset the RevenueCat user to anonymous.
 */
export async function resetUser(): Promise<void> {
  await Purchases.logOut();
}
