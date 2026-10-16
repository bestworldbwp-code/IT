// เทียบรายชื่อพนักงานล่าสุด (migrations/employees_new.json) กับทะเบียนในระบบ
// ใช้: node scripts/employees-diff.js          → แสดงผลเทียบ (ไม่แก้ข้อมูล)
//      node scripts/employees-diff.js --apply  → อัปเดตระบบ: เพิ่มคนใหม่, แก้ชื่อ/ฝ่าย/ตำแหน่ง, ติดป้ายลาออก
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const nw = JSON.parse(readFileSync(new URL('../migrations/employees_new.json', import.meta.url), 'utf8'))
const apply = process.argv.includes('--apply')

const norm = s => String(s || '').replace(/^(นาย|นาง|น\.ส\.|นางสาว)\s*/, '').replace(/\s+/g, ' ').trim()

const old = (await c.from('employees').select('id, employee_id, name, department, position')).data
const assets = (await c.from('assets').select('asset_tag, owner, status')).data
const newIds = new Set(nw.map(x => x.employee_id))
const oldMap = Object.fromEntries(old.map(x => [x.employee_id, x]))

const left = old.filter(x => !newIds.has(x.employee_id) && x.employee_id !== '0000' && !/^\[ลาออก\]/.test(x.name))
  .map(e => ({ ...e, assets: assets.filter(a => a.owner === e.employee_id && a.status !== 'retired').map(a => a.asset_tag) }))
const added = nw.filter(x => !oldMap[x.employee_id])
const changed = nw.filter(x => oldMap[x.employee_id]).map(x => {
  const o = oldMap[x.employee_id]
  const d = []
  if (norm(o.name) !== norm(x.name)) d.push(`ชื่อ: ${o.name} → ${x.name}`)
  if ((o.department || '') !== x.department) d.push(`ฝ่าย: ${o.department || '-'} → ${x.department}`)
  if ((o.position || '') !== x.position) d.push(`ตำแหน่ง: ${o.position || '-'} → ${x.position}`)
  return d.length ? { id: x.employee_id, diff: d, row: x } : null
}).filter(Boolean)

console.log(`ระบบ ${old.length} คน · ไฟล์ใหม่ ${nw.length} คน`)
console.log(`\nลาออก (ไม่มีในไฟล์ใหม่): ${left.length}`)
left.forEach(e => console.log(`  ${e.employee_id} ${e.name} | ${e.department || '-'} | ถือเครื่อง: ${e.assets.join(', ') || '-'}`))
console.log(`\nพนักงานใหม่: ${added.length}`)
added.forEach(e => console.log(`  ${e.employee_id} ${e.name} | ${e.department}`))
console.log(`\nข้อมูลเปลี่ยน: ${changed.length}`)
changed.forEach(x => console.log(`  ${x.id}: ${x.diff.join(' · ')}`))
writeFileSync(new URL('../migrations/employees_diff.json', import.meta.url), JSON.stringify({ left, added, changed }, null, 1))

if (!apply) { console.log('\n(ยังไม่แก้ข้อมูล — ใส่ --apply เพื่ออัปเดต)'); process.exit(0) }

// ---- apply ----
let n = 0
for (const e of added) { const r = await c.from('employees').insert({ ...e, email: '', username: '', desk_phone: '', user_share_drive_path: '' }); if (r.error) console.log('เพิ่มไม่ได้', e.employee_id, r.error.message); else n++ }
for (const x of changed) { const r = await c.from('employees').update({ name: x.row.name, department: x.row.department, position: x.row.position }).eq('employee_id', x.id); if (r.error) console.log('แก้ไม่ได้', x.id, r.error.message); else n++ }
// คนลาออก: ไม่ลบ (ประวัติ/เครื่องยังอ้างถึง) แต่ติดป้ายไว้หน้าชื่อ
for (const e of left) { const r = await c.from('employees').update({ name: `[ลาออก] ${e.name}` }).eq('employee_id', e.employee_id); if (r.error) console.log('ติดป้ายไม่ได้', e.employee_id, r.error.message); else n++ }
console.log(`\nอัปเดตแล้ว ${n} รายการ`)
