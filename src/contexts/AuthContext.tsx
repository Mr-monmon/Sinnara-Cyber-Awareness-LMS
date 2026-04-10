import React, { createContext, useContext, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import type { User } from "../lib/types";
import { supabase } from "../lib/supabase";
import { fetchTenantCompanyBySubdomain } from "../lib/tenantAccess";
import { extractTenantSubdomain, getHostAccessMode } from "../lib/tenant";

export type LoginResult = "success" | "invalid_credentials" | "wrong_tenant";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
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

  const login = async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return "invalid_credentials";
    }

    const profile = data.user ? await fetchProfile(data.user.id) : null;

    const currentUrl = new URL(window.location.href);
    const hostMode = getHostAccessMode(currentUrl.hostname);
    const tenantSubdomain = extractTenantSubdomain(currentUrl.hostname);

    if (hostMode === "tenant" && tenantSubdomain) {
      const company = await fetchTenantCompanyBySubdomain(tenantSubdomain);

      if (!company || profile?.company_id !== company.id) {
        await supabase.auth.signOut();
        setUser(null);
        return "wrong_tenant";
      }
    }

    setUser(profile);
    return "success";
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
