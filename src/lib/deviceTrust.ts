/**
 * deviceTrust — "remember this browser for 15 days" for the 2FA challenge.
 *
 * Two-factor is mandatory for employees, but asking for a TOTP code on every
 * login is heavy for daily training use. Instead a browser that passes a
 * challenge is remembered server-side for a fixed window (see the
 * `mfa_device_trust_window` SQL function, currently 15 days); logins from that
 * browser inside the window skip the challenge, and the first login from any
 * new browser always requires it.
 *
 * The identifier below is a random opaque value, not a fingerprint — it says
 * nothing about the device and cannot be correlated across users. The server is
 * the authority: it stores the value against `auth.uid()` and decides whether it
 * is still valid, so clearing localStorage or forging an id only ever costs the
 * user an extra challenge, never grants one.
 */

import { supabase } from './supabase';

const DEVICE_ID_KEY = 'aw.mfa.device_id';

function randomDeviceId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The stable random id for this browser, minted on first use.
 *
 * Returns null when storage is unavailable (private mode, blocked cookies). A
 * null id simply means this browser can never be remembered, so every login
 * gets challenged — the safe direction to fail in.
 */
export function getDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    // Re-mint anything that doesn't satisfy the server's length constraint.
    if (existing && existing.length >= 16 && existing.length <= 128) return existing;
    const fresh = randomDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Whether this browser may skip the TOTP challenge for the current session's user. */
export async function isDeviceTrusted(): Promise<boolean> {
  const deviceId = getDeviceId();
  if (!deviceId) return false;
  try {
    const { data, error } = await supabase.rpc('is_mfa_device_trusted', { p_device_id: deviceId });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Record that this browser just passed a TOTP challenge (or completed setup,
 * which also proves possession of the factor). Never throws: failing to
 * remember a device is a convenience regression, not a login failure.
 */
export async function trustThisDevice(): Promise<void> {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  try {
    await supabase.rpc('trust_mfa_device', {
      p_device_id: deviceId,
      p_user_agent: navigator.userAgent.slice(0, 400),
    });
  } catch {
    /* best-effort */
  }
}

/** Forget every remembered browser for the current user (e.g. after re-enrolling 2FA). */
export async function revokeTrustedDevices(): Promise<void> {
  try {
    await supabase.rpc('revoke_mfa_trusted_devices');
  } catch {
    /* best-effort */
  }
}
