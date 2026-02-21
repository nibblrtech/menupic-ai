import React, { createContext, useContext, useState, type PropsWithChildren } from "react";

interface AuthState {
  /** Stable unique identifier for the user (Apple sub / Google email). Always present when signed in. */
  userId: string | null;
  /** Email address for display purposes. May be null (e.g. Apple Sign-In after first login). */
  email: string | null;
  isSignedIn: boolean;
  signIn: (userId: string, email?: string | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  email: null,
  isSignedIn: false,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const signIn = (newUserId: string, newEmail?: string | null) => {
    setUserId(newUserId);
    setEmail(newEmail ?? null);
  };

  const signOut = () => {
    setUserId(null);
    setEmail(null);
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        email,
        isSignedIn: !!userId,
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
