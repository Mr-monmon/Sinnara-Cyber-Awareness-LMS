export const ADMIN_HOST_SUBDOMAIN = "ta7kom-core";
const RESERVED_APEX_SUBDOMAINS = new Set(["www"]);
const TENANT_SUBDOMAIN_PATTERN = /^[a-z]+$/;
const IPV4_ADDRESS_PATTERN =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export type HostAccessMode = "apex" | "admin" | "tenant" | "invalid";

const normalizeHostname = (hostname: string) => hostname.trim().toLowerCase();

const getHostnameLabels = (hostname: string) =>
  normalizeHostname(hostname).split(".").filter(Boolean);

const isIpv6Address = (hostname: string) => hostname.includes(":");

const isLocalhostDomain = (hostname: string) => {
  const labels = getHostnameLabels(hostname);
  return labels[labels.length - 1] === "localhost";
};

export const isLocalHostname = (hostname: string) => {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "::1" ||
    IPV4_ADDRESS_PATTERN.test(normalizedHostname) ||
    isIpv6Address(normalizedHostname)
  );
};

export const isValidTenantSubdomain = (subdomain: string) =>
  TENANT_SUBDOMAIN_PATTERN.test(subdomain);

const getSubdomainHostMode = (candidateSubdomain?: string): HostAccessMode => {
  if (!candidateSubdomain || RESERVED_APEX_SUBDOMAINS.has(candidateSubdomain)) {
    return "apex";
  }

  if (candidateSubdomain === ADMIN_HOST_SUBDOMAIN) {
    return "admin";
  }

  return isValidTenantSubdomain(candidateSubdomain) ? "tenant" : "invalid";
};

export const getHostAccessMode = (hostname: string): HostAccessMode => {
  if (isLocalHostname(hostname)) {
    return "apex";
  }

  const labels = getHostnameLabels(hostname);
  const candidateSubdomain = labels[0];

  if (isLocalhostDomain(hostname)) {
    if (labels.length === 1) {
      return "apex";
    }

    return getSubdomainHostMode(candidateSubdomain);
  }

  if (labels.length <= 2) {
    return "apex";
  }

  return getSubdomainHostMode(candidateSubdomain);
};

export const extractTenantSubdomain = (hostname: string) => {
  if (getHostAccessMode(hostname) !== "tenant") {
    return null;
  }

  return getHostnameLabels(hostname)[0] ?? null;
};

export const isProtectedPath = (pathname: string) =>
  pathname === "/dashboard" || pathname.startsWith("/dashboard/");



/**
 * Builds a URL for the apex host
 * @param input - The input URL or string
 * @param pathname - The pathname to append to the URL
 * @returns The built URL
 */

export const buildApexUrl = (input: string | URL, pathname = "/") => {
  const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  const labels = getHostnameLabels(url.hostname);

  if (isLocalhostDomain(url.hostname)) {
    if (labels.length > 1) {
      url.hostname = labels.slice(1).join(".");
    }
  } else if (!isLocalHostname(url.hostname)) {
    if (labels.length > 2) {
      url.hostname = labels.slice(1).join(".");
    }
  }

  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
};

export const buildAdminUrl = (input: string | URL, pathname = "/login") => {
  const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  const labels = getHostnameLabels(url.hostname);

  if (isLocalhostDomain(url.hostname)) {
    const baseLabels = labels.length > 1 ? labels.slice(1) : labels;
    url.hostname = [ADMIN_HOST_SUBDOMAIN, ...baseLabels].join(".");
  } else if (!isLocalHostname(url.hostname)) {
    if (labels.length < 2) {
      return null;
    }

    const baseLabels = labels.length > 2 ? labels.slice(1) : labels;
    url.hostname = [ADMIN_HOST_SUBDOMAIN, ...baseLabels].join(".");
  } else {
    return null;
  }

  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
};

export const buildTenantUrl = (
  input: string | URL,
  subdomain: string,
  pathname = "/dashboard"
) => {
  if (!isValidTenantSubdomain(subdomain)) {
    return null;
  }

  const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  const labels = getHostnameLabels(url.hostname);

  if (isLocalhostDomain(url.hostname)) {
    const baseLabels = labels.length > 1 ? labels.slice(1) : labels;
    url.hostname = [subdomain, ...baseLabels].join(".");
  } else if (!isLocalHostname(url.hostname)) {
    if (labels.length < 2) {
      return null;
    }

    const baseLabels = labels.length > 2 ? labels.slice(1) : labels;
    url.hostname = [subdomain, ...baseLabels].join(".");
  } else {
    return null;
  }

  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
};
