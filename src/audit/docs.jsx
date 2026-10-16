import { useEffect, useState } from 'react'

// ---------- ค่าตั้งต้นของเอกสาร (เก็บในเครื่อง ไม่ต้องสร้างตารางใหม่) ----------
const KEY = 'doc_settings'
const DEFAULTS = { company: 'บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด', dept: 'แผนก IT', preparer: '', reviewer: '', approver: '', appUrl: '' }

export function getDocSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
}
export function saveDocSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
}
export function useDocSettings() {
  const [s, setS] = useState(getDocSettings)
  useEffect(() => { saveDocSettings(s) }, [s])
  return [s, setS]
}

// URL สาธารณะของระบบ (ใช้ฝังใน QR) ถ้ายังไม่ตั้งค่าจะใช้ที่อยู่ปัจจุบัน
// ใส่ https:// ให้เองถ้าพิมพ์มาแค่ชื่อโดเมน (กล้องมือถือจะได้รู้ว่าเป็นลิงก์)
export const normalizeAppUrl = (u) => {
  const s = String(u || '').trim().replace(/\/+$/, '')
  if (!s) return (window.location.origin + window.location.pathname).replace(/\/+$/, '')
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}
export const getAppUrl = () => normalizeAppUrl(getDocSettings().appUrl)
export const assetUrl = (tag, base = getAppUrl()) => `${base}/?asset=${encodeURIComponent(tag)}`

// ---------- รูปแบบวันที่ ----------
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
// วันที่ตามเวลาเครื่อง (ไทย) รูปแบบ YYYY-MM-DD — toISOString() เป็นเวลา UTC
// ซึ่งช่วง 00:00–07:00 จะได้วันที่ของเมื่อวาน
export const localDateOf = (d) => {
  const t = d ? new Date(d) : new Date()
  if (isNaN(t)) return ''
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const today = () => localDateOf()
export const localStamp = () => {
  const t = new Date()
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().replace(/[:T]/g, '-').slice(0, 16)
}
export const monthKey = (d) => d ? localDateOf(d).slice(0, 7) : ''

// เลขที่ใบแจ้งซ่อม YYMM-NNN (ปี ค.ศ. 2 หลัก + เดือนที่แจ้ง + เลขลำดับ) ใช้ที่เดียวกันทุกหน้า
export const repairDocNo = (it) => {
  const d = localDateOf(it?.created_at)
  return `${d.slice(2, 4)}${d.slice(5, 7)}-${String(it?.id ?? '').padStart(3, '0')}`
}

// พนักงานที่ลาออกถูกติดป้าย "[ลาออก]" หน้าชื่อ (ดู scripts/employees-diff.js)
export const isLeaver = (name) => /^\[ลาออก\]/.test(String(name || ''))

// ค้นหาแบบไม่สนตัวพิมพ์ใหญ่เล็ก ในหลายช่องพร้อมกัน (กรองฝั่งเครื่อง ไม่ส่งข้อความไปประกอบ query)
export const textMatch = (q, ...vals) => {
  const s = String(q || '').trim().toLowerCase()
  return !s || vals.some(v => String(v ?? '').toLowerCase().includes(s))
}

// ส่งออก CSV ที่เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน (มี BOM) และ escape เครื่องหมายคำพูด
export function exportCSV(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const text = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  downloadText(filename, text, 'text/csv')
}

// ---------- ดาวน์โหลดไฟล์ ----------
export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob(['﻿' + text], { type: type + ';charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export function toCSV(rows, columns) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = columns.map(c => esc(c.label)).join(',')
  const body = rows.map(r => columns.map(c => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))
  return [head, ...body].join('\n')
}

// ---------- ส่วนประกอบเอกสาร ----------
export function DocHeader({ title, code, rev = '00', issued, extra }) {
  const s = getDocSettings()
  return (
    <div className="doc-header">
      <div className="doc-org">
        <div className="doc-company">{s.company}</div>
        <div className="doc-dept">{s.dept}</div>
      </div>
      <div className="doc-title">{title}</div>
      <table className="doc-meta">
        <tbody>
          {code && <tr><td>หมายเลขเอกสาร</td><td>{code}</td></tr>}
          {code && <tr><td>แก้ไขครั้งที่</td><td>{rev}</td></tr>}
          <tr><td>{issued ? 'วันที่จัดทำเอกสาร' : 'วันที่พิมพ์'}</td><td>{issued || fmtDate(new Date())}</td></tr>
          {extra?.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function SignatureBlock({ roles }) {
  const s = getDocSettings()
  const list = roles || [
    { role: 'ผู้จัดทำ (เจ้าหน้าที่ IT)', name: s.preparer },
    { role: 'ทบทวนโดย', name: s.reviewer },
    { role: 'อนุมัติโดย (ผช.ผจก.ฝ่ายทรัพยากรบุคคล)', name: s.approver },
  ]
  return (
    <div className="sig-grid">
      {list.map(r => (
        <div key={r.role} className="sig">
          <div className="sig-line" />
          <div>( {r.name || ' '.repeat(20)} )</div>
          <div className="muted">{r.role}</div>
          <div className="muted">วันที่ ______/______/________</div>
        </div>
      ))}
    </div>
  )
}

// แถบเครื่องมือด้านบนของหน้าเอกสาร (ไม่ถูกพิมพ์)
export function DocToolbar({ children }) {
  return (
    <div className="card no-print doc-toolbar">
      {children}
      <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>🖨️ พิมพ์ / บันทึก PDF</button>
    </div>
  )
}

// ตั้งค่าหัวเอกสารและผู้ลงนาม
export function DocSettingsForm() {
  const [s, setS] = useDocSettings()
  const f = (k) => ({ value: s[k], onChange: (e) => setS({ ...s, [k]: e.target.value }) })
  return (
    <div className="card no-print" style={{ marginBottom: 16 }}>
      <h3 className="section-title">หัวเอกสารและผู้ลงนาม (ใช้กับเอกสารออดิททุกหน้า)</h3>
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label>ชื่อบริษัท</label><input {...f('company')} /></div>
        <div><label>หน่วยงาน</label><input {...f('dept')} /></div>
        <div><label>ผู้จัดทำ</label><input {...f('preparer')} placeholder="ชื่อ-สกุล" /></div>
        <div><label>ทบทวนโดย</label><input {...f('reviewer')} placeholder="ชื่อ-สกุล" /></div>
        <div><label>อนุมัติโดย (ผช.ผจก.ฝ่ายทรัพยากรบุคคล)</label><input {...f('approver')} placeholder="ชื่อ-สกุล" /></div>
      </div>
    </div>
  )
}

export function Field({ label, value, wide }) {
  return (
    <div className={`doc-field ${wide ? 'wide' : ''}`}>
      <span className="doc-field-label">{label}</span>
      <span className="doc-field-value">{value || ' '}</span>
    </div>
  )
}

// เรียงรหัสเครื่องจักรตามลำดับจริง: ประเภท (COM ก่อน PNT) แล้วเลขลำดับ (2 มาก่อน 10)
export const byTag = (key) => (a, b) => {
  const pa = String(a[key] || '').split('-'), pb = String(b[key] || '').split('-')
  const na = parseInt(pa[pa.length - 1], 10), nb = parseInt(pb[pb.length - 1], 10)
  const head = (p) => p.slice(0, -1).join('-')
  return head(pa).localeCompare(head(pb)) || (isNaN(na) || isNaN(nb) ? String(a[key]).localeCompare(String(b[key])) : na - nb)
}

// ชื่อเครื่องจักรตามทะเบียน FQP-IT-01:01 (COM-IT-01 → COMPUTER 01, PNT-IT-02 → PRINTER 02)
const TYPE_NAME = { COM: 'COMPUTER', PNT: 'PRINTER', PT: 'PRINTER', NB: 'NOTEBOOK', SRV: 'SERVER' }
export function machineName(tag) {
  const m = String(tag || '').match(/^([A-Z]+)-([A-Z]+)-(\d+)$/i)
  if (!m) return tag || ''
  return `${TYPE_NAME[m[1].toUpperCase()] || m[1].toUpperCase()} ${m[3]}`
}
// หายี่ห้อจากข้อความรุ่น (ข้อมูลเดิมเก็บสเปกปนยี่ห้อ เช่น "I5 1200 16GB ACER") — ไม่เจอให้เว้นว่างไว้กรอกมือ
const BRANDS = ['ACER', 'ASUS', 'DELL', 'HP', 'LENOVO', 'HUAWEI', 'APPLE', 'MSI', 'GIGABYTE', 'EPSON', 'CANON', 'BROTHER', 'HONEYWELL', 'SAMSUNG', 'FUJI', 'XEROX', 'RICOH', 'KYOCERA']
export const guessBrand = (model) => {
  const words = String(model || '').toUpperCase().split(/[^A-Z0-9]+/)
  return BRANDS.find(b => words.includes(b)) || ''
}

// ประเภทจากตัวหน้าของรหัส AAA-BB-CC (COM / PNT / NB ...)
export const tagType = (tag) => String(tag || '').split('-')[0].toUpperCase()
export const categoryOfTag = (tag) => ({ COM: 'Computer', NB: 'Notebook', PNT: 'Printer', PT: 'Printer', SRV: 'Server' }[tagType(tag)] || null)

export const typeThai = (tag, category) => {
  const p = String(tag || '').split('-')[0].toUpperCase()
  return p === 'PNT' || p === 'PT' || /printer/i.test(category) ? 'ปริ้นเตอร์' : p === 'NB' ? 'โน้ตบุ๊ก' : 'คอมพิวเตอร์'
}
