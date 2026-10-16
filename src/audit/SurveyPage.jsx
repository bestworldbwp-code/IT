import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { DocHeader, SignatureBlock, fmtDateTime, getDocSettings, today, byTag, isLeaver } from './docs.jsx'

const CONDITIONS = [
  { v: 'ok', label: '✅ ใช้งานปกติ' },
  { v: 'damaged', label: '🔧 ชำรุด / มีปัญหา' },
  { v: 'spare', label: '📦 ไม่ได้ใช้ (เก็บสำรอง)' },
  { v: 'missing', label: '❓ ไม่พบเครื่อง' },
]
const COND_LABEL = Object.fromEntries(CONDITIONS.map(c => [c.v, c.label]))

// รอบสำรวจ = เดือนปัจจุบันตามเวลาไทย (เก็บผลใน audit_logs action='survey' ไม่ต้องสร้างตารางใหม่)
const currentRound = () => today().slice(0, 7)

const BUILDINGS = ['อาคารสำนักงาน', 'โรงงาน 1', 'โรงงาน 2', 'คลังสินค้า', 'ป้อมยาม']

export default function SurveyPage() {
  const [assets, setAssets] = useState([])
  const [employees, setEmployees] = useState([])
  const [surveyed, setSurveyed] = useState({}) // asset id -> log
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(true)
  const [current, setCurrent] = useState(null)
  const [form, setForm] = useState({ owner: '', building: '', position: '', dept: '', condition: 'ok', note: '' })
  const [saving, setSaving] = useState(false)
  const [printMode, setPrintMode] = useState(false)
  const searchRef = useRef(null)
  const busy = useRef(false) // กันกดบันทึกซ้ำ (จะได้ประวัติสำรวจซ้ำ)
  const ROUND = useMemo(currentRound, [])

  async function load() {
    const client = getSupabase()
    if (!client) return
    const [a, e, s] = await Promise.all([
      client.from('assets').select('id, asset_tag, model, owner, location, building, position_detail, status, category').neq('status', 'retired').order('asset_tag'), // เครื่องที่ปลดระวางแล้วไม่ต้องสำรวจ
      client.from('employees').select('employee_id, name, department, position').order('employee_id'),
      client.from('audit_logs').select('*').eq('action', 'survey').order('created_at', { ascending: false }),
    ])
    setAssets((a.data || []).sort(byTag('asset_tag')))
    setEmployees(e.data || [])
    const m = {}
    for (const log of (s.data || [])) {
      if (log.new_data?.round === ROUND && !m[log.record_id]) m[log.record_id] = log
    }
    setSurveyed(m)
  }
  useEffect(() => { load() }, [])

  const empById = useMemo(() => Object.fromEntries(employees.map(e => [e.employee_id, e])), [employees])
  const empLabel = (id) => { if (id === '0000') return '🏢 เครื่องส่วนกลาง'; const e = empById[id]; return e ? `${e.name}${e.department ? ` (${e.department})` : ''}` : (id || '-') }
  const departments = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees])
  const buildings = useMemo(() => [...new Set([...BUILDINGS, ...assets.map(a => a.building).filter(Boolean)])], [assets])
  const positions = useMemo(() => [...new Set(assets.map(a => a.position_detail).filter(Boolean))].sort(), [assets])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assets.filter(a =>
      (!onlyPending || !surveyed[a.id]) &&
      (!q || [a.asset_tag, a.model, a.owner, empById[a.owner]?.name].some(v => String(v || '').toLowerCase().includes(q)))
    )
  }, [assets, search, onlyPending, surveyed, empById])

  const doneCount = assets.filter(a => surveyed[a.id]).length
  const problems = assets.filter(a => surveyed[a.id] && surveyed[a.id].new_data?.condition !== 'ok')

  function open(a) {
    setCurrent(a)
    const prev = surveyed[a.id]?.new_data
    const emp = empById[prev?.owner ?? a.owner]
    setForm({ owner: prev?.owner ?? a.owner ?? '', building: prev?.building ?? a.building ?? '', position: prev?.position ?? a.position_detail ?? '', dept: prev?.dept ?? a.location ?? emp?.department ?? '', condition: prev?.condition || 'ok', note: prev?.note || '' })
  }

  // รับได้ทั้ง "110001" และ "110001 - ชื่อ (แผนก)" จาก datalist
  const parseOwner = (v) => String(v || '').split(' - ')[0].trim()

  function resolveOwner(raw) {
    const v = parseOwner(raw)
    if (!v || v === '0000' || empById[v]) return v
    const q = v.toLowerCase()
    const hits = employees.filter(e => !isLeaver(e.name) && e.name.toLowerCase().includes(q))
    return hits.length === 1 ? hits[0].employee_id : null
  }

  async function save(e) {
    e.preventDefault()
    if (!current || busy.current) return
    let owner = resolveOwner(form.owner)
    if (owner === null) {
      if (!confirm(`ไม่พบ "${parseOwner(form.owner)}" ในทะเบียนพนักงาน (หรือชื่อซ้ำหลายคน) — เลือกจากรายชื่อที่ขึ้นให้จะถูกต้องกว่า\n\nบันทึกตามที่พิมพ์ไว้เลยไหม?`)) return
      owner = parseOwner(form.owner)
    }
    busy.current = true
    setSaving(true)
    try { await doSave(owner) } finally { busy.current = false; setSaving(false) }
  }

  async function doSave(owner) {
    const client = getSupabase()
    const location = form.dept.trim()
    const patch = { owner, location, building: form.building.trim() || null, position_detail: form.position.trim() || null }
    if (form.condition === 'spare') patch.status = 'stock'
    else if (form.condition === 'ok' && (current.status === 'stock' || current.status === 'repair')) patch.status = 'in_use'
    else if (form.condition === 'damaged') patch.status = 'repair'

    const { error } = await client.from('assets').update(patch).eq('id', current.id)
    if (error) { alert(error.message); return }

    // ให้ตารางเดิม (computers / printers) ตรงกับผลสำรวจด้วย
    await Promise.all([
      client.from('computers').update({ user_id: owner }).eq('computer_id', current.asset_tag),
      client.from('printers').update({ user_id: owner }).eq('printer_id', current.asset_tag),
    ])

    const { error: logErr } = await client.from('audit_logs').insert({
      action: 'survey', table_name: 'assets', record_id: String(current.id),
      old_data: { owner: current.owner, location: current.location, building: current.building, position_detail: current.position_detail, status: current.status },
      new_data: { round: ROUND, asset_tag: current.asset_tag, owner, location, building: form.building.trim(), position: form.position.trim(), dept: form.dept.trim(), condition: form.condition, note: form.note.trim(), ...patch },
      performed_by: getDocSettings().preparer || 'IT Admin',
    })
    if (logErr) alert('บันทึกเครื่องแล้ว แต่บันทึกประวัติสำรวจไม่สำเร็จ: ' + logErr.message)

    alert(`บันทึก ${current.asset_tag} แล้ว`)
    setCurrent(null)
    setSearch('')
    await load()
    searchRef.current?.focus()
  }

  if (printMode) return <PaperSheet assets={assets} empLabel={empLabel} round={ROUND} onBack={() => setPrintMode(false)} />

  return (
    <div>
      {/* ความคืบหน้า */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong>รอบสำรวจ {new Date(ROUND + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</strong>
            <span>{doneCount} / {assets.length} เครื่อง</span>
          </div>
          <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${assets.length ? doneCount / assets.length * 100 : 0}%`, height: '100%', background: 'var(--primary)', transition: 'width .3s' }} />
          </div>
          {problems.length > 0 && <div className="muted" style={{ marginTop: 6, color: '#b45309' }}>พบปัญหา {problems.length} เครื่อง (ชำรุด/ไม่พบ/ไม่ได้ใช้)</div>}
        </div>
        <button className="secondary" onClick={() => setPrintMode(true)}>🖨️ พิมพ์ใบสำรวจกระดาษ</button>
      </div>

      <div className="history-layout">
        {/* รายการเครื่อง */}
        <div className="card device-list" style={{ padding: 10 }}>
          <input ref={searchRef} autoFocus placeholder="พิมพ์รหัสเครื่อง / ชื่อผู้ใช้..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, padding: '0 4px 8px' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} /> แสดงเฉพาะที่ยังไม่สำรวจ ({assets.length - doneCount})
          </label>
          {list.map(a => {
            const s = surveyed[a.id]
            return (
              <button key={a.id} className={`device-row ${current?.id === a.id ? 'on' : ''}`} onClick={() => open(a)}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{a.asset_tag}</span>
                  {s && <span style={{ fontSize: '0.75rem' }}>{s.new_data?.condition === 'ok' ? '✅' : COND_LABEL[s.new_data?.condition]?.slice(0, 2)}</span>}
                </div>
                <div className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.model || '-'} · {empLabel(a.owner)}</div>
              </button>
            )
          })}
          {!list.length && <div className="muted" style={{ padding: 12, textAlign: 'center' }}>{onlyPending && doneCount === assets.length && assets.length ? '🎉 สำรวจครบทุกเครื่องแล้ว' : 'ไม่พบเครื่อง'}</div>}
        </div>

        {/* ฟอร์มสำรวจ */}
        <div>
          {!current && (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
              เลือกเครื่องจากรายการ (หรือพิมพ์รหัสที่ติดบนเครื่อง) แล้วกรอกว่าตอนนี้ใครใช้ อยู่ที่ไหน
            </div>
          )}
          {current && (
            <form className="card" onSubmit={save}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
                <h2 style={{ margin: 0 }}>{current.asset_tag}</h2>
                <span className="muted">{current.model}</span>
              </div>
              <div className="muted" style={{ marginBottom: 16 }}>
                ตามทะเบียนเดิม: ผู้ใช้ <strong>{empLabel(current.owner)}</strong>
                {empById[current.owner]?.position && <span> · ตำแหน่ง <strong>{empById[current.owner].position}</strong></span>}
                {' '}· สถานที่ <strong>{[current.building, current.position_detail, current.location].filter(Boolean).join(' · ') || '-'}</strong>
                {surveyed[current.id] && <span> · สำรวจแล้วเมื่อ {fmtDateTime(surveyed[current.id].created_at)} (บันทึกซ้ำได้)</span>}
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label>ผู้ใช้งานจริงตอนนี้</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input list="emp-list" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="พิมพ์รหัสหรือชื่อพนักงาน" />
                    <button type="button" className={parseOwner(form.owner) === '0000' ? 'primary' : 'secondary'} onClick={() => setForm({ ...form, owner: '0000' })} title="ไม่มีผู้ใช้ประจำ ใช้ร่วมกันในแผนก">🏢 ส่วนกลาง</button>
                    <button type="button" className={form.owner === '' ? 'primary' : 'secondary'} onClick={() => setForm({ ...form, owner: '', condition: form.condition === 'ok' ? 'spare' : form.condition })} title="ไม่มีคนใช้แล้ว เครื่องว่าง → จะตั้งสภาพเป็นเก็บสำรองให้">⛔ ไม่มีผู้ใช้</button>
                  </div>
                  <datalist id="emp-list">
                    {employees.filter(e => !isLeaver(e.name) && e.employee_id !== '0000').map(e => <option key={e.employee_id} value={`${e.employee_id} - ${e.name}${e.department ? ` (${e.department})` : ''}`} />)}
                  </datalist>
                  {form.owner === '' && <div className="muted" style={{ marginTop: 4, color: '#b45309' }}>→ ไม่มีผู้ใช้ประจำ: บันทึกแล้วชื่อเดิมจะถูกถอดออก และสถานะเครื่องเป็น "สำรอง"</div>}
                  {parseOwner(form.owner) && empById[parseOwner(form.owner)] && (
                    <div className="muted" style={{ marginTop: 4 }}>→ {empLabel(parseOwner(form.owner))}{empById[parseOwner(form.owner)].position ? ` · ตำแหน่ง ${empById[parseOwner(form.owner)].position}` : ''}</div>
                  )}
                </div>
                <div>
                  <label>แผนกที่พบเครื่อง</label>
                  <input list="dept-list" value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} placeholder="เช่น บัญชี" />
                  <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <label>อาคาร</label>
                  <input list="bld-list" value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} placeholder="เช่น อาคารสำนักงาน / โรงงาน 1" />
                  <datalist id="bld-list">{buildings.map(b => <option key={b} value={b} />)}</datalist>
                </div>
                <div>
                  <label>ตำแหน่งที่ตั้ง (ชั้น / ห้อง / จุดวาง)</label>
                  <input list="pos-list" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="เช่น ชั้น 2 ห้องบัญชี โต๊ะ 3" />
                  <datalist id="pos-list">{positions.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>สภาพเครื่อง</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                    {CONDITIONS.map(c => (
                      <button type="button" key={c.v} className={form.condition === c.v ? 'primary' : 'secondary'} onClick={() => setForm({ ...form, condition: c.v })}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>หมายเหตุ</label>
                  <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="เช่น ย้ายมาจากฝ่ายขายเมื่อเดือนก่อน" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button className="primary" type="submit" disabled={saving} style={{ flex: 1 }}>{saving ? 'กำลังบันทึก...' : '💾 บันทึกและไปเครื่องถัดไป'}</button>
                <button className="secondary" type="button" onClick={() => setCurrent(null)}>ยกเลิก</button>
              </div>
              <div className="muted" style={{ marginTop: 10 }}>บันทึกแล้วทะเบียนทรัพย์สินจะอัปเดตผู้ใช้/สถานที่ทันที และเก็บประวัติการสำรวจไว้เป็นหลักฐาน</div>
            </form>
          )}

          {problems.length > 0 && !current && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 className="section-title">เครื่องที่พบปัญหาในรอบนี้</h3>
              {problems.map(a => (
                <div key={a.id} className="list-row">
                  <div style={{ flex: 1 }}><strong>{a.asset_tag}</strong> <span className="muted">{a.model}</span><div className="muted">{surveyed[a.id].new_data?.note}</div></div>
                  <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>{COND_LABEL[surveyed[a.id].new_data?.condition]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ใบสำรวจกระดาษ: เดินจดแล้วค่อยมากรอกในระบบ
function PaperSheet({ assets, empLabel, round, onBack }) {
  useEffect(() => { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t) }, [])
  return (
    <div>
      <div className="card no-print doc-toolbar">
        <button className="secondary" onClick={onBack}>← กลับ</button>
        <span className="muted">พิมพ์แล้วเดินสำรวจ จดผู้ใช้/สถานที่จริง แล้วมากรอกในหน้านี้</span>
        <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>🖨️ พิมพ์</button>
      </div>
      <div className="doc card landscape">
        <DocHeader title="ใบสำรวจเครื่องคอมพิวเตอร์และอุปกรณ์ IT (ใช้ปรับปรุงทะเบียน FQP-IT-01:01)" extra={[['รอบสำรวจ', round], ['จำนวน', `${assets.length} เครื่อง`]]} />
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th><th>รหัสเครื่อง</th><th>รุ่น</th><th>ผู้ใช้ตามทะเบียน</th>
              <th style={{ width: 140 }}>ผู้ใช้จริง</th><th style={{ width: 90 }}>อาคาร</th><th style={{ width: 110 }}>ตำแหน่ง (ชั้น/ห้อง)</th><th style={{ width: 100 }}>แผนก</th>
              <th style={{ width: 120 }}>สภาพ</th><th style={{ width: 150 }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => (
              <tr key={a.id} style={{ height: 30 }}>
                <td>{i + 1}</td><td><strong>{a.asset_tag}</strong></td><td>{a.model}</td><td>{empLabel(a.owner)}</td>
                <td></td><td></td><td></td><td></td><td style={{ fontSize: '0.7em', whiteSpace: 'nowrap' }}>☐ ปกติ ☐ ชำรุด<br />☐ สำรอง ☐ ไม่พบ</td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
        <SignatureBlock roles={[{ role: 'ผู้สำรวจ (เจ้าหน้าที่ IT)' }, { role: 'อนุมัติโดย (ผช.ผจก.ฝ่ายทรัพยากรบุคคล)' }]} />
      </div>
    </div>
  )
}
