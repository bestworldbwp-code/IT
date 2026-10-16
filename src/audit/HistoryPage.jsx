import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { DocHeader, SignatureBlock, DocToolbar, Field, fmtDate, fmtDateTime, machineName, byTag, repairDocNo, guessBrand, textMatch, assetLocation } from './docs.jsx'

const STATUS_TH = { in_use: 'ใช้งาน', stock: 'สำรอง', repair: 'ส่งซ่อม', retired: 'ปลดระวาง' }
const LOG_TYPE = { repair: 'ซ่อมแซม / แก้ไข', parts: 'เปลี่ยนอะไหล่', preventive: 'บำรุงรักษาตามแผน', inspection: 'ตรวจเช็ค', update: 'ติดตั้ง / อัปเดต', upgrade: 'อัปเกรด', install: 'ติดตั้ง', backup_check: 'ตรวจสอบสำรองข้อมูล', other: 'อื่น ๆ' }
const REPAIR_ST = { pending: 'รอรับเรื่อง', in_progress: 'กำลังซ่อม', done: 'ซ่อมเสร็จ' }

// ประวัติเดิมในตาราง computers เก็บเป็นข้อความ "YYYY-MM-DD: รายละเอียด" (คั่นด้วยขึ้นบรรทัด / ; )
function legacyEvents(text) {
  return String(text || '').split(/\n|;|,(?=\s*\d{4}-)/).map(s => s.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2})\s*[:：-]?\s*(.*)$/)
    return { date: m ? m[1] : null, kind: 'บันทึกเดิม', title: m ? m[2] : l, detail: '', by: '', ref: 'ทะเบียนเดิม' }
  })
}

// ประวัติต่อเครื่อง (FQP-IT-01:02): รวม maintenance_logs + repair_requests + loans + ประวัติเดิมจากตาราง computers
export default function HistoryPage() {
  const [devices, setDevices] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const reqRef = useRef(0) // กดเปลี่ยนเครื่องเร็ว ๆ แล้วผลของเครื่องก่อนหน้ามาทีหลัง จะไม่ทับ

  useEffect(() => {
    (async () => {
      const client = getSupabase()
      if (!client) return
      const [a, c] = await Promise.all([
        client.from('assets').select('id, asset_tag, model, serial, owner').order('asset_tag'),
        client.from('computers').select('id, computer_id, spec, asset_type, user_id, repair_history').order('computer_id'),
      ])
      if (a.error || c.error) { setError((a.error || c.error).message); return }
      // เครื่องในตาราง computers ที่มีในทะเบียนหลักแล้ว ไม่ต้องแสดงซ้ำ (ประวัติเดิมถูกรวมเข้าไปตอนเลือกเครื่อง)
      const tags = new Set((a.data || []).map(x => x.asset_tag))
      setDevices([
        ...(a.data || []).map(x => ({ kind: 'asset', id: x.id, tag: x.asset_tag, sub: [x.model, x.serial].filter(Boolean).join(' · '), raw: x })),
        ...(c.data || []).filter(x => !tags.has(x.computer_id)).map(x => ({ kind: 'computer', id: x.id, tag: x.computer_id, sub: x.spec || '', raw: x })),
      ].sort(byTag('tag')))
    })()
  }, [])

  const matches = useMemo(() => {
    return devices.filter(d => textMatch(search, d.tag, d.sub))
  }, [devices, search])

  async function ownerInfo(client, id) {
    if (!id) return { label: '', dept: '' }
    if (id === '0000') return { label: 'เครื่องส่วนกลาง', dept: '' }
    const { data } = await client.from('employees').select('name, department').eq('employee_id', id).maybeSingle()
    return data ? { label: `${data.name}${data.department ? ` (${data.department})` : ''}`, dept: data.department || '' } : { label: id, dept: '' }
  }

  async function select(d) {
    const req = ++reqRef.current
    setSelected(d); setLoading(true); setDetail(null); setError('')
    const client = getSupabase()
    try {
      if (d.kind === 'asset') {
        const [asset, logs, repairs, loans, legacy] = await Promise.all([
          client.from('assets').select('*').eq('id', d.id).single(),
          client.from('maintenance_logs').select('*').eq('asset_id', d.id).order('created_at', { ascending: false }),
          client.from('repair_requests').select('*').eq('asset_id', d.id).order('created_at', { ascending: false }),
          client.from('loans').select('*, employees(name, department)').eq('asset_id', d.id).order('loan_date', { ascending: false }),
          client.from('computers').select('repair_history').eq('computer_id', d.tag).maybeSingle(),
        ])
        const err = asset.error || logs.error || repairs.error || loans.error
        if (err) throw err
        const events = [
          ...(logs.data || []).map(x => ({ date: x.log_date || x.created_at, kind: 'บำรุงรักษา', title: LOG_TYPE[x.log_type] || x.log_type, detail: x.description, by: x.performed_by, cost: x.cost, next: x.next_check_date, ref: x.reference_doc, remarks: x.remarks })),
          ...(repairs.data || []).map(x => ({ date: x.created_at, kind: 'แจ้งซ่อม', ref: `ใบแจ้งซ่อม No. ${repairDocNo(x)}`, title: `แจ้งซ่อม (${REPAIR_ST[x.status] || x.status})`, detail: `อาการ: ${x.problem}${x.resolution ? `\nการแก้ไข: ${x.resolution}` : ''}`, by: x.handled_by || x.reporter_name, cost: x.cost, done: x.completed_at })),
          ...(loans.data || []).map(x => ({ date: x.loan_date, kind: 'ยืม-คืน', title: x.status === 'returned' ? 'คืนแล้ว' : 'ยืมใช้งาน', detail: `ผู้ยืม: ${x.employees?.name || x.employee_id || '-'} · กำหนดคืน ${fmtDate(x.due_date)}${x.return_date ? ` · คืนวันที่ ${fmtDate(x.return_date)}` : ''}${x.remarks ? `\n${x.remarks}` : ''}`, by: '' })),
          ...legacyEvents(legacy.data?.repair_history),
        ]
          // ใบแจ้งซ่อมที่ปิดแล้วจะถูกลงประวัติ (maintenance_logs) อัตโนมัติ — แสดงแค่รายการเดียว ไม่นับค่าใช้จ่ายซ้ำ
          .filter((e, _, all) => !(e.kind === 'แจ้งซ่อม' && e.done && all.some(x => x.kind === 'บำรุงรักษา' && x.ref === e.ref)))
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        const owner = await ownerInfo(client, asset.data.owner)
        if (req === reqRef.current) setDetail({ info: { ...asset.data, ownerLabel: owner.label, ownerDept: owner.dept }, events })
      } else {
        const x = d.raw
        const owner = await ownerInfo(client, x.user_id)
        if (req === reqRef.current) setDetail({ info: { asset_tag: x.computer_id, model: x.spec, category: x.asset_type, ownerLabel: owner.label, ownerDept: owner.dept, status: null }, events: legacyEvents(x.repair_history) })
      }
    } catch (e) {
      if (req === reqRef.current) setError(e.message)
    } finally {
      if (req === reqRef.current) setLoading(false)
    }
  }

  const totalCost = detail?.events.reduce((s, e) => s + (parseFloat(e.cost) || 0), 0) || 0

  return (
    <div>
      <DocToolbar>
        <input placeholder="พิมพ์รหัสเครื่องเพื่อค้นหา เช่น COM-IT-01" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <span className="muted">{devices.length} เครื่องในระบบ</span>
      </DocToolbar>

      <div className="history-layout">
        <div className="card no-print device-list">
          {matches.map(d => (
            <button key={d.kind + d.id} className={`device-row ${selected?.kind === d.kind && selected?.id === d.id ? 'on' : ''}`} onClick={() => select(d)}>
              <div style={{ fontWeight: 600 }}>{d.tag}</div>
              <div className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.sub || (d.kind === 'computer' ? 'คอมพิวเตอร์ (ทะเบียนเดิม)' : '')}</div>
            </button>
          ))}
          {!matches.length && <div className="muted" style={{ padding: 12 }}>ไม่พบเครื่อง</div>}
        </div>

        <div>
          {error && <div className="card no-print" style={{ color: '#991b1b', background: '#fef2f2', marginBottom: 12 }}>⚠️ โหลดข้อมูลไม่สำเร็จ: {error}</div>}
          {!selected && (
            <div className="card no-print" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              เลือกเครื่องจากรายการด้านซ้าย เพื่อดูและพิมพ์ประวัติ
            </div>
          )}
          {selected && (
            <div className="doc card">
              <DocHeader title="ประวัติเครื่องคอมพิวเตอร์และอุปกรณ์ IT" code="FQP-IT-01:02" extra={[['M/C Code', selected.tag]]} />
              {loading && <div className="muted">กำลังโหลดประวัติ...</div>}
              {detail && (
                <>
                  <div className="doc-fields">
                    <Field label="M/C Name" value={machineName(detail.info.asset_tag)} />
                    <Field label="M/C Code" value={detail.info.asset_tag} />
                    <Field label="Brand" value={guessBrand(detail.info.model)} />
                    <Field label="Capacity" value={[detail.info.cpu, detail.info.ram, detail.info.storage].filter(Boolean).join(' / ') || detail.info.model} />
                    <Field label="Model" value={detail.info.model} />
                    <Field label="S/N No" value={detail.info.serial} />
                    <Field label="Location" value={assetLocation(detail.info, detail.info.ownerDept)} />
                    <Field label="Received Date" value={detail.info.purchase_date ? fmtDate(detail.info.purchase_date) : ''} />
                    <Field label="ผู้ใช้งาน" value={detail.info.ownerLabel} />
                    <Field label="สถานะ" value={STATUS_TH[detail.info.status] || detail.info.status} />
                  </div>

                  <h3 style={{ fontSize: '1rem', margin: '18px 0 8px', textAlign: 'center' }}>บันทึกการซ่อม/บำรุงรักษาเครื่องคอมพิวเตอร์และอุปกรณ์ IT</h3>
                  <table className="doc-table">
                    <thead><tr><th style={{ width: 100 }}>วัน/เดือน/ปี</th><th>รายละเอียดการแก้ไข/บำรุงรักษา</th><th style={{ width: 120 }}>ผู้ดำเนินการ</th><th style={{ width: 150 }}>เอกสารอ้างอิง</th><th style={{ width: 120 }}>หมายเหตุ</th></tr></thead>
                    <tbody>
                      {detail.events.map((e, i) => (
                        <tr key={i}>
                          <td>{e.date ? fmtDate(e.date) : '-'}</td>
                          <td><div style={{ fontWeight: 600 }}>[{e.kind}] {e.title}</div><div style={{ whiteSpace: 'pre-wrap' }}>{e.detail}</div></td>
                          <td>{e.by || ''}</td>
                          <td>{e.ref || ''}</td>
                          <td>{[e.remarks, e.cost ? `ค่าใช้จ่าย ${Number(e.cost).toLocaleString('th-TH')} บาท` : '', e.next ? `ตรวจครั้งถัดไป ${fmtDate(e.next)}` : ''].filter(Boolean).join(' · ')}</td>
                        </tr>
                      ))}
                      {!detail.events.length && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>ยังไม่มีประวัติ</td></tr>}
                      {/* บรรทัดว่างสำหรับกรอกมือ */}
                      {[0, 1, 2].map(i => <tr key={'b' + i}><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>)}
                    </tbody>
                    {totalCost > 0 && <tfoot><tr><td colSpan="4" style={{ textAlign: 'right', fontWeight: 600 }}>รวมค่าใช้จ่าย</td><td style={{ fontWeight: 600 }}>{totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</td></tr></tfoot>}
                  </table>
                  <div className="muted" style={{ marginTop: 6 }}>พิมพ์เมื่อ {fmtDateTime(new Date())}</div>
                  <SignatureBlock roles={[{ role: 'ผู้จัดทำ (เจ้าหน้าที่ IT)' }, { role: 'อนุมัติโดย (ผช.ผจก.ฝ่ายทรัพยากรบุคคล)' }]} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
