// กู้คืนข้อมูลจากไฟล์สำรอง (it-asset-backup_*.json ที่ได้จากหน้า "สำรองข้อมูล" หรือ npm run backup)
//
//   npm run restore -- backup\it-asset-backup_2026-10-16-09-00.json              → ตรวจอย่างเดียว ไม่แก้ข้อมูล
//   npm run restore -- backup\it-asset-backup_2026-10-16-09-00.json --apply      → ใส่แถวที่หายไปกลับ + ต่อความสัมพันธ์ที่ขาด
//   npm run restore -- <ไฟล์> --apply --overwrite                                 → + คืนค่าแถวที่ถูกแก้ ให้เหมือนในไฟล์สำรอง
//
// ฐานข้อมูลกำหนด id เป็น GENERATED ALWAYS จึงใส่ id เดิมกลับไม่ได้ สคริปต์นี้จึง:
//  - จับคู่แถวด้วยรหัสธรรมชาติ (asset_tag, employee_id, computer_id, printer_id) หรือ created_at (แอปไม่เคยแก้ช่องนี้)
//  - แปลง asset_id / record_id เดิม → id เครื่องปัจจุบันผ่าน asset_tag
//  - ต่อใบแจ้งซ่อม/บันทึกสำรวจที่ยังอยู่แต่เครื่องถูกลบไป (asset_id กลายเป็นว่าง) กลับเข้ากับเครื่องที่กู้คืน
//  - คงเลขที่ใบแจ้งซ่อมเดิม (doc_no) ถ้าฐานข้อมูลมีคอลัมน์นี้ ไม่งั้นแก้ "เอกสารอ้างอิง" ในประวัติเครื่องให้ตรงเลขใหม่
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const APPLY = args.includes('--apply')
const OVERWRITE = args.includes('--overwrite')
if (!file) {
  console.error('ใช้: npm run restore -- <ไฟล์ it-asset-backup_*.json> [--apply] [--overwrite]')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

let backup
try {
  // ไฟล์ที่ดาวน์โหลดจากเบราว์เซอร์รุ่นก่อนมี BOM นำหน้า — ตัดออกก่อน parse
  backup = JSON.parse(readFileSync(resolve(file), 'utf8').replace(/^﻿/, ''))
} catch (e) {
  console.error('อ่านไฟล์สำรองไม่ได้:', e.message)
  process.exit(1)
}
const B = backup.tables || {}
console.log(`ไฟล์สำรอง: ${file}\nสร้างเมื่อ: ${backup.exported_at}\nโหมด: ${APPLY ? (OVERWRITE ? 'กู้คืน + คืนค่าแถวที่ถูกแก้' : 'กู้คืนแถวที่หายไป + ต่อความสัมพันธ์ที่ขาด') : 'ตรวจอย่างเดียว (ไม่แก้ข้อมูล)'}\n`)

async function fetchAll(table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c.from(table).select('*').order('id').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows
}
const strip = (r) => { const o = { ...r }; delete o.id; return o }
const val = (v) => JSON.stringify(v ?? null)
const sameFields = (cur, bak, skip) => Object.keys(bak).every(k => skip.includes(k) || val(cur[k]) === val(bak[k]))

const totals = { missing: 0, changed: 0, relink: 0, applied: 0 }
function report(table, n, missing, changed, relink = 0) {
  totals.missing += missing; totals.changed += changed; totals.relink += relink
  console.log(`${table.padEnd(17)} ในไฟล์ ${String(n).padStart(4)} · หายไป ${String(missing).padStart(3)} · ถูกแก้ ${String(changed).padStart(3)}${relink ? ` · ต้องต่อเครื่องใหม่ ${relink}` : ''}`)
}
async function run(q, what) {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  totals.applied++
  return data
}

// จับคู่ด้วย created_at (แอปไม่เคยแก้) — ถ้าหลายแถวเวลาเดียวกัน (นำเข้าพร้อมกัน) จะจับคู่แถวที่เหมือนกันก่อน
function matchByCreated(bakRows, curRows, isSame) {
  const pool = new Map()
  for (const r of curRows) { const k = String(r.created_at); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(r) }
  const missing = [], pairs = []
  for (const b of bakRows) {
    const list = pool.get(String(b.created_at)) || []
    let i = list.findIndex(cr => isSame(cr, b))
    if (i < 0 && list.length) i = 0
    if (i < 0) { missing.push(b); continue }
    pairs.push({ b, cur: list.splice(i, 1)[0] })
  }
  return { missing, pairs }
}

// ---------- 1) ตารางที่มีรหัสธรรมชาติ ----------
async function restoreByKey(table, key) {
  const bak = B[table] || []
  const cur = await fetchAll(table)
  const byKey = new Map(cur.map(r => [r[key], r]))
  const missing = bak.filter(r => r[key] != null && !byKey.has(r[key]))
  const changed = bak.filter(r => byKey.has(r[key]) && !sameFields(byKey.get(r[key]), r, ['id', 'created_at']))
  report(table, bak.length, missing.length, changed.length)
  if (APPLY && missing.length) await run(c.from(table).insert(missing.map(strip)), `${table} insert`)
  if (APPLY && OVERWRITE) for (const r of changed) {
    const body = strip(r); delete body.created_at
    await run(c.from(table).update(body).eq(key, r[key]), `${table} update ${r[key]}`)
  }
  return missing
}

// ---------- 2) ตารางที่ไม่มีรหัสธรรมชาติ และไม่อ้างเครื่อง ----------
async function restoreByCreated(table) {
  const bak = B[table] || []
  const cur = await fetchAll(table)
  const skip = ['id', 'created_at']
  const { missing, pairs } = matchByCreated(bak, cur, (cr, b) => sameFields(cr, b, skip))
  const changed = pairs.filter(p => !sameFields(p.cur, p.b, skip))
  report(table, bak.length, missing.length, changed.length)
  if (!APPLY) return
  if (missing.length) await run(c.from(table).insert(missing.map(strip)), `${table} insert`)
  if (OVERWRITE) for (const p of changed) {
    const body = strip(p.b); delete body.created_at
    await run(c.from(table).update(body).eq('id', p.cur.id), `${table} update`)
  }
}

try {
  await restoreByKey('employees', 'employee_id')   // ก่อน loans (FK employee_id)
  // เครื่องที่จะถูกกู้คืน — ใช้นับในโหมดตรวจว่าแถวไหน "ต้องต่อเครื่องใหม่" (ตอนตรวจ เครื่องยังไม่มี id ใหม่)
  const restoredTags = new Set((await restoreByKey('assets', 'asset_tag')).map(a => a.asset_tag))
  await restoreByKey('computers', 'computer_id')
  await restoreByKey('printers', 'printer_id')
  await restoreByCreated('software')
  await restoreByCreated('spare_parts')

  // ---------- 3) ตารางที่อ้างเครื่อง (asset_id) ----------
  const curAssets = await fetchAll('assets')
  const oldIdToTag = new Map((B.assets || []).map(a => [a.id, a.asset_tag]))
  const tagToNewId = new Map(curAssets.map(a => [a.asset_tag, a.id]))
  const curIdToTag = new Map(curAssets.map(a => [a.id, a.asset_tag]))
  const mapAsset = (oldId) => oldId == null ? null : (tagToNewId.get(oldIdToTag.get(oldId)) ?? null)
  const willExist = (tag) => tag != null && (tagToNewId.has(tag) || restoredTags.has(tag))

  async function restoreLinked(table, { onInsert, beforeInsert, onPair } = {}) {
    // beforeInsert แก้ค่าในแถวสำรองก่อนเทียบ/บันทึก (เช่น เลขที่ใบแจ้งซ่อมที่เปลี่ยนไป)
    const bak = (B[table] || []).map(r => { const o = { ...r }; beforeInsert?.(o); return o })
    const cur = await fetchAll(table)
    const skip = ['id', 'created_at', 'asset_id']
    // เครื่องเดียวกัน = asset_tag เดียวกัน (id อาจเปลี่ยนหลังกู้คืน)
    const sameAsset = (cr, b) => (curIdToTag.get(cr.asset_id) ?? null) === (oldIdToTag.get(b.asset_id) ?? null)
    const { missing, pairs } = matchByCreated(bak, cur, (cr, b) => sameAsset(cr, b) && sameFields(cr, b, skip))
    // แถวยังอยู่ แต่เครื่องถูกลบไปแล้วกู้คืน → asset_id เป็นว่าง/ชี้ id ที่ไม่มีแล้ว
    const relink = pairs.filter(p => p.b.asset_id != null && willExist(oldIdToTag.get(p.b.asset_id)) && !curIdToTag.has(p.cur.asset_id))
    const changed = pairs.filter(p => !relink.includes(p) && (!sameAsset(p.cur, p.b) || !sameFields(p.cur, p.b, skip)))
    pairs.forEach(p => onPair?.(p))
    report(table, bak.length, missing.length, changed.length, relink.length)
    if (!APPLY) return
    for (const p of relink) if (mapAsset(p.b.asset_id) != null) await run(c.from(table).update({ asset_id: mapAsset(p.b.asset_id) }).eq('id', p.cur.id), `${table} relink`)
    for (const r of missing) {
      const body = strip(r)
      if (r.asset_id != null) {
        body.asset_id = mapAsset(r.asset_id)
        if (body.asset_id == null) { console.log(`  ข้าม ${table} (เดิม id ${r.id}): ไม่พบเครื่อง ${oldIdToTag.get(r.asset_id) || r.asset_id} ในระบบ`); continue }
      }
      const data = await run(c.from(table).insert(body).select('*').single(), `${table} insert`)
      onInsert?.(r, data)
    }
    if (OVERWRITE) for (const p of changed) {
      const body = strip(p.b); delete body.created_at
      if (p.b.asset_id != null) body.asset_id = mapAsset(p.b.asset_id) ?? p.cur.asset_id
      await run(c.from(table).update(body).eq('id', p.cur.id), `${table} update`)
    }
  }

  // เลขที่ใบแจ้งซ่อม: ถ้าฐานข้อมูลมี doc_no เลขเดิมจะติดไปกับแถวที่กู้คืน ถ้าไม่มี เลขจะเปลี่ยนตาม id ใหม่
  const ym = (d) => { const t = new Date(d); return `${String(t.getFullYear()).slice(2)}${String(t.getMonth() + 1).padStart(2, '0')}` }
  const docOf = (r) => r.doc_no || `${ym(r.created_at)}-${String(r.id).padStart(3, '0')}`
  const docMap = new Map() // "ใบแจ้งซ่อม No. เดิม" → "ใบแจ้งซ่อม No. ใหม่"
  await restoreLinked('repair_requests', {
    // ใบที่กู้คืนไปแล้วรอบก่อน (เลขเปลี่ยนแล้ว) — จำคู่เลขไว้ เพื่อไม่ให้ประวัติเครื่องถูกนับว่า "ถูกแก้"
    onPair: (p) => { const a = docOf(p.b), b = docOf(p.cur); if (a !== b) docMap.set(`ใบแจ้งซ่อม No. ${a}`, `ใบแจ้งซ่อม No. ${b}`) },
    onInsert: (old, now) => {
      const a = docOf(old), b = docOf(now)
      if (a !== b) { docMap.set(`ใบแจ้งซ่อม No. ${a}`, `ใบแจ้งซ่อม No. ${b}`); console.log(`  ใบแจ้งซ่อม No. ${a} → No. ${b}`) }
    },
  })
  const fixRef = (body) => { if (body.reference_doc && docMap.has(body.reference_doc)) body.reference_doc = docMap.get(body.reference_doc) }
  await restoreLinked('maintenance_logs', { beforeInsert: fixRef })
  if (APPLY && docMap.size) {
    // ประวัติเครื่องที่ไม่ได้หายไป แต่อ้างเลขที่ใบเดิม → แก้ให้ตรงเลขใหม่ (ไม่งั้นหน้าประวัติจะนับงานซ่อมซ้ำ)
    for (const [from, to] of docMap) await run(c.from('maintenance_logs').update({ reference_doc: to }).eq('reference_doc', from), 'maintenance_logs reference_doc')
  }
  await restoreLinked('loans')

  // ---------- 4) audit_logs: บันทึกสำรวจเก็บ id เครื่องใน record_id ----------
  {
    const bak = B.audit_logs || []
    const cur = await fetchAll('audit_logs')
    const want = (r) => (r.action === 'survey' && r.new_data?.asset_tag && tagToNewId.has(r.new_data.asset_tag)) ? String(tagToNewId.get(r.new_data.asset_tag)) : r.record_id
    const { missing, pairs } = matchByCreated(bak, cur, (cr, b) => cr.action === b.action)
    const relink = pairs.filter(p => p.b.action === 'survey' && willExist(p.b.new_data?.asset_tag) && !curIdToTag.has(Number(p.cur.record_id)))
    report('audit_logs', bak.length, missing.length, 0, relink.length)
    if (APPLY) {
      for (const p of relink) if (want(p.b) !== p.cur.record_id) await run(c.from('audit_logs').update({ record_id: want(p.b) }).eq('id', p.cur.id), 'audit_logs relink')
      if (missing.length) await run(c.from('audit_logs').insert(missing.map(r => ({ ...strip(r), record_id: want(r) }))), 'audit_logs insert')
    }
  }

  console.log(`\nรวม: หายไป ${totals.missing} · ถูกแก้ ${totals.changed} · ต้องต่อเครื่องใหม่ ${totals.relink}`)
  if (!APPLY) {
    if (totals.missing || totals.relink) console.log('ใส่ --apply เพื่อกู้คืนแถวที่หายไปและต่อความสัมพันธ์ที่ขาด')
    if (totals.changed) console.log('แถวที่ "ถูกแก้" จะคืนค่าตามไฟล์สำรองเมื่อใส่ --apply --overwrite (ตรวจให้แน่ใจก่อน — การแก้ไขหลังวันที่สำรองจะหาย)')
    if (!totals.missing && !totals.changed && !totals.relink) console.log('ข้อมูลในระบบครบตามไฟล์สำรอง ✓')
  } else console.log(`ดำเนินการแล้ว ${totals.applied} คำสั่ง`)
} catch (e) {
  console.error('\nกู้คืนไม่สำเร็จ:', e.message)
  process.exit(1)
}
