import { createClient } from '@supabase/supabase-js';
import { getRuntimeEnv } from './runtimeEnv';

const supabaseUrl = getRuntimeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getRuntimeEnv('VITE_SUPABASE_ANON_KEY');

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.error(
    '[Sinnara] Missing Supabase environment variables.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Use placeholder values when unconfigured so the module initialises without
// throwing — the app will show a config-error screen before any API calls run.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
);
