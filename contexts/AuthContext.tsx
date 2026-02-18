import React, { createContext, useContext, useState, type PropsWithChildren } from "react";

interface AuthState {
  email: string | null;
  isSignedIn: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  email: null,
  isSignedIn: false,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [email, setEmail] = useState<string | null>(null);

  const signIn = (userEmail: string) => {
    setEmail(userEmail);
  };

  const signOut = () => {
    setEmail(null);
  };

  return (
    <AuthContext.Provider
      value={{
        email,
        isSignedIn: !!email,
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
