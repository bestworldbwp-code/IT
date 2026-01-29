import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const logAction = async (action, tableName, recordId, newData = null, oldData = null) => {
  const client = getSupabase()
  if (!client) return
  await client.from('audit_logs').insert({
    action,
    table_name: tableName,
    record_id: recordId?.toString(),
    new_data: newData,
    old_data: oldData,
    performed_by: 'System Admin' // In real app, this would be the logged-in user
  })
}

export function getSupabase() {
  if (url && key) return createClient(url, key)
  return null
}

export function isEnvReady() {
  return Boolean(url && key)
}
