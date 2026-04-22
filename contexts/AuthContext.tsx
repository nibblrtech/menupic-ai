import React, { createContext, useContext, useState, type PropsWithChildren } from "react";
import { getCurrentRevenueCatUserId, resetUser } from "../services/RevenueCatService";

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
  signIn: (userId: string, email?: string | null) => void;
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
  signIn: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("signed-out");
  const [isAuthReady, setIsAuthReady] = useState(true);

  const continueAsGuest = async () => {
    setIsAuthReady(false);
    try {
      const rcUserId = await getCurrentRevenueCatUserId();
      setUserId(null);
      setEmail(null);
      setMode("guest");
      setEffectiveUserId(`guest:${rcUserId}`);
    } finally {
      setIsAuthReady(true);
    }
  };

  const signIn = (newUserId: string, newEmail?: string | null) => {
    setUserId(newUserId);
    setEmail(newEmail ?? null);
    setMode("signed-in");
    setEffectiveUserId(newUserId);
  };

  const signOut = async () => {
    setIsAuthReady(false);
    try {
      await resetUser();
      const rcUserId = await getCurrentRevenueCatUserId();
      setUserId(null);
      setEmail(null);
      setMode("guest");
      setEffectiveUserId(`guest:${rcUserId}`);
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
