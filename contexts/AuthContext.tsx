import React, { createContext, useContext, useState, type PropsWithChildren } from "react";
import { getCurrentRevenueCatUserId, resetUser } from "../services/RevenueCatService";

type AuthMode = "signed-out" | "guest";

interface AuthState {
  /** Effective ID used for server-side profile and scan tracking. Always `guest:<rcAnonymousId>`. */
  effectiveUserId: string | null;
  mode: AuthMode;
  isAuthReady: boolean;
  continueAsGuest: () => Promise<void>;
  /** Wipe all guest state — resets RC to a new anonymous user and returns to signed-out. */
  resetGuestState: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  effectiveUserId: null,
  mode: "signed-out",
  isAuthReady: true,
  continueAsGuest: async () => {},
  resetGuestState: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("signed-out");
  const [isAuthReady, setIsAuthReady] = useState(true);

  const continueAsGuest = async () => {
    setIsAuthReady(false);
    try {
      const rcUserId = await getCurrentRevenueCatUserId();
      setMode("guest");
      setEffectiveUserId(`guest:${rcUserId}`);
    } finally {
      setIsAuthReady(true);
    }
  };

  const resetGuestState = async () => {
    await resetUser();
    setEffectiveUserId(null);
    setMode("signed-out");
  };

  return (
    <AuthContext.Provider
      value={{
        effectiveUserId,
        mode,
        isAuthReady,
        continueAsGuest,
        resetGuestState,
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
