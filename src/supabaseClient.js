import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export function getSupabase() {
  if (url && key) return createClient(url, key)
  return null
}

export function isEnvReady() {
  return Boolean(url && key)
}
