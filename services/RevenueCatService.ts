/**
 * RevenueCatService — SDK initialisation helpers for MenuPic AI.
 *
 * Call `configureRevenueCat()` once at app launch (inside the root layout).
 * Everything here runs on the **client** side.
 *
 * Product identifiers must match what you configure in the RevenueCat
 * dashboard, App Store Connect, and Google Play Console.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type LogHandler } from 'react-native-purchases';

// ─── Revenue Cat API keys ────────────────────────────────────────────────────
// Replace these with your real keys from the RevenueCat dashboard.
// They are *public* SDK keys — safe to ship in-app.
const RC_IOS_API_KEY = 'appl_gRIrZbxUVWrnwTkYFkxUJqxkcjh';
const RC_ANDROID_API_KEY = 'goog_QZafXbIitVvhCjCTLakyZFddgJI';

// ─── IAP product identifiers ────────────────────────────────────────────────
// One-time consumable purchases — no subscriptions.
export const Products = {
  /** Starter pack — 10 scans — $1.99 */
  STARTER: 'menupicstarter',
  /** Popular pack — 30 scans — $4.99 */
  POPULAR: 'menupicpopular',
  /** Traveller pack — 75 scans — $9.99 */
  TRAVELLER: 'menupictraveller',
} as const;

/** Number of scans credited per IAP product. */
export const ScansPerProduct: Record<string, number> = {
  'menupicstarter': 10,
  'menupicpopular': 30,
  'menupictraveller': 75,
};

/** Fallback display prices (actual prices come from the store via RC package). */
export const ProductPrices = {
  'menupicstarter': '$1.99',
  'menupicpopular': '$4.99',
  'menupictraveller': '$9.99',
} as const;

// ─── Offering identifiers ───────────────────────────────────────────────────
export const OfferingIds = {
  /** The "MenuPic" paywall offering identifier (configured in RC dashboard with IAP products) */
  MENUPIC: 'MENUPICAIOFFERING',
} as const;

// ─── Stable user identity across reinstalls ─────────────────────────────────
//
// The RC anonymous user ID is stored in Keychain (iOS) or SharedPreferences
// (Android) by the RC SDK. On Android, SharedPreferences are cleared on
// uninstall, generating a new anonymous ID that would map to a new Supabase
// profile — losing the user's scan balance.
//
// We persist a copy of the RC user ID in expo-secure-store (iOS Keychain /
// Android Keystore-encrypted SharedPreferences). On iOS, the Keychain survives
// reinstalls, guaranteeing identity continuity. On Android, SecureStore data
// may be restored via Android Auto Backup on many devices, which would also
// recover the identity. If restoration fails (fresh Android install with no
// backup), the user gets the standard fresh-start behaviour.

const USER_ID_STORE_KEY = 'menupic_rc_stable_user_id';

/**
 * After RC is configured, check whether we have a previously persisted user
 * ID. If so and it differs from the current (new) anonymous ID, log in to RC
 * under the stored ID so the server-side profile is preserved across reinstalls.
 *
 * On first launch the current RC ID is saved. On a clean reinstall where
 * SecureStore survived (iOS Keychain always does; Android via Auto Backup),
 * the user seamlessly recovers their account.
 */
async function restoreStableUserIdIfNeeded(): Promise<void> {
  try {
    const currentId = await Purchases.getAppUserID();
    const storedId = await SecureStore.getItemAsync(USER_ID_STORE_KEY);

    if (storedId && storedId !== currentId) {
      // RC gave us a new anonymous ID (e.g. Android reinstall where the RC
      // SharedPreferences were wiped). Restore the previous user so the
      // Supabase profile lookup still finds the right account.
      if (__DEV__) {
        console.log(`[RevenueCatService] Restoring stable user: ${storedId} (was ${currentId})`);
      }
      await Purchases.logIn(storedId);
    } else if (!storedId) {
      // First-ever launch — persist the RC ID for future restores.
      await SecureStore.setItemAsync(USER_ID_STORE_KEY, currentId);
      if (__DEV__) {
        console.log(`[RevenueCatService] Persisted stable user ID: ${currentId}`);
      }
    }
  } catch (e) {
    // Non-fatal — user will have a fresh guest identity this session.
    console.warn('[RevenueCatService] Could not restore stable user ID:', e);
  }
}

// ─── Initialisation ─────────────────────────────────────────────────────────

let _configured = false;
let _configurePromise: Promise<void> | null = null;

/**
 * Initialise the RevenueCat SDK. Safe to call multiple times — will no-op
 * after the first successful configuration.
 */
export async function configureRevenueCat(): Promise<void> {
  if (_configured) return;
  if (_configurePromise) return _configurePromise;

  _configurePromise = (async () => {

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
        /rc_paywall_fonts/i,          // Android font cache dir unavailable — paywall still works
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
  })();

  try {
    await _configurePromise;
  } finally {
    _configurePromise = null;
  }
}

/**
 * After the user signs in (Apple / Google), call this so RevenueCat can
 * associate purchases with your app-level user ID.
 */
export async function identifyUser(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}

/**
 * Returns the stable app user ID for this device, restoring a previously
 * persisted identity if RC assigned a new anonymous ID (e.g. after an Android
 * reinstall). This is what we use as the key for the Supabase profile.
 */
export async function getCurrentRevenueCatUserId(): Promise<string> {
  await configureRevenueCat();
  await restoreStableUserIdIfNeeded();
  return Purchases.getAppUserID();
}

/**
 * On sign-out, reset the RevenueCat user to anonymous and clear the stored
 * stable identity so the next launch starts fresh.
 */
export async function resetUser(): Promise<void> {
  await Purchases.logOut();
  try {
    await SecureStore.deleteItemAsync(USER_ID_STORE_KEY);
  } catch (e) {
    console.warn('[RevenueCatService] Could not clear stable user ID:', e);
  }
}
