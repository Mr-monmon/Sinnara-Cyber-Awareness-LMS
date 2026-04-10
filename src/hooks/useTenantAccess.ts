import { useEffect, useState } from "react";

import type { Company } from "../lib/types";
import { fetchTenantCompanyBySubdomain } from "../lib/tenantAccess";
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
  const [state, setState] = useState<TenantAccessState>(INITIAL_STATE);

  useEffect(() => {
    let isCancelled = false;

    const resolveTenant = async () => {
      const currentUrl = new URL(window.location.href);
      const hostMode = getHostAccessMode(currentUrl.hostname);
      const tenantSubdomain = extractTenantSubdomain(currentUrl.hostname);

      if (hostMode === "invalid" || hostMode === "admin") {
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

      const company = await fetchTenantCompanyBySubdomain(tenantSubdomain);

      if (isCancelled) {
        return;
      }

      setState({
        company,
        hostMode,
        loading: false,
        tenantSubdomain,
      });
    };

    void resolveTenant();

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
};
