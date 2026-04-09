import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import type { Company } from "../lib/types";
import { supabase } from "../lib/supabase";
import {
  extractTenantSubdomain,
  getHostAccessMode,
  type HostAccessMode,
} from "../lib/tenant";

interface TenantAccessState {
  company: Company | null;
  hostMode: HostAccessMode;
  loading: boolean;
  tenantSubdomain: string | null;
}

const INITIAL_STATE: TenantAccessState = {
  company: null,
  hostMode: "apex",
  loading: true,
  tenantSubdomain: null,
};

export const useTenantAccess = () => {
  const location = useLocation();
  const [state, setState] = useState<TenantAccessState>(INITIAL_STATE);

  useEffect(() => {
    let isCancelled = false;

    const resolveTenant = async () => {
      const currentUrl = new URL(window.location.href);
      const hostMode = getHostAccessMode(currentUrl.hostname);
      const tenantSubdomain = extractTenantSubdomain(currentUrl.hostname);

      if (hostMode === "invalid") {
        setState({
          company: null,
          hostMode,
          loading: false,
          tenantSubdomain: null,
        });
        return;
      }

      if (hostMode === "apex" || !tenantSubdomain) {
        setState({
          company: null,
          hostMode: "apex",
          loading: false,
          tenantSubdomain: null,
        });
        return;
      }

      setState({
        company: null,
        hostMode,
        loading: true,
        tenantSubdomain,
      });

      console.log("Fetching company data");
      console.log("tenantSubdomain", tenantSubdomain);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("subdomain", tenantSubdomain)
        .maybeSingle();

      console.log("Company data", data);

      if (isCancelled) {
        return;
      }

      setState({
        company: error ? null : data ?? null,
        hostMode,
        loading: false,
        tenantSubdomain,
      });
    };

    void resolveTenant();

    return () => {
      isCancelled = true;
    };
  }, [location.pathname, location.search]);

  return state;
};
