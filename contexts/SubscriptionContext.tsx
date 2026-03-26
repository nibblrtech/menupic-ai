/**
 * SubscriptionContext — client-side subscription & purchase state for MenuPic AI.
 *
 * Wraps RevenueCat to expose a simple API surface:
 *  • isPremium            – does the user have an active MenuPicAI subscription?
 *  • needsPaywall         – should the paywall be shown (0 scans + no entitlement)?
 *  • offerings            – current RevenueCat offerings (packages / prices)
 *  • menuPicOffering      – the specific MENUPICAIOFFERING offering object
 *  • purchasePremium()    – buy the monthly subscription
 *  • purchaseAnnual()     – buy the annual subscription
 *  • restorePurchases()   – restore previous purchases
 *  • manageSubscription() – open the platform subscription-management sheet
 *  • refreshStatus()      – re-fetch customer info
 *  • presentPaywall()     – imperatively present the RevenueCat paywall
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, {
    PURCHASES_ERROR_CODE,
    type CustomerInfo,
    type PurchasesOffering,
    type PurchasesOfferings,
    type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Entitlements, OfferingIds, configureRevenueCat, identifyUser, resetUser } from '../services/RevenueCatService';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';

// ─── Public interface ────────────────────────────────────────────────────────

interface SubscriptionState {
  /** True while we're loading offerings / customer info for the first time. */
  isLoading: boolean;
  /** True when a purchase flow is in progress. */
  isPurchasing: boolean;
  /** Does the user currently hold the "MenuPicAI" entitlement? */
  isPremium: boolean;
  /** Will the premium subscription auto-renew? (false → user has cancelled) */
  willRenew: boolean;
  /** Human-readable expiration date of the current premium period, if any. */
  expirationDate: string | null;
  /** RevenueCat offerings — used to display prices. */
  offerings: PurchasesOfferings | null;
  /** The specific MENUPICAIOFFERING offering object. */
  menuPicOffering: PurchasesOffering | null;
  /** Convenience: the monthly premium package from the offering. */
  premiumPackage: PurchasesPackage | null;
  /** Convenience: the annual premium package from the offering. */
  annualPackage: PurchasesPackage | null;
  /** True when the paywall should be displayed (0 scans + no entitlement). */
  needsPaywall: boolean;
  /** Buy the premium monthly subscription. */
  purchasePremium: () => Promise<boolean>;
  /** Buy the premium annual subscription. */
  purchaseAnnual: () => Promise<boolean>;
  /** Restore previous purchases. */
  restorePurchases: () => Promise<void>;
  /** Open the native subscription-management UI (cancel / change). */
  manageSubscription: () => Promise<void>;
  /** Re-fetch customer info & offerings. */
  refreshStatus: () => Promise<void>;
  /** Imperatively present the RevenueCat paywall modal. Returns true if purchase/restore succeeded. */
  presentPaywall: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionState>({
  isLoading: true,
  isPurchasing: false,
  isPremium: false,
  willRenew: false,
  expirationDate: null,
  offerings: null,
  menuPicOffering: null,
  premiumPackage: null,
  annualPackage: null,
  needsPaywall: false,
  purchasePremium: async () => false,
  purchaseAnnual: async () => false,
  restorePurchases: async () => {},
  manageSubscription: async () => {},
  refreshStatus: async () => {},
  presentPaywall: async () => false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { userId } = useAuth();
  const { profile, refreshProfile } = useProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [willRenew, setWillRenew] = useState(false);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [menuPicOffering, setMenuPicOffering] = useState<PurchasesOffering | null>(null);
  const [premiumPackage, setPremiumPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);

  // ── Computed: does the user need the paywall? ──
  const needsPaywall = useMemo(() => {
    // Don't show paywall while loading
    if (isLoading) return false;
    // Show paywall if user has 0 scans AND no active subscription entitlement
    const hasNoScans = profile !== null && profile.scans === 0;
    return hasNoScans && !isPremium;
  }, [isLoading, profile, isPremium]);

  // ── Helpers ──

  const processCustomerInfo = useCallback((info: CustomerInfo) => {
    const premium = info.entitlements.active[Entitlements.PREMIUM];
    setIsPremium(!!premium);
    setWillRenew(premium?.willRenew ?? false);
    setExpirationDate(premium?.expirationDate ?? null);
  }, []);

  const loadOfferings = useCallback(async () => {
    try {
      const offeringsResult = await Purchases.getOfferings();
      setOfferings(offeringsResult);

      // Try to get the specific MENUPICAIOFFERING offering
      const specificOffering =
        offeringsResult.all[OfferingIds.MENUPICAI] ?? offeringsResult.current;

      if (specificOffering) {
        setMenuPicOffering(specificOffering);

        // The monthly subscription package
        const monthly = specificOffering.monthly ?? null;
        setPremiumPackage(monthly);

        // The annual subscription package
        const annual = specificOffering.annual ?? null;
        setAnnualPackage(annual);
      }
    } catch (err) {
      console.warn('[SubscriptionContext] Failed to load offerings:', err);
    }
  }, []);

  // ── Initialisation ──

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await configureRevenueCat();

        if (userId) {
          await identifyUser(userId);
        }

        const info = await Purchases.getCustomerInfo();
        if (!cancelled) processCustomerInfo(info);

        await loadOfferings();
      } catch (err) {
        console.warn('[SubscriptionContext] Init error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Listen for real-time updates
    const listener = (info: CustomerInfo) => {
      if (!cancelled) processCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [userId, processCustomerInfo, loadOfferings]);

  // If user signs out, reset RevenueCat (skip initial mount when user is already anonymous)
  const prevUserIdRef = React.useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const wasSignedIn = prevUserIdRef.current != null;
    prevUserIdRef.current = userId;

    if (!userId && wasSignedIn) {
      resetUser().catch(() => {});
      setIsPremium(false);
      setWillRenew(false);
      setExpirationDate(null);
    }
  }, [userId]);

  // ── Present Paywall (imperative) ──

  const doShowPaywall = useCallback(async (): Promise<boolean> => {
    try {
      // Use the specific offering if available
      const paywallOptions: any = {
        displayCloseButton: false, // Gating access — no close button
      };
      if (menuPicOffering) {
        paywallOptions.offering = menuPicOffering;
      }

      const result = await RevenueCatUI.presentPaywall(paywallOptions);

      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          // Refresh profile to pick up scans credited by webhook
          await refreshProfile();
          return true;
        case PAYWALL_RESULT.CANCELLED:
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        default:
          return false;
      }
    } catch (error: any) {
      const isCancelled =
        error.userCancelled ||
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
      if (!isCancelled) {
        console.error('[SubscriptionContext] Paywall error:', error);
      }
      return false;
    }
  }, [menuPicOffering, refreshProfile]);

  // ── Purchase: Premium Monthly ──

  const purchasePremium = useCallback(async (): Promise<boolean> => {
    if (!premiumPackage) {
      Alert.alert('Unavailable', 'Monthly subscription is not available right now.');
      return false;
    }
    setIsPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(premiumPackage);
      processCustomerInfo(customerInfo);

      if (customerInfo.entitlements.active[Entitlements.PREMIUM]) {
        await refreshProfile();
        return true;
      }
      return false;
    } catch (error: any) {
      const isCancelled =
        error.userCancelled ||
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
      if (!isCancelled) {
        Alert.alert('Purchase Error', error.message ?? 'Something went wrong.');
      }
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [premiumPackage, processCustomerInfo, refreshProfile]);

  // ── Purchase: Premium Annual ──

  const purchaseAnnual = useCallback(async (): Promise<boolean> => {
    if (!annualPackage) {
      Alert.alert('Unavailable', 'Annual subscription is not available right now.');
      return false;
    }
    setIsPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(annualPackage);
      processCustomerInfo(customerInfo);

      if (customerInfo.entitlements.active[Entitlements.PREMIUM]) {
        await refreshProfile();
        return true;
      }
      return false;
    } catch (error: any) {
      const isCancelled =
        error.userCancelled ||
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
      if (!isCancelled) {
        Alert.alert('Purchase Error', error.message ?? 'Something went wrong.');
      }
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [annualPackage, processCustomerInfo, refreshProfile]);

  // ── Restore ──

  const doRestore = useCallback(async () => {
    setIsPurchasing(true);
    try {
      const info = await Purchases.restorePurchases();
      processCustomerInfo(info);
      const restored = Object.keys(info.entitlements.active).length > 0;
      Alert.alert(
        restored ? 'Restored!' : 'Nothing Found',
        restored
          ? 'Your purchases have been restored.'
          : 'No active subscriptions found to restore.',
      );
      if (restored) await refreshProfile();
    } catch (error: any) {
      Alert.alert('Restore Error', error.message ?? 'Something went wrong.');
    } finally {
      setIsPurchasing(false);
    }
  }, [processCustomerInfo, refreshProfile]);

  // ── Manage (cancel) ──

  const manageSubscription = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Purchases.showManageSubscriptions();
      } else {
        const { Linking } = require('react-native');
        await Linking.openURL(
          'https://play.google.com/store/account/subscriptions',
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open subscription management.');
    }
  }, []);

  // ── Refresh ──

  const refreshStatus = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      processCustomerInfo(info);
      await loadOfferings();
    } catch {
      // silent
    }
  }, [processCustomerInfo, loadOfferings]);

  return (
    <SubscriptionContext.Provider
      value={{
        isLoading,
        isPurchasing,
        isPremium,
        willRenew,
        expirationDate,
        offerings,
        menuPicOffering,
        premiumPackage,
        annualPackage,
        needsPaywall,
        purchasePremium,
        purchaseAnnual,
        restorePurchases: doRestore,
        manageSubscription,
        refreshStatus,
        presentPaywall: doShowPaywall,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return ctx;
}
