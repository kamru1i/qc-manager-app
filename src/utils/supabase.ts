import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (typeof window !== 'undefined') {
    console.error('CRITICAL: Supabase environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Database requests will fail.');
  } else {
    console.warn('WARNING: Supabase environment variables are missing during build/server initialization.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
