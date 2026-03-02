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
}

const ProfileContext = createContext<ProfileState>({
  profile: null,
  isLoading: false,
  error: null,
  refreshProfile: async () => {},
});

export function ProfileProvider({ children }: PropsWithChildren) {
  const { userId } = useAuth();

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
    if (userId) {
      await fetchProfile(userId);
    }
  }, [userId, fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, refreshProfile }}>
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
