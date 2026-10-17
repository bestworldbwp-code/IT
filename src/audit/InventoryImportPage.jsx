import { useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

// นำเข้าข้อมูลที่เก็บด้วยโปรแกรมบน USB (โฟลเดอร์ usb-inventory) → เติม S/N, CPU, RAM, Disk ในทะเบียนเครื่อง
// ส่งขึ้นระบบเฉพาะช่องเหล่านี้ — รายละเอียดอื่น (โปรแกรมที่ติดตั้ง, บัญชีผู้ใช้, IP/MAC) อยู่ในไฟล์บน USB เท่านั้น
const FIELDS = [['serial', 'S/N'], ['cpu', 'CPU'], ['ram', 'RAM'], ['storage', 'Disk'], ['model', 'รุ่น']]
const normTag = (t) => String(t || '').replace(/\s/g, '').toUpperCase().replace(/^PT-/, 'PNT-')
const text = (v) => String(v ?? '').trim()

export default function InventoryImportPage() {
  const [rows, setRows] = useState(null) // null = ยังไม่ได้เลือกไฟล์
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function onFile(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setResult(null)
    try {
      // inventory.json = รายการทุกเครื่อง, <รหัส>.json = เครื่องเดียว — เลือกได้หลายไฟล์
      const recs = []
      for (const f of files) {
        const data = JSON.parse((await f.text()).replace(/^﻿/, ''))
        for (const r of Array.isArray(data) ? data : [data]) if (r?.asset_tag) recs.push(r)
      }
      if (!recs.length) throw new Error('ไม่พบข้อมูลเครื่องในไฟล์ — เลือกไฟล์ inventory.json ในโฟลเดอร์ data บน USB')

      // เก็บเครื่องเดียวกันซ้ำ → ใช้ครั้งล่าสุด
      const latest = new Map()
      for (const r of recs) {
        const k = normTag(r.asset_tag)
        if (!latest.has(k) || text(r.collected_at) > text(latest.get(k).collected_at)) latest.set(k, r)
      }
      const { data: assets, error } = await getSupabase().from('assets').select('id, asset_tag, model, serial, cpu, ram, storage, status')
      if (error) throw error
      const byTag = new Map((assets || []).map(a => [normTag(a.asset_tag), a]))
      // ชื่อเครื่อง Windows เดียวกันแต่อยู่หลายรหัส = น่าจะพิมพ์รหัสผิดตอนเก็บ
      const pcCount = {}
      for (const r of latest.values()) if (r.computer_name) pcCount[r.computer_name] = (pcCount[r.computer_name] || 0) + 1

      const out = [...latest.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([tag, r]) => {
          const asset = byTag.get(tag)
          const changes = {}
          if (asset) {
            for (const [f] of FIELDS) {
              // รุ่น: เติมเฉพาะเครื่องที่ยังไม่มี (รุ่นเดิมเป็นชื่อที่ใช้ในเอกสาร ไม่เขียนทับ)
              const nv = f === 'model' ? text(r.brand_model) : text(r[f])
              const ov = text(asset[f])
              if (nv && nv !== ov && (f !== 'model' || !ov)) changes[f] = [ov, nv]
            }
          }
          return { tag, rec: r, asset, changes, dupPc: pcCount[r.computer_name] > 1, pick: !!asset && Object.keys(changes).length > 0 }
        })
      setRows(out)
      setFileName(files.map(f => f.name).join(', '))
    } catch (ex) {
      alert('อ่านไฟล์ไม่ได้: ' + ex.message)
    }
  }

  const list = rows || []
  const picked = list.filter(r => r.pick)
  const notFound = list.filter(r => !r.asset).length
  const same = list.filter(r => r.asset && !Object.keys(r.changes).length && !r.saved).length
  const toggle = (tag) => setRows(rs => rs.map(r => r.tag === tag ? { ...r, pick: !r.pick } : r))
  const canPick = (r) => !!r.asset && Object.keys(r.changes).length > 0 && !r.saved

  async function save() {
    if (!picked.length || busy) return
    if (!confirm(`บันทึกข้อมูลลงทะเบียน ${picked.length} เครื่อง?`)) return
    setBusy(true)
    const client = getSupabase()
    const savedTags = new Set()
    const failed = []
    for (const r of picked) {
      const patch = Object.fromEntries(Object.entries(r.changes).map(([f, [, nv]]) => [f, nv]))
      const { error } = await client.from('assets').update(patch).eq('id', r.asset.id)
      if (error) { failed.push(`${r.tag}: ${error.message}`); continue }
      savedTags.add(r.tag)
      await client.from('audit_logs').insert({
        action: 'inventory_import', table_name: 'assets', record_id: String(r.asset.id),
        old_data: Object.fromEntries(Object.entries(r.changes).map(([f, [ov]]) => [f, ov])),
        new_data: { ...patch, asset_tag: r.tag, collected_at: r.rec.collected_at, computer_name: r.rec.computer_name },
        performed_by: 'นำเข้าจาก USB',
      })
    }
    setBusy(false)
    setResult({ ok: savedTags.size, failed })
    setRows(rs => rs.map(r => savedTags.has(r.tag) ? { ...r, pick: false, saved: true } : r))
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>ขั้นตอน</h3>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>คัดลอกโฟลเดอร์ <code>usb-inventory</code> (อยู่ในโฟลเดอร์โปรแกรม IT บนเครื่อง IT) ลง USB</li>
          <li>ที่แต่ละเครื่อง ดับเบิลคลิก <strong>เก็บข้อมูลเครื่อง.bat</strong> แล้วพิมพ์รหัสบนสติกเกอร์ (เช่น COM-IT-05)</li>
          <li>กลับมาที่หน้านี้ เลือกไฟล์ <code>data\inventory.json</code> บน USB → ตรวจรายการ → กดบันทึก</li>
        </ol>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <label className="primary" style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
            📂 เลือกไฟล์ inventory.json
            <input type="file" accept=".json,application/json" multiple onChange={onFile} style={{ display: 'none' }} />
          </label>
          {fileName && <span className="muted">{fileName}</span>}
        </div>
        <div className="muted" style={{ marginTop: 10, fontSize: '0.85rem' }}>
          ระบบจะเติมเฉพาะ S/N, CPU, RAM, Disk (และรุ่น ถ้ายังว่าง) ลงทะเบียนเครื่อง — รายการโปรแกรม บัญชีผู้ใช้ IP/MAC ดูได้จาก inventory.csv / software.csv บน USB
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 16, background: result.failed.length ? '#fef2f2' : '#f0fdf4', borderColor: result.failed.length ? '#fecaca' : '#bbf7d0' }}>
          ✅ บันทึกแล้ว {result.ok} เครื่อง — ดูได้ที่ทะเบียนเครื่อง (ช่อง Capacity) และประวัติเครื่อง (S/N No)
          {result.failed.length > 0 && <div style={{ color: '#b91c1c', marginTop: 6 }}>ไม่สำเร็จ: {result.failed.join(' · ')}</div>}
        </div>
      )}

      {rows && (
        <>
          <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>ในไฟล์ <strong>{list.length}</strong> เครื่อง</span>
            <span>จะบันทึก <strong>{picked.length}</strong></span>
            {same > 0 && <span className="muted">ตรงกับทะเบียนแล้ว {same}</span>}
            {notFound > 0 && <span style={{ color: '#b45309' }}>ไม่พบในทะเบียน {notFound}</span>}
            <button className="primary" style={{ marginLeft: 'auto' }} onClick={save} disabled={busy || !picked.length}>
              {busy ? 'กำลังบันทึก...' : `💾 บันทึกลงทะเบียน (${picked.length} เครื่อง)`}
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                  <th style={{ padding: '10px 12px', width: 36 }} />
                  <th style={{ padding: '10px 12px' }}>รหัส / เครื่อง</th>
                  <th style={{ padding: '10px 12px' }}>สิ่งที่จะบันทึก</th>
                  <th style={{ padding: '10px 12px' }}>Windows / โปรแกรม</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => {
                  const ch = Object.entries(r.changes)
                  return (
                    <tr key={r.tag} style={{ borderBottom: '1px solid var(--border)', background: r.saved ? '#f0fdf4' : undefined }}>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <input type="checkbox" style={{ width: 16 }} checked={!!r.pick} disabled={!canPick(r)} onChange={() => toggle(r.tag)} />
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700 }}>{r.tag}</div>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{r.rec.computer_name || '-'} · {r.rec.logged_in_user || '-'}</div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>เก็บเมื่อ {r.rec.collected_at || '-'}</div>
                        {r.dupPc && <div style={{ color: '#b45309', fontSize: '0.8rem' }}>⚠️ ชื่อเครื่อง {r.rec.computer_name} อยู่หลายรหัส — ตรวจว่าพิมพ์รหัสถูกไหม</div>}
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', fontSize: '0.875rem' }}>
                        {!r.asset && <span style={{ color: '#b45309' }}>ไม่พบรหัสนี้ในทะเบียน — เพิ่มเครื่องที่หน้า "เครื่องและอุปกรณ์" ก่อน แล้วนำเข้าใหม่</span>}
                        {r.saved && <span style={{ color: '#15803d', fontWeight: 600 }}>✓ บันทึกแล้ว</span>}
                        {r.asset && !r.saved && !ch.length && <span className="muted">ข้อมูลตรงกับทะเบียนแล้ว</span>}
                        {!r.saved && ch.map(([f, [ov, nv]]) => (
                          <div key={f}>
                            <span className="muted">{FIELDS.find(x => x[0] === f)?.[1]}:</span>{' '}
                            {ov && <><s className="muted">{ov}</s> → </>}<strong>{nv}</strong>
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', fontSize: '0.8rem', maxWidth: 360 }}>
                        <div>{r.rec.os || '-'}{r.rec.activated ? ` · ${r.rec.activated}` : ''}</div>
                        {r.rec.last_update && <div className="muted">อัปเดตล่าสุด {r.rec.last_update}</div>}
                        {r.rec.office && <div className="muted">{r.rec.office}</div>}
                        {r.rec.antivirus && <div className="muted">AV: {r.rec.antivirus}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
