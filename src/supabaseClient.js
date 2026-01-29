import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://ampaaogorzukniikcorl.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcGFhb2dvcnp1a25paWtjb3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NzE2MDcsImV4cCI6MjA4NTI0NzYwN30.GEJHSKUAcUw1eoIOOd-_ytVfRBG6YObYNYLSxN2E-As'

console.log('Supabase Connection Debug:')
console.log('- URL:', url ? '✅ ' + url : '❌ Missing')
console.log('- Key:', key ? '✅ (Masked: ' + key.substring(0, 10) + '...)' : '❌ Missing')

export const logAction = async (action, tableName, recordId, newData = null, oldData = null) => {
  const client = getSupabase()
  if (!client) return
  await client.from('audit_logs').insert({
    action,
    table_name: tableName,
    record_id: recordId?.toString(),
    new_data: newData,
    old_data: oldData,
    performed_by: 'System Admin'
  })
}

export function getSupabase() {
  if (url && key) return createClient(url, key)
  return null
}

export function isEnvReady() {
  const ready = Boolean(url && key)
  return ready
}
