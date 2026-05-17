import { createClient } from '@supabase/supabase-js';
import { getRuntimeEnv } from './runtimeEnv';

const supabaseUrl = getRuntimeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getRuntimeEnv('VITE_SUPABASE_ANON_KEY');

function isValidUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const supabaseConfigured =
  isValidUrl(supabaseUrl) && !!supabaseAnonKey && supabaseAnonKey.length > 0;

if (!supabaseConfigured) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Sinnara] Missing Supabase environment variables.');
  } else if (!isValidUrl(supabaseUrl)) {
    console.error('[Sinnara] VITE_SUPABASE_URL is not a valid http(s) URL.');
  }
}

// When unconfigured, fall back to placeholder values so module initialisation
// does not throw — main.tsx renders a visible configuration-error screen
// instead of leaving the user staring at a blank white page.
export const supabase = createClient(
  supabaseConfigured ? (supabaseUrl as string) : 'https://placeholder.supabase.co',
  supabaseConfigured ? (supabaseAnonKey as string) : 'placeholder-anon-key'
);
