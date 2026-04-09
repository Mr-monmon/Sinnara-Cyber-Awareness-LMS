import { buildApexUrl, buildTenantUrl } from "./tenant";

const getConfiguredLoginOrigin = () => {
  const configuredLoginUrl = import.meta.env.VITE_SITE_URL_LOGIN?.trim();

  if (!configuredLoginUrl) {
    return null;
  }

  try {
    return new URL(configuredLoginUrl).origin;
  } catch {
    return null;
  }
};

export const buildApexRedirectUrl = (currentUrl: string, pathname = "/") => {
  const configuredOrigin = getConfiguredLoginOrigin();

  if (configuredOrigin) {
    return new URL(pathname, `${configuredOrigin}/`).toString();
  }

  return buildApexUrl(currentUrl, pathname);
};

export const buildTenantRedirectUrl = (
  currentUrl: string,
  subdomain: string,
  pathname = "/dashboard"
) => {
  const configuredOrigin = getConfiguredLoginOrigin();
  const baseUrl = configuredOrigin ?? currentUrl;

  return buildTenantUrl(baseUrl, subdomain, pathname);
};
