import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
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
}

const ProfileContext = createContext<ProfileState>({
  profile: null,
  isLoading: false,
  error: null,
  refreshProfile: async () => {},
  decrementScan: () => {},
  setScans: () => {},
});

export function ProfileProvider({ children }: PropsWithChildren) {
  const { userId } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When true, refreshProfile() becomes a no-op. This prevents any server
  // fetch from overwriting the optimistic 30 scans granted after purchase.
  // Cleared on the first decrementScan() (i.e. user actually scans a dish).
  const justSubscribedRef = useRef(false);

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

  // Fetch (or create) the profile whenever the signed-in user changes.
  useEffect(() => {
    if (userId) {
      fetchProfile(userId);
    } else {
      // User signed out — clear the cached profile.
      setProfile(null);
      setError(null);
    }
  }, [userId, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (justSubscribedRef.current) {
      // Skip server fetch — the user just subscribed and we don't want
      // a stale server response (webhook not yet processed) to overwrite
      // the optimistic 30 scans.
      if (__DEV__) console.log('[ProfileContext] refreshProfile skipped — justSubscribed is true');
      return;
    }
    if (userId) {
      await fetchProfile(userId);
    }
  }, [userId, fetchProfile]);

  /**
   * Optimistically set the local scan count (e.g. after a purchase grants 30 scans).
   * This updates the client UI immediately without waiting for a server round-trip.
   * Also sets the justSubscribed guard so refreshProfile won't overwrite this value.
   */
  const setScans = useCallback((count: number) => {
    justSubscribedRef.current = true;
    if (__DEV__) console.log(`[ProfileContext] setScans(${count}) — justSubscribed guard ON`);
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
   * Optimistically decrement the scan count by 1 on the client, then persist
   * the change via the /api/consume-scan endpoint in the background.
   */
  const decrementScan = useCallback(() => {
    // The user is actively scanning — clear the guard so future
    // refreshProfile calls work normally (e.g. zero-scans verification).
    if (justSubscribedRef.current) {
      justSubscribedRef.current = false;
      if (__DEV__) console.log('[ProfileContext] decrementScan — justSubscribed guard OFF');
    }
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
    if (userId) {
      fetch('/api/consume-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      }).catch(err => {
        console.warn('[ProfileContext] Failed to persist scan decrement:', err);
      });
    }
  }, [userId]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, refreshProfile, decrementScan, setScans }}>
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
