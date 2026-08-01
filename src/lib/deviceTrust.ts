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
import { captureException } from './sentry';

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
  } catch (err) {
    // Private mode / blocked storage. Not an error worth alerting on, but it
    // explains why a user is challenged on every single login.
    console.warn('[deviceTrust] device id storage unavailable; 2FA will be asked every login:', err);
    return null;
  }
}

/** Whether this browser may skip the TOTP challenge for the current session's user. */
export async function isDeviceTrusted(): Promise<boolean> {
  const deviceId = getDeviceId();
  if (!deviceId) return false;
  try {
    const { data, error } = await supabase.rpc('is_mfa_device_trusted', { p_device_id: deviceId });
    if (error) {
      // Failing closed here only costs an extra challenge, but a persistent
      // failure (missing migration, revoked grant) would silently make the
      // 15-day window never apply, so it must be visible.
      console.error('[deviceTrust] is_mfa_device_trusted failed:', error.message, error);
      captureException(error, { scope: 'deviceTrust.isDeviceTrusted' });
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('[deviceTrust] is_mfa_device_trusted threw:', err);
    captureException(err, { scope: 'deviceTrust.isDeviceTrusted' });
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
    const { error } = await supabase.rpc('trust_mfa_device', {
      p_device_id: deviceId,
      p_user_agent: navigator.userAgent.slice(0, 400),
    });
    if (error) {
      // The login itself already succeeded, so this is not fatal — but if it
      // keeps failing every login re-challenges, which users report as a bug.
      console.error('[deviceTrust] trust_mfa_device failed:', error.message, error);
      captureException(error, { scope: 'deviceTrust.trustThisDevice' });
    }
  } catch (err) {
    console.error('[deviceTrust] trust_mfa_device threw:', err);
    captureException(err, { scope: 'deviceTrust.trustThisDevice' });
  }
}

/** Forget every remembered browser for the current user (e.g. after re-enrolling 2FA). */
export async function revokeTrustedDevices(): Promise<void> {
  try {
    const { error } = await supabase.rpc('revoke_mfa_trusted_devices');
    if (error) {
      // A failure here leaves stale trust in place after a factor change, which
      // is a security-relevant regression rather than a cosmetic one.
      console.error('[deviceTrust] revoke_mfa_trusted_devices failed:', error.message, error);
      captureException(error, { scope: 'deviceTrust.revokeTrustedDevices' });
    }
  } catch (err) {
    console.error('[deviceTrust] revoke_mfa_trusted_devices threw:', err);
    captureException(err, { scope: 'deviceTrust.revokeTrustedDevices' });
  }
}
