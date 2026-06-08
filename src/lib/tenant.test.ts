import { describe, it, expect } from "vitest";
import {
  isValidTenantSubdomain,
  getHostAccessMode,
  extractTenantSubdomain,
  ADMIN_HOST_SUBDOMAIN,
} from "./tenant";

describe("isValidTenantSubdomain", () => {
  it("accepts lowercase alphanumeric subdomains", () => {
    expect(isValidTenantSubdomain("acme")).toBe(true);
    expect(isValidTenantSubdomain("acme123")).toBe(true);
    expect(isValidTenantSubdomain("a")).toBe(true);
  });

  it("accepts internal hyphens", () => {
    expect(isValidTenantSubdomain("acme-corp")).toBe(true);
    expect(isValidTenantSubdomain("big-blue-co")).toBe(true);
  });

  it("rejects leading or trailing hyphens", () => {
    expect(isValidTenantSubdomain("-acme")).toBe(false);
    expect(isValidTenantSubdomain("acme-")).toBe(false);
    expect(isValidTenantSubdomain("-")).toBe(false);
  });

  it("rejects uppercase, spaces and special characters", () => {
    expect(isValidTenantSubdomain("Acme")).toBe(false);
    expect(isValidTenantSubdomain("ac me")).toBe(false);
    expect(isValidTenantSubdomain("acme.corp")).toBe(false);
    expect(isValidTenantSubdomain("acme_corp")).toBe(false);
    expect(isValidTenantSubdomain("")).toBe(false);
  });

  it("rejects reserved system names", () => {
    for (const reserved of [
      "app", "admin", "api", "www", "mail",
      "support", "platform", "dashboard", "login",
      ADMIN_HOST_SUBDOMAIN,
    ]) {
      expect(isValidTenantSubdomain(reserved)).toBe(false);
    }
  });
});

describe("getHostAccessMode", () => {
  it("treats apex and www as apex", () => {
    expect(getHostAccessMode("example.com")).toBe("apex");
    expect(getHostAccessMode("www.example.com")).toBe("apex");
  });

  it("routes the admin host to admin mode", () => {
    expect(getHostAccessMode(`${ADMIN_HOST_SUBDOMAIN}.example.com`)).toBe("admin");
  });

  it("routes a valid tenant subdomain to tenant mode", () => {
    expect(getHostAccessMode("acme.example.com")).toBe("tenant");
    expect(getHostAccessMode("acme-corp.example.com")).toBe("tenant");
  });

  it("rejects reserved subdomains as invalid", () => {
    expect(getHostAccessMode("support.example.com")).toBe("invalid");
    expect(getHostAccessMode("api.example.com")).toBe("invalid");
  });

  it("treats localhost as apex", () => {
    expect(getHostAccessMode("localhost")).toBe("apex");
    expect(getHostAccessMode("127.0.0.1")).toBe("apex");
  });
});

describe("extractTenantSubdomain", () => {
  it("returns the subdomain for a valid tenant host", () => {
    expect(extractTenantSubdomain("acme.example.com")).toBe("acme");
  });

  it("returns null for apex, admin and reserved hosts", () => {
    expect(extractTenantSubdomain("example.com")).toBeNull();
    expect(extractTenantSubdomain("www.example.com")).toBeNull();
    expect(extractTenantSubdomain(`${ADMIN_HOST_SUBDOMAIN}.example.com`)).toBeNull();
    expect(extractTenantSubdomain("support.example.com")).toBeNull();
  });
});
