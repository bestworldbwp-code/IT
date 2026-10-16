import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://ampaaogorzukniikcorl.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcGFhb2dvcnp1a25paWtjb3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NzE2MDcsImV4cCI6MjA4NTI0NzYwN30.GEJHSKUAcUw1eoIOOd-_ytVfRBG6YObYNYLSxN2E-As'


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

// สร้าง client ครั้งเดียวแล้วใช้ซ้ำ (เดิมสร้างใหม่ทุกครั้งที่เรียก ทำให้มี GoTrueClient ซ้อนกันเป็นสิบตัว)
let client = null
export function getSupabase() {
  if (!url || !key) return null
  if (!client) client = createClient(url, key)
  return client
}

export function isEnvReady() {
  const ready = Boolean(url && key)
  return ready
}
