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
        try { previous(); } catch { /* a foreign handler must not break ours */ }
      }
      resolve(w.YT);
    };

    const tag = injectScript(YT_API_SRC);
    tag.addEventListener('error', () => {
      ytPromise = null;
      reject(new Error('Failed to load the YouTube IFrame API'));
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
        cfPromise = null;
        reject(new Error('Cloudflare Stream SDK loaded without a Stream global'));
      }
    });
    tag.addEventListener('error', () => {
      cfPromise = null;
      reject(new Error('Failed to load the Cloudflare Stream SDK'));
    });
  });

  return cfPromise;
}
