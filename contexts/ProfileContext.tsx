import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type PropsWithChildren,
} from 'react';
import { UserProfile } from '../models/UserProfile';
import { useAuth } from './AuthContext';

interface ProfileState {
  /** The cached profile for the currently signed-in user, or `null` if not yet loaded / signed out. */
  profile: UserProfile | null;
  /** True while the profile fetch (or creation) is in flight. */
  isLoading: boolean;
  /** Non-null when the last fetch attempt failed. */
  error: string | null;
  /** Manually re-fetch the profile from the server (e.g. after a scan is consumed). */
  refreshProfile: () => Promise<void>;
  /** Optimistically decrement the scan count by 1 on the client and persist via API. */
  decrementScan: () => void;
  /** Optimistically set the scan count on the client (e.g. after purchase). */
  setScans: (count: number) => void;
  /** Optimistically add `amount` scans to the current count on the client (e.g. after IAP). */
  addScans: (amount: number) => void;
}

const ProfileContext = createContext<ProfileState>({
  profile: null,
  isLoading: false,
  error: null,
  refreshProfile: async () => {},
  decrementScan: () => {},
  setScans: () => {},
  addScans: () => {},
});

export function ProfileProvider({ children }: PropsWithChildren) {
  const { effectiveUserId, isAuthReady } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (uid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/profile?user_id=${encodeURIComponent(uid)}`);
      const json = await response.json();

      if (!response.ok) {
        setError(json.error ?? `Request failed with status ${response.status}`);
        setProfile(null);
      } else {
        setProfile(UserProfile.fromJSON(json.profile));
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch (or create) the profile whenever the effective tracking identity changes.
  useEffect(() => {
    if (!isAuthReady) return;

    if (effectiveUserId) {
      fetchProfile(effectiveUserId);
    } else {
      // No identity selected yet (first launch before Continue as Guest or Sign-In).
      setProfile(null);
      setError(null);
    }
  }, [effectiveUserId, fetchProfile, isAuthReady]);

  const refreshProfile = useCallback(async () => {
    if (effectiveUserId) {
      await fetchProfile(effectiveUserId);
    }
  }, [effectiveUserId, fetchProfile]);

  /**
   * Optimistically set the local scan count.
   * Updates the client UI immediately without waiting for a server round-trip.
   */
  const setScans = useCallback((count: number) => {
    if (__DEV__) console.log(`[ProfileContext] setScans(${count})`);
    setProfile(prev => {
      if (!prev) return prev;
      return new UserProfile(
        prev.userId,
        prev.createdAt,
        prev.updatedAt,
        count,
        prev.subscriptionProductId,
        prev.subscriptionStartedAt,
        prev.lastScanCreditAt,
        prev.subscriptionActive,
      );
    });
  }, []);

  /**
   * Optimistically add `amount` to the current scan count (e.g. after an IAP).
   * Updates the client UI immediately without waiting for a server round-trip.
   */
  const addScans = useCallback((amount: number) => {
    if (__DEV__) console.log(`[ProfileContext] addScans(${amount})`);
    setProfile(prev => {
      if (!prev) return prev;
      return new UserProfile(
        prev.userId,
        prev.createdAt,
        prev.updatedAt,
        prev.scans + amount,
        prev.subscriptionProductId,
        prev.subscriptionStartedAt,
        prev.lastScanCreditAt,
        prev.subscriptionActive,
      );
    });
  }, []);

  /**
   * Optimistically decrement the scan count by 1 on the client, then persist
   * the change via the /api/consume-scan endpoint in the background.
   */
  const decrementScan = useCallback(() => {
    setProfile(prev => {
      if (!prev || prev.scans <= 0) return prev;
      return new UserProfile(
        prev.userId,
        prev.createdAt,
        prev.updatedAt,
        prev.scans - 1,
        prev.subscriptionProductId,
        prev.subscriptionStartedAt,
        prev.lastScanCreditAt,
        prev.subscriptionActive,
      );
    });

    // Fire-and-forget: persist the decrement on the server
    if (effectiveUserId) {
      fetch('/api/consume-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveUserId }),
      }).catch(err => {
        console.warn('[ProfileContext] Failed to persist scan decrement:', err);
      });
    }
  }, [effectiveUserId]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, refreshProfile, decrementScan, setScans, addScans }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileState {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
