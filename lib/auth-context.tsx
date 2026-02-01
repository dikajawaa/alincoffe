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
import { useRouter } from "next/navigation";
import { initConsoleBranding } from "./console-branding";

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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Initialize Console Branding
  useEffect(() => {
    initConsoleBranding();
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Profile fetch timeout")), 5000),
    );

    try {
      const fetchPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      const { data, error } = (await Promise.race([
        fetchPromise,
        timeoutPromise,
      ])) as any;

      if (error) {
        if (error.code === "PGRST116") {
        } else {
        }
        setProfile(null);
        return;
      }

      setProfile(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setProfile(null);
    } finally {
    }
  }, []);

  useEffect(() => {
    const channels = supabase.getChannels();
    channels.forEach((channel) => {
      if (channel.topic.includes("auth")) {
        supabase.removeChannel(channel);
      }
    });

    let mounted = true;
    let processingEvent = false;

    const initializeAuth = async () => {
      processingEvent = true;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (session?.user) {
          setUser(session.user);

          try {
            await fetchProfile(session.user.id);
          } catch (error) {
            setProfile(null);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
      } finally {
        if (mounted) {
          setInitialized(true);
          setLoading(false);
          processingEvent = false;
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) {
        return;
      }

      if (processingEvent) {
        return;
      }

      processingEvent = true;

      try {
        if (event === "INITIAL_SESSION" && initialized) {
          return;
        }

        switch (event) {
          case "INITIAL_SESSION":
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
          case "USER_UPDATED":
            if (session?.user) {
              setUser(session.user);

              try {
                await fetchProfile(session.user.id);
              } catch (error) {
                setProfile(null);
              }
            } else {
              setUser(null);
              setProfile(null);
            }

            setLoading(false);
            setInitialized(true);
            break;

          case "SIGNED_OUT":
            setUser(null);
            setProfile(null);
            setLoading(false);
            router.push("/login"); // Redirect ke login saat logout
            break;

          case "PASSWORD_RECOVERY":
            setLoading(false);
            break;

          default:
        }
      } finally {
        processingEvent = false;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, router, initialized]);

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
    } catch (error) {
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
    } catch (error) {}
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
