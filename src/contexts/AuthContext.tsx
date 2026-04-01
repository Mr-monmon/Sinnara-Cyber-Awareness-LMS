import React, { createContext, useContext, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { User } from "../lib/types";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<User | null> {
  try {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncUserFromSession = async (session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        return;
      }

      const profile = await fetchProfile(session.user.id);
      setUser(profile);
    };

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await syncUserFromSession(session);
      } catch {
        // Session restore failed — continue as logged out
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error("Invalid email or password");
    }
    window.location.href = "/dashboard";
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
