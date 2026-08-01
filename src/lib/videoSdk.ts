/**
 * videoSdk — one-time loaders for the provider player SDKs used by VideoPlayer.
 *
 * The employee course player hides every native control and drives playback
 * itself (see VideoPlayer), which requires a scriptable player rather than a
 * plain iframe. Each loader injects its <script> at most once per page and
 * resolves once the SDK global is usable, so multiple video sections on the
 * same course don't race or double-load.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { captureException } from './sentry';

const YT_API_SRC = 'https://www.youtube.com/iframe_api';
const CF_SDK_SRC = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';

let ytPromise: Promise<any> | null = null;
let cfPromise: Promise<any> | null = null;

function injectScript(src: string): HTMLScriptElement {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) return existing;
  const tag = document.createElement('script');
  tag.src = src;
  tag.async = true;
  document.head.appendChild(tag);
  return tag;
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

    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') {
        try { previous(); } catch (err) {
          // A foreign handler must not break ours, but swallowing it silently
          // would hide a genuine conflict with another embed on the page.
          console.warn('[videoSdk] a pre-existing onYouTubeIframeAPIReady handler threw:', err);
        }
      }
      resolve(w.YT);
    };

    const tag = injectScript(YT_API_SRC);
    tag.addEventListener('error', (event) => {
      // Usually an ad-blocker, a corporate proxy or an offline client. The
      // player shows its own message; this is what tells us which it was.
      const err = new Error(`Failed to load the YouTube IFrame API from ${YT_API_SRC}`);
      console.error('[videoSdk]', err.message, event);
      captureException(err, { scope: 'videoSdk.loadYouTubeApi', src: YT_API_SRC });
      ytPromise = null;
      reject(err);
    });
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

    const tag = injectScript(CF_SDK_SRC);
    tag.addEventListener('load', () => {
      if (w.Stream) resolve(w.Stream);
      else {
        const err = new Error('Cloudflare Stream SDK loaded without a Stream global');
        console.error('[videoSdk]', err.message);
        captureException(err, { scope: 'videoSdk.loadCloudflareStreamSdk', src: CF_SDK_SRC });
        cfPromise = null;
        reject(err);
      }
    });
    tag.addEventListener('error', (event) => {
      const err = new Error(`Failed to load the Cloudflare Stream SDK from ${CF_SDK_SRC}`);
      console.error('[videoSdk]', err.message, event);
      captureException(err, { scope: 'videoSdk.loadCloudflareStreamSdk', src: CF_SDK_SRC });
      cfPromise = null;
      reject(err);
    });
  });

  return cfPromise;
}
