import { buildAdminUrl, buildApexUrl, buildTenantUrl } from "./tenant";

export const buildSameHostRedirectUrl = (currentUrl: string, pathname: string) =>
  new URL(pathname, currentUrl).toString();

export const buildApexRedirectUrl = (currentUrl: string, pathname = "/") =>
  buildApexUrl(currentUrl, pathname);

export const buildAdminRedirectUrl = (currentUrl: string, pathname = "/login") =>
  buildAdminUrl(currentUrl, pathname);

export const buildTenantRedirectUrl = (
  currentUrl: string,
  subdomain: string,
  pathname = "/dashboard"
) => {
  return buildTenantUrl(currentUrl, subdomain, pathname);
};
