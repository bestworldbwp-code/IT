// สำรองข้อมูลทุกตารางจาก Supabase เป็นไฟล์ JSON (ค่าเริ่มต้น: โฟลเดอร์ backup ในโปรเจกต์)
// ใช้:  npm run backup            หรือระบุโฟลเดอร์เอง: node scripts/backup-to-file.js "D:\IT-Asset-Backup"
// ตั้งเวลาอัตโนมัติ: ดู scripts/backup-schedule.md
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostname } from 'node:os'

const TABLES = ['assets', 'computers', 'printers', 'employees', 'software', 'spare_parts', 'maintenance_logs', 'repair_requests', 'loans', 'audit_logs']
const KEEP_DAYS = 365 // เก็บไฟล์ย้อนหลัง 1 ปี (ลบของเก่ากว่านี้เอง)

const outDir = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'backup'))
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function fetchAll(table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select('*').order('id').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
mkdirSync(outDir, { recursive: true })

const dump = {}
const summary = {}
for (const t of TABLES) {
  dump[t] = await fetchAll(t)
  summary[t] = dump[t].length
}
const file = join(outDir, `it-asset-backup_${stamp}.json`)
writeFileSync(file, JSON.stringify({ exported_at: new Date().toISOString(), host: hostname(), tables: dump }, null, 1))
const total = Object.values(summary).reduce((a, b) => a + b, 0)

// ลบไฟล์เก่าเกินกำหนด
let removed = 0
for (const f of readdirSync(outDir)) {
  if (!f.startsWith('it-asset-backup_')) continue
  const age = (Date.now() - statSync(join(outDir, f)).mtimeMs) / 86400000
  if (age > KEEP_DAYS) { unlinkSync(join(outDir, f)); removed++ }
}

// บันทึกประวัติลงระบบ ให้หน้า "สำรองข้อมูล" แสดงว่าสำรองอัตโนมัติเมื่อไหร่
await client.from('audit_logs').insert({
  action: 'backup', table_name: 'auto_file', record_id: stamp.slice(0, 10),
  new_data: { tables: summary, total, storage: outDir, note: 'สำรองอัตโนมัติ (Task Scheduler)', file, performed_at: new Date().toISOString() },
  performed_by: `auto@${hostname()}`,
})

console.log(`OK ${file} (${total} rows, removed ${removed} old files)`)
