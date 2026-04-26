import React, { createContext, useContext, useState, type PropsWithChildren } from "react";
import { getCurrentRevenueCatUserId, identifyUser, resetUser } from "../services/RevenueCatService";

type AuthMode = "signed-out" | "guest" | "signed-in";

interface AuthState {
  /** Stable unique identifier for the user (Apple sub / Google email). Always present when signed in. */
  userId: string | null;
  /** Email address for display purposes. May be null (e.g. Apple Sign-In after first login). */
  email: string | null;
  /** Effective ID used for server-side profile and scan tracking. */
  effectiveUserId: string | null;
  mode: AuthMode;
  isAuthReady: boolean;
  isSignedIn: boolean;
  continueAsGuest: () => Promise<void>;
  signIn: (userId: string, email?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  email: null,
  effectiveUserId: null,
  mode: "signed-out",
  isAuthReady: true,
  isSignedIn: false,
  continueAsGuest: async () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [guestRCUserId, setGuestRCUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("signed-out");
  const [isAuthReady, setIsAuthReady] = useState(true);

  const continueAsGuest = async () => {
    setIsAuthReady(false);
    try {
      let rcUserId: string;
      if (guestRCUserId) {
        // Restore the known guest RC session before reading the ID, in case
        // a sign-in changed the RC user since we last stored it.
        await identifyUser(guestRCUserId);
        rcUserId = guestRCUserId;
      } else {
        rcUserId = await getCurrentRevenueCatUserId();
        // Store the guest RevenueCat user ID so we can restore it later when signing out.
        setGuestRCUserId(rcUserId);
      }
      setUserId(null);
      setEmail(null);
      setMode("guest");
      setEffectiveUserId(`guest:${rcUserId}`);
    } finally {
      setIsAuthReady(true);
    }
  };

  const signIn = async (newUserId: string, newEmail?: string | null) => {
    try {
      await identifyUser(newUserId);
    } catch (err) {
      console.warn('[AuthContext] Failed to identify user with RevenueCat:', err);
    }
    setUserId(newUserId);
    setEmail(newEmail ?? null);
    setMode("signed-in");
    setEffectiveUserId(newUserId);
  };

  const signOut = async () => {
    setIsAuthReady(false);
    try {
      if (guestRCUserId) {
        // Restore the original guest RC session so the next continueAsGuest()
        // call picks up the correct identity (and RC persists it across restarts).
        await identifyUser(guestRCUserId);
      } else {
        // No known guest session — reset to a fresh anonymous RC user so that
        // RC does not stay logged in as the signed-in user's account.
        await resetUser();
      }
      setUserId(null);
      setEmail(null);
      // Use "signed-out" (not "guest") so that migrateGuestProfileIfNeeded
      // is NOT triggered if another user signs in from the home screen
      // before the original guest resumes their session.
      setMode("signed-out");
      setEffectiveUserId(null);
    } finally {
      setIsAuthReady(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        email,
        effectiveUserId,
        mode,
        isAuthReady,
        isSignedIn: !!userId,
        continueAsGuest,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
