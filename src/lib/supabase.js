import { createClient } from '@supabase/supabase-js'

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const claveAnonima = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Cliente público (para el cliente/browser)
export const supabase = createClient(urlSupabase, claveAnonima)

// Cliente admin (para API routes del servidor - bypassa RLS)
const claveServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const supabaseAdmin = claveServiceRole 
  ? createClient(urlSupabase, claveServiceRole, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase // Fallback al cliente público si no hay service role key
