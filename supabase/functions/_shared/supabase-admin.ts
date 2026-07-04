import { createClient } from 'npm:@supabase/supabase-js@2'

// Client service_role — contourne la RLS.
// Utilisé UNIQUEMENT dans les Edge Functions (jamais dans Electron).
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)
