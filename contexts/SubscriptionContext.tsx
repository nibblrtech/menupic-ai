/**
 * SubscriptionContext — IAP purchase state for MenuPic AI.
 *
 * Wraps RevenueCat to expose a simple API surface for one-time consumable
 * in-app purchases (no subscriptions):
 *
 *  • needsPaywall         – should the paywall be shown (user has 0 scans)?
 *  • isLoading            – true while initialising
 *  • isPurchasing         – true during a purchase flow
 *  • offerings            – current RevenueCat offerings
 *  • menuPicOffering      – the specific MENUPICAIOFFERING offering object
 *  • starterPackage       – the MENUPIC_IAP_STARTER RC package (or null)
 *  • popularPackage       – the MENUPIC_IAP_POPULAR RC package (or null)
 *  • travellerPackage     – the MENUPIC_IAP_TRAVELLER RC package (or null)
 *  • purchaseStarter()    – buy 10 scans ($1.99)
 *  • purchasePopular()    – buy 30 scans ($4.99)
 *  • purchaseTraveller()  – buy 75 scans ($9.99)
 *  • restorePurchases()   – restore previous purchases (required by App Store)
 *  • refreshStatus()      – re-fetch offerings / customer info
 *  • presentPaywall()     – imperatively present the RevenueCat paywall modal
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react';
import { Alert } from 'react-native';
import Purchases, {
    PURCHASES_ERROR_CODE,
    type PurchasesOffering,
    type PurchasesOfferings,
    type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { OfferingIds, Products, ScansPerProduct, configureRevenueCat } from '../services/RevenueCatService';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';

// ─── Public interface ────────────────────────────────────────────────────────

interface SubscriptionState {
  /** True while we're loading offerings for the first time. */
  isLoading: boolean;
  /** True when a purchase flow is in progress. */
  isPurchasing: boolean;
  /** RevenueCat offerings — used to display prices. */
  offerings: PurchasesOfferings | null;
  /** The specific MENUPICAIOFFERING offering object. */
  menuPicOffering: PurchasesOffering | null;
  /** Convenience: the Starter IAP package (10 scans, $1.99). */
  starterPackage: PurchasesPackage | null;
  /** Convenience: the Popular IAP package (30 scans, $4.99). */
  popularPackage: PurchasesPackage | null;
  /** Convenience: the Traveller IAP package (75 scans, $9.99). */
  travellerPackage: PurchasesPackage | null;
  /** True when the paywall should be displayed (user has 0 scans). */
  needsPaywall: boolean;
  /** Buy the Starter pack (10 scans, $1.99). */
  purchaseStarter: () => Promise<boolean>;
  /** Buy the Popular pack (30 scans, $4.99). */
  purchasePopular: () => Promise<boolean>;
  /** Buy the Traveller pack (75 scans, $9.99). */
  purchaseTraveller: () => Promise<boolean>;
  /** Restore previous purchases (required by App Store guidelines). */
  restorePurchases: () => Promise<void>;
  /** Re-fetch offerings. */
  refreshStatus: () => Promise<void>;
  /** Imperatively present the RevenueCat paywall modal. Returns true if a purchase succeeded. */
  presentPaywall: () => Promise<boolean>;
  /** Credit scans for a completed purchase by product ID. Used by inline paywall callbacks. */
  creditProductPurchase: (productId: string) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState>({
  isLoading: true,
  isPurchasing: false,
  offerings: null,
  menuPicOffering: null,
  starterPackage: null,
  popularPackage: null,
  travellerPackage: null,
  needsPaywall: false,
  purchaseStarter: async () => false,
  purchasePopular: async () => false,
  purchaseTraveller: async () => false,
  restorePurchases: async () => {},
  refreshStatus: async () => {},
  presentPaywall: async () => false,
  creditProductPurchase: async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { effectiveUserId } = useAuth();
  const { profile, addScans, setScans, refreshProfile } = useProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [menuPicOffering, setMenuPicOffering] = useState<PurchasesOffering | null>(null);
  const [starterPackage, setStarterPackage] = useState<PurchasesPackage | null>(null);
  const [popularPackage, setPopularPackage] = useState<PurchasesPackage | null>(null);
  const [travellerPackage, setTravellerPackage] = useState<PurchasesPackage | null>(null);

  // ── Computed: does the user need the paywall? ──
  // Show paywall when profile is loaded and scans === 0.
  // Debounced to prevent UI flashing on rapid state transitions.
  const rawNeedsPaywall = useMemo(() => {
    if (isLoading) return false;
    return profile !== null && profile.scans <= 0;
  }, [isLoading, profile]);

  const [needsPaywall, setNeedsPaywall] = useState(false);
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!rawNeedsPaywall) {
      if (paywallTimerRef.current) {
        clearTimeout(paywallTimerRef.current);
        paywallTimerRef.current = null;
      }
      setNeedsPaywall(false);
      return;
    }

    if (paywallTimerRef.current) clearTimeout(paywallTimerRef.current);
    paywallTimerRef.current = setTimeout(() => {
      setNeedsPaywall(true);
      paywallTimerRef.current = null;
    }, 800);

    return () => {
      if (paywallTimerRef.current) {
        clearTimeout(paywallTimerRef.current);
        paywallTimerRef.current = null;
      }
    };
  }, [rawNeedsPaywall]);

  // ── Load offerings ──

  const loadOfferings = useCallback(async () => {
    try {
      const offeringsResult = await Purchases.getOfferings();
      setOfferings(offeringsResult);

      const specificOffering =
        offeringsResult.all[OfferingIds.MENUPIC] ?? offeringsResult.current;

      if (specificOffering) {
        setMenuPicOffering(specificOffering);

        // Find IAP packages by product identifier within the offering's packages
        const pkgs = specificOffering.availablePackages;
        setStarterPackage(
          pkgs.find(p => p.product.identifier === Products.STARTER) ?? null
        );
        setPopularPackage(
          pkgs.find(p => p.product.identifier === Products.POPULAR) ?? null
        );
        setTravellerPackage(
          pkgs.find(p => p.product.identifier === Products.TRAVELLER) ?? null
        );
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
        await loadOfferings();
      } catch (err) {
        console.warn('[SubscriptionContext] Init error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadOfferings]);

  // ── Core purchase helper ──

  const doPurchase = useCallback(
    async (pkg: PurchasesPackage | null, label: string): Promise<boolean> => {
      if (!pkg) {
        Alert.alert('Unavailable', `${label} is not available right now.`);
        return false;
      }
      setIsPurchasing(true);
      try {
        await Purchases.purchasePackage(pkg);
        const productId = pkg.product.identifier;
        const scansToAdd = ScansPerProduct[productId] ?? 0;

        if (__DEV__) {
          console.log(`[SubscriptionContext] Purchased ${productId} — crediting ${scansToAdd} scans`);
        }

        // Optimistically credit scans on the client immediately for instant UI feedback
        if (scansToAdd > 0) {
          addScans(scansToAdd);
        }

        // Persist the credit to the server and sync the authoritative total back to the client
        if (effectiveUserId && scansToAdd > 0) {
          try {
            const res = await fetch('/api/credit-scans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: effectiveUserId, scans: scansToAdd, product_id: productId }),
            });
            if (res.ok) {
              const json = await res.json();
              // Sync with the server's authoritative scan total
              if (typeof json.scans === 'number') {
                setScans(json.scans);
                if (__DEV__) {
                  console.log(`[SubscriptionContext] Server confirmed ${json.scans} scans after purchase`);
                }
              }
            } else {
              const errJson = await res.json().catch(() => ({}));
              console.warn('[SubscriptionContext] credit-scans failed:', res.status, errJson);
              // Fall back to a full server refresh so the DB state wins
              await refreshProfile();
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Failed to persist scan credit:', err);
            // Fall back to a full server refresh so the DB state wins
            await refreshProfile();
          }
        }

        return true;
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
    },
    [addScans, setScans, refreshProfile, effectiveUserId]
  );

  // Credit scans for a purchase completed via the inline <RevenueCatUI.Paywall> component.
  // That component doesn't go through doPurchase(), so we handle crediting here.
  const creditProductPurchase = useCallback(
    async (productId: string) => {
      const scansToAdd = ScansPerProduct[productId] ?? 0;
      if (__DEV__) {
        console.log(`[SubscriptionContext] creditProductPurchase: ${productId} → ${scansToAdd} scans`);
      }
      if (scansToAdd > 0) {
        addScans(scansToAdd);
      }
      if (effectiveUserId && scansToAdd > 0) {
        try {
          const res = await fetch('/api/credit-scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: effectiveUserId, scans: scansToAdd, product_id: productId }),
          });
          if (res.ok) {
            const json = await res.json();
            if (typeof json.scans === 'number') {
              setScans(json.scans);
              if (__DEV__) {
                console.log(`[SubscriptionContext] Server confirmed ${json.scans} scans after paywall purchase`);
              }
            }
          } else {
            console.warn('[SubscriptionContext] credit-scans failed, falling back to refreshProfile');
            await refreshProfile();
          }
        } catch (err) {
          console.warn('[SubscriptionContext] Failed to persist scan credit:', err);
          await refreshProfile();
        }
      } else if (scansToAdd === 0) {
        // Unknown product — fall back to server fetch to get the real count
        await refreshProfile();
      }
    },
    [addScans, setScans, refreshProfile, effectiveUserId]
  );

  const purchaseStarter = useCallback(
    () => doPurchase(starterPackage, 'Starter pack'),
    [doPurchase, starterPackage]
  );

  const purchasePopular = useCallback(
    () => doPurchase(popularPackage, 'Popular pack'),
    [doPurchase, popularPackage]
  );

  const purchaseTraveller = useCallback(
    () => doPurchase(travellerPackage, 'Traveller pack'),
    [doPurchase, travellerPackage]
  );

  // ── Restore ──
  // For consumable (non-subscription) IAPs, restorePurchases is required by
  // the App Store but typically won't re-grant already-consumed items.

  const doRestore = useCallback(async () => {
    setIsPurchasing(true);
    try {
      await Purchases.restorePurchases();
      Alert.alert(
        'Restore Complete',
        'Your purchase history has been checked.\nConsumed scan packs cannot be re-granted after use.',
      );
    } catch (error: any) {
      Alert.alert('Restore Error', error.message ?? 'Something went wrong.');
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  // ── Refresh ──

  const refreshStatus = useCallback(async () => {
    await Promise.all([loadOfferings(), refreshProfile()]);
  }, [loadOfferings, refreshProfile]);

  // ── Present Paywall (imperative) ──
  // Used when the paywall is shown as a full-screen gate on the scan page.
  // After purchase we credit scans for whichever package was bought.

  const doShowPaywall = useCallback(async (): Promise<boolean> => {
    try {
      const paywallOptions: any = { displayCloseButton: false };
      if (menuPicOffering) {
        paywallOptions.offering = menuPicOffering;
      }

      const result = await RevenueCatUI.presentPaywall(paywallOptions);

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        // We don't know exactly which package was tapped inside the RC paywall UI,
        // so we refresh from the server to get the authoritative scan count.
        await refreshProfile();
        return true;
      }
      return false;
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

  return (
    <SubscriptionContext.Provider
      value={{
        isLoading,
        isPurchasing,
        offerings,
        menuPicOffering,
        starterPackage,
        popularPackage,
        travellerPackage,
        needsPaywall,
        purchaseStarter,
        purchasePopular,
        purchaseTraveller,
        restorePurchases: doRestore,
        refreshStatus,
        presentPaywall: doShowPaywall,
        creditProductPurchase,
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
