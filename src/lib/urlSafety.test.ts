import { describe, it, expect } from "vitest";
import {
  parseHttpUrl,
  isPrivateOrReservedIp,
  isBlockedHostname,
  isAllowedRedirect,
} from "./urlSafety";

describe("parseHttpUrl", () => {
  it("accepts http and https", () => {
    expect(parseHttpUrl("http://example.com")?.hostname).toBe("example.com");
    expect(parseHttpUrl("https://example.com/a?b=1")?.hostname).toBe("example.com");
  });
  it("rejects non-http schemes", () => {
    expect(parseHttpUrl("ftp://example.com")).toBeNull();
    expect(parseHttpUrl("file:///etc/passwd")).toBeNull();
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("gopher://x")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(parseHttpUrl("not a url")).toBeNull();
    expect(parseHttpUrl("")).toBeNull();
  });
});

describe("isPrivateOrReservedIp", () => {
  it("blocks IPv4 loopback / private / link-local", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.1.2.3")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true); // cloud metadata
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.1.1")).toBe(true); // CGNAT
  });
  it("allows public IPv4", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("172.32.0.1")).toBe(false); // just outside /12
    expect(isPrivateOrReservedIp("172.15.0.1")).toBe(false);
  });
  it("blocks IPv6 loopback / ULA / link-local and mapped IPv4", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd00::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
  });
  it("blocks malformed IPv4 octets", () => {
    expect(isPrivateOrReservedIp("999.1.1.1")).toBe(true);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost and internal suffixes", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("foo.localhost")).toBe(true);
    expect(isBlockedHostname("db.internal")).toBe(true);
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedHostname("metadata")).toBe(true);
  });
  it("blocks raw private IP hostnames", () => {
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
    expect(isBlockedHostname("192.168.0.5")).toBe(true);
    expect(isBlockedHostname("169.254.169.254")).toBe(true);
  });
  it("allows normal public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("www.google.com")).toBe(false);
    expect(isBlockedHostname("sub.domain.co.uk")).toBe(false);
  });
  it("blocks empty host", () => {
    expect(isBlockedHostname("")).toBe(true);
  });
});

describe("isAllowedRedirect", () => {
  const allow = ["https://abc.supabase.co", "https://acme.com"];
  it("allows targets whose origin is in the allowlist", () => {
    expect(isAllowedRedirect("https://abc.supabase.co/functions/v1/serve-landing-page?lp=1", allow)).toBe(true);
    expect(isAllowedRedirect("https://acme.com/login", allow)).toBe(true);
  });
  it("rejects targets outside the allowlist", () => {
    expect(isAllowedRedirect("https://evil.example/login", allow)).toBe(false);
  });
  it("rejects internal/private targets even if scheme is http(s)", () => {
    expect(isAllowedRedirect("http://127.0.0.1/", ["http://127.0.0.1"])).toBe(false);
    expect(isAllowedRedirect("http://169.254.169.254/latest/meta-data", allow)).toBe(false);
  });
  it("rejects non-http schemes", () => {
    expect(isAllowedRedirect("javascript:alert(1)", allow)).toBe(false);
  });
});
