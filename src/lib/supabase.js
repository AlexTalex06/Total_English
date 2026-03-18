import { createClient } from '@supabase/supabase-js'

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const claveAnonima = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(urlSupabase, claveAnonima)
