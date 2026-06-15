import { describe, it, expect } from 'vitest';
import {
  parseVideoMeta,
  isYouTubeUrl,
  isValidYouTubeUrl,
  toYouTubeEmbedUrl,
  buildCloudflareIframeUrl,
  buildCloudflareThumbnailUrl,
  pickLang,
  resolveVideo,
} from './video';

describe('parseVideoMeta', () => {
  it('defaults legacy/empty records to youtube', () => {
    expect(parseVideoMeta(null).provider).toBe('youtube');
    expect(parseVideoMeta(undefined).provider).toBe('youtube');
    expect(parseVideoMeta({}).provider).toBe('youtube');
    expect(parseVideoMeta({ questions: [] }).provider).toBe('youtube');
  });

  it('returns the stored cloudflare model', () => {
    const meta = parseVideoMeta({ video: { provider: 'cloudflare_stream', cf_uid_en: 'abc' } });
    expect(meta.provider).toBe('cloudflare_stream');
    expect(meta.cf_uid_en).toBe('abc');
  });

  it('ignores an invalid provider value', () => {
    expect(parseVideoMeta({ video: { provider: 'vimeo' } as never }).provider).toBe('youtube');
  });
});

describe('YouTube helpers', () => {
  it('detects youtube urls', () => {
    expect(isYouTubeUrl('https://youtube.com/watch?v=abc')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/abc')).toBe(true);
    expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false);
    expect(isYouTubeUrl('')).toBe(false);
  });

  it('validates youtube urls', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isValidYouTubeUrl('https://www.youtube.com/shorts/abc123')).toBe(true);
    expect(isValidYouTubeUrl('https://example.com/video')).toBe(false);
    expect(isValidYouTubeUrl('not a url')).toBe(false);
  });

  it('converts watch / youtu.be / shorts to embed urls', () => {
    expect(toYouTubeEmbedUrl('https://www.youtube.com/watch?v=abc&t=10'))
      .toBe('https://www.youtube.com/embed/abc');
    expect(toYouTubeEmbedUrl('https://youtu.be/abc?si=xyz'))
      .toBe('https://www.youtube.com/embed/abc');
    expect(toYouTubeEmbedUrl('https://www.youtube.com/shorts/abc'))
      .toBe('https://www.youtube.com/embed/abc');
    // already an embed URL — left untouched
    expect(toYouTubeEmbedUrl('https://www.youtube.com/embed/abc'))
      .toBe('https://www.youtube.com/embed/abc');
  });
});

describe('Cloudflare URL builders', () => {
  it('builds iframe and thumbnail urls from a uid + subdomain', () => {
    expect(buildCloudflareIframeUrl('UID1', 'sub.example.com'))
      .toBe('https://sub.example.com/UID1/iframe');
    expect(buildCloudflareThumbnailUrl('UID1', 'sub.example.com'))
      .toBe('https://sub.example.com/UID1/thumbnails/thumbnail.jpg');
  });
});

describe('pickLang fallback', () => {
  it('prefers arabic then english for arabic viewers', () => {
    expect(pickLang(true, 'en', 'ar')).toBe('ar');
    expect(pickLang(true, 'en', '')).toBe('en'); // arabic missing → english
    expect(pickLang(true, '', '')).toBeNull();
  });

  it('prefers english then arabic for english viewers', () => {
    expect(pickLang(false, 'en', 'ar')).toBe('en');
    expect(pickLang(false, '', 'ar')).toBe('ar'); // english missing → arabic
  });
});

describe('resolveVideo', () => {
  it('resolves legacy youtube content with language fallback', () => {
    const en = resolveVideo({ contentData: {}, content: 'https://youtu.be/EN', contentAr: 'https://youtu.be/AR', isArabic: false });
    expect(en.provider).toBe('youtube');
    expect(en.embedUrl).toBe('https://www.youtube.com/embed/EN');

    const ar = resolveVideo({ contentData: {}, content: 'https://youtu.be/EN', contentAr: 'https://youtu.be/AR', isArabic: true });
    expect(ar.embedUrl).toBe('https://www.youtube.com/embed/AR');

    // arabic missing → english fallback
    const arFallback = resolveVideo({ contentData: {}, content: 'https://youtu.be/EN', contentAr: '', isArabic: true });
    expect(arFallback.embedUrl).toBe('https://www.youtube.com/embed/EN');
  });

  it('resolves cloudflare stream with language fallback', () => {
    const contentData = {
      video: {
        provider: 'cloudflare_stream' as const,
        cf_uid_en: 'UEN', cf_uid_ar: 'UAR',
        cf_playback_url_en: 'https://s/UEN/iframe',
        cf_playback_url_ar: 'https://s/UAR/iframe',
      },
    };
    expect(resolveVideo({ contentData, isArabic: false }).embedUrl).toBe('https://s/UEN/iframe');
    expect(resolveVideo({ contentData, isArabic: true }).embedUrl).toBe('https://s/UAR/iframe');
    expect(resolveVideo({ contentData, isArabic: false }).uid).toBe('UEN');
  });

  it('falls back to english cloudflare uid when arabic is absent', () => {
    const contentData = {
      video: { provider: 'cloudflare_stream' as const, cf_uid_en: 'UEN', cf_playback_url_en: 'https://s/UEN/iframe' },
    };
    const ar = resolveVideo({ contentData, isArabic: true });
    expect(ar.uid).toBe('UEN');
    expect(ar.embedUrl).toBe('https://s/UEN/iframe');
  });
});
