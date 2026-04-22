/**
 * RevenueCatService — SDK initialisation helpers for MenuPic AI.
 *
 * Call `configureRevenueCat()` once at app launch (inside the root layout).
 * Everything here runs on the **client** side.
 *
 * Product identifiers must match what you configure in the RevenueCat
 * dashboard, App Store Connect, and Google Play Console.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type LogHandler } from 'react-native-purchases';

// ─── Revenue Cat API keys ────────────────────────────────────────────────────
// Replace these with your real keys from the RevenueCat dashboard.
// They are *public* SDK keys — safe to ship in-app.
const RC_IOS_API_KEY = 'appl_gRIrZbxUVWrnwTkYFkxUJqxkcjh';
const RC_ANDROID_API_KEY = 'test_ycfBeqJBBuSclaJeltyNSeruYRp';

// ─── IAP product identifiers ────────────────────────────────────────────────
// One-time consumable purchases — no subscriptions.
export const Products = {
  /** Starter pack — 10 scans — $1.99 */
  STARTER: 'MENUPIC_IAP_STARTER',
  /** Popular pack — 30 scans — $4.99 */
  POPULAR: 'MENUPIC_IAP_POPULAR',
  /** Traveller pack — 75 scans — $9.99 */
  TRAVELLER: 'MENUPIC_IAP_TRAVELLER',
} as const;

/** Number of scans credited per IAP product. */
export const ScansPerProduct: Record<string, number> = {
  MENUPIC_IAP_STARTER: 10,
  MENUPIC_IAP_POPULAR: 30,
  MENUPIC_IAP_TRAVELLER: 75,
};

/** Fallback display prices (actual prices come from the store via RC package). */
export const ProductPrices = {
  MENUPIC_IAP_STARTER: '$1.99',
  MENUPIC_IAP_POPULAR: '$4.99',
  MENUPIC_IAP_TRAVELLER: '$9.99',
} as const;

// ─── Offering identifiers ───────────────────────────────────────────────────
export const OfferingIds = {
  /** The "MenuPic" paywall offering identifier (configured in RC dashboard with IAP products) */
  MENUPIC: 'MENUPICAIOFFERING',
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
    // Custom log handler: suppress known transient/benign errors that the SDK
    // logs at ERROR level (they trigger LogBox / red-bar in dev).
    const suppressedErrorPatterns = [
      /cancel/i,                    // User-initiated purchase cancellation
      /currently being ingested/i,  // Transient 529 — SDK retries automatically
      /offline/i,                   // Offline CustomerInfo computation fallback
      /failedMovingNewFile/i,       // Internal SDK file-cleanup race condition
      /paywall_event_store/i,       // SDK event store file already removed
      /problem.+store/i,            // Transient App Store communication error — SDK retries
      /validate the receipt/i,      // Receipt validation hiccup (common in sandbox)
    ];

    const handler: LogHandler = (logLevel, message) => {
      if (
        logLevel === LOG_LEVEL.ERROR &&
        suppressedErrorPatterns.some((p) => p.test(message))
      ) {
        // Downgrade to a regular log instead of red-bar error
        console.log(`[RevenueCat] (suppressed error) ${message}`);
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
 * Returns RevenueCat's current app user ID (anonymous or logged-in).
 */
export async function getCurrentRevenueCatUserId(): Promise<string> {
  await configureRevenueCat();
  return Purchases.getAppUserID();
}

/**
 * On sign-out, reset the RevenueCat user to anonymous.
 */
export async function resetUser(): Promise<void> {
  await Purchases.logOut();
}
