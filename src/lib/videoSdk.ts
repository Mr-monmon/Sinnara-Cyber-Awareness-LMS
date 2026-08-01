/**
 * videoSdk — one-time loaders for the provider player SDKs used by VideoPlayer.
 *
 * The employee course player hides every native control and drives playback
 * itself (see VideoPlayer), which requires a scriptable player rather than a
 * plain iframe. Each loader injects its <script> at most once per page and
 * resolves once the SDK global is usable, so multiple video sections on the
 * same course don't race or double-load.
 *
 * Both loaders must always settle. A blocked CDN — an ad-blocker or a corporate
 * proxy, which is a likely failure for this product's audience — has to end in a
 * rejection so the player can show its error state. Two things guarantee that:
 * a failed <script> is removed from the DOM so a retry injects a fresh one (a
 * dead tag never fires `load`/`error` again, so reusing it would leave the
 * caller waiting forever behind a spinner), and every attempt is bounded by a
 * timeout for the case where the request neither loads nor errors but hangs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { captureException } from './sentry';

const YT_API_SRC = 'https://www.youtube.com/iframe_api';
const CF_SDK_SRC = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';

/** A blocked request usually fails fast; this only catches a silent hang. */
const LOAD_TIMEOUT_MS = 20000;

let ytPromise: Promise<any> | null = null;
let cfPromise: Promise<any> | null = null;

/**
 * Inject a script tag, reusing one only if it is still pending or succeeded.
 * A tag whose `error` already fired is discarded: its events will never fire
 * again, so reusing it is exactly what would make a retry hang.
 */
function injectScript(src: string): HTMLScriptElement {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    if (existing.dataset.awFailed !== 'true') return existing;
    existing.remove();
  }
  const tag = document.createElement('script');
  tag.src = src;
  tag.async = true;
  document.head.appendChild(tag);
  return tag;
}

function markFailed(tag: HTMLScriptElement): void {
  tag.dataset.awFailed = 'true';
  tag.remove();
}

/**
 * Load the YouTube IFrame Player API and resolve with the `YT` namespace.
 *
 * The API signals readiness through the single global `onYouTubeIframeAPIReady`
 * callback, so it is chained rather than overwritten in case anything else on
 * the page already registered one.
 */
export function loadYouTubeApi(): Promise<any> {
  if (ytPromise) return ytPromise;

  ytPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.YT && w.YT.Player) {
      resolve(w.YT);
      return;
    }

    let settled = false;
    // Held in an object so the closures below can clear a timeout that is
    // created after they are defined.
    const timeout: { id?: number } = {};

    const succeed = (yt: any) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout.id);
      resolve(yt);
    };

    const fail = (message: string, cause?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout.id);
      const err = new Error(message);
      console.error('[videoSdk]', message, cause ?? '');
      captureException(err, { scope: 'videoSdk.loadYouTubeApi', src: YT_API_SRC });
      // Clear the cached promise so a later attempt starts from scratch rather
      // than re-awaiting one that already rejected.
      ytPromise = null;
      markFailed(tag);
      reject(err);
    };

    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') {
        try {
          previous();
        } catch (err) {
          // A foreign handler must not break ours, but swallowing it silently
          // would hide a genuine conflict with another embed on the page.
          console.warn('[videoSdk] a pre-existing onYouTubeIframeAPIReady handler threw:', err);
        }
      }
      succeed(w.YT);
    };

    const tag = injectScript(YT_API_SRC);
    tag.addEventListener('error', (event) =>
      fail(`Failed to load the YouTube IFrame API from ${YT_API_SRC}`, event),
    );
    timeout.id = window.setTimeout(
      () => fail(`Timed out loading the YouTube IFrame API from ${YT_API_SRC}`),
      LOAD_TIMEOUT_MS,
    );
  });

  return ytPromise;
}

/** Load the Cloudflare Stream player SDK and resolve with the `Stream` factory. */
export function loadCloudflareStreamSdk(): Promise<any> {
  if (cfPromise) return cfPromise;

  cfPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.Stream) {
      resolve(w.Stream);
      return;
    }

    let settled = false;
    // Held in an object so the closures below can clear a timeout that is
    // created after they are defined.
    const timeout: { id?: number } = {};

    const succeed = (stream: any) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout.id);
      resolve(stream);
    };

    const fail = (message: string, cause?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout.id);
      const err = new Error(message);
      console.error('[videoSdk]', message, cause ?? '');
      captureException(err, { scope: 'videoSdk.loadCloudflareStreamSdk', src: CF_SDK_SRC });
      cfPromise = null;
      markFailed(tag);
      reject(err);
    };

    const tag = injectScript(CF_SDK_SRC);
    tag.addEventListener('load', () => {
      if (w.Stream) succeed(w.Stream);
      else fail('Cloudflare Stream SDK loaded without a Stream global');
    });
    tag.addEventListener('error', (event) =>
      fail(`Failed to load the Cloudflare Stream SDK from ${CF_SDK_SRC}`, event),
    );
    timeout.id = window.setTimeout(
      () => fail(`Timed out loading the Cloudflare Stream SDK from ${CF_SDK_SRC}`),
      LOAD_TIMEOUT_MS,
    );
  });

  return cfPromise;
}
