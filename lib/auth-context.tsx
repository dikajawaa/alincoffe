"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: "customer" | "admin";
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: "google" | "apple") => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          console.log("No profile found for user, will create on first edit");
        } else {
          console.error("Error fetching profile:", error);
        }
        setProfile(null);
        return;
      }
      setProfile(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching profile:", errorMessage, error);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ✅ Single source of truth untuk auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log(`[Auth] Event: ${event}`);

      switch (event) {
        case "INITIAL_SESSION":
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
          break;

        case "SIGNED_OUT":
          setUser(null);
          setProfile(null);
          setLoading(false);
          break;

        case "PASSWORD_RECOVERY":
          // User mengakses link reset password
          setLoading(false);
          break;

        default:
          // Log event yang tidak di-handle untuk monitoring
          console.warn(`[Auth] Unhandled event: ${event}`);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const handleAuthError = (error: any): Error => {
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes("504") || errorMsg.includes("Gateway Timeout")) {
      return new Error(
        "Server sedang sibuk. Silakan coba lagi dalam beberapa saat.",
      );
    }

    if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
      return new Error(
        "Koneksi terputus. Periksa internet Anda dan coba lagi.",
      );
    }

    if (
      errorMsg.includes("NetworkError") ||
      errorMsg.includes("Failed to fetch")
    ) {
      return new Error(
        "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
      );
    }

    if (errorMsg.includes("503") || errorMsg.includes("Service Unavailable")) {
      return new Error("Layanan sedang maintenance. Coba beberapa saat lagi.");
    }

    if (errorMsg.includes("502") || errorMsg.includes("Bad Gateway")) {
      return new Error("Terjadi masalah pada server. Coba lagi nanti.");
    }

    return error;
  };

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw handleAuthError(error);

      // ✅ onAuthStateChange akan handle state update
    } catch (error) {
      // ✅ Set loading false hanya jika ada error
      setLoading(false);
      throw handleAuthError(error);
    }
  }, []);

  const signInWithProvider = useCallback(
    async (provider: "google" | "apple") => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });
        if (error) throw handleAuthError(error);
      } catch (error) {
        throw handleAuthError(error);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) throw handleAuthError(error);
      } catch (error) {
        throw handleAuthError(error);
      }
    },
    [],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/login/reset-password`,
      });
      if (error) throw handleAuthError(error);
    } catch (error) {
      throw handleAuthError(error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      // ✅ onAuthStateChange akan handle state update via SIGNED_OUT event
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signInWithProvider,
      signUp,
      sendPasswordReset,
      signOut,
      refreshProfile,
    }),
    [
      user,
      profile,
      loading,
      signIn,
      signInWithProvider,
      signUp,
      sendPasswordReset,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
