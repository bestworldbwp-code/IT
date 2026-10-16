import { useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { DocHeader, SignatureBlock, DocToolbar, fmtDate, downloadText, toCSV, today, machineName, typeThai, byTag } from './docs.jsx'

const STATUS_TH = { in_use: 'ใช้งาน', stock: 'สำรอง', repair: 'ส่งซ่อม', retired: 'ปลดระวาง' }

// ทะเบียนรายชื่อเครื่องคอมพิวเตอร์และอุปกรณ์ IT (FQP-IT-01:01)
// คอลัมน์ตามแบบฟอร์มเดิม: ที่ | ชนิด | ชื่อเครื่องจักร | รุ่น | รหัสเครื่องจักร | Capacity | สถานที่ติดตั้ง | วันรับเข้า | RANK
// แยกตาราง Computer / Printer เหมือนชีตในไฟล์ Excel เดิม
export default function RegisterPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showUser, setShowUser] = useState(true)
  const [includeRetired, setIncludeRetired] = useState(false)

  async function load() {
    const client = getSupabase()
    if (!client) return
    setLoading(true); setError('')
    const [a, c, e] = await Promise.all([
      client.from('assets').select('*').order('asset_tag'),
      client.from('computers').select('computer_id, spec, asset_type, purchase_date, remarks'),
      client.from('employees').select('employee_id, name, department'),
    ])
    const err = a.error || c.error || e.error
    if (err) { setError(err.message); setLoading(false); return }

    const emp = Object.fromEntries((e.data || []).map(x => [x.employee_id, x]))
    const comp = Object.fromEntries((c.data || []).map(x => [x.computer_id, x]))

    setRows((a.data || []).sort(byTag('asset_tag')).map(x => {
      const cp = comp[x.asset_tag]
      const user = emp[x.owner]
      return {
        id: x.id, tag: x.asset_tag, type: typeThai(x.asset_tag, x.category), name: machineName(x.asset_tag),
        model: x.model || cp?.asset_type || '', capacity: [x.cpu, x.ram, x.storage].filter(Boolean).join(' / ') || cp?.spec || '',
        location: [x.building, x.position_detail, x.location || user?.department].filter(Boolean).join(' · '), received: x.purchase_date || cp?.purchase_date || '',
        rank: x.rank || 'A',
        user: x.owner === '0000' ? 'เครื่องส่วนกลาง' : user ? `${user.name}` : (x.owner || ''), status: x.status, remarks: cp?.remarks || '',
      }
    }))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => (includeRetired || r.status !== 'retired') &&
      (!q || [r.tag, r.name, r.model, r.capacity, r.user, r.location].some(v => String(v || '').toLowerCase().includes(q))))
  }, [rows, search, includeRetired])

  const groups = useMemo(() => {
    const g = {}
    filtered.forEach(r => { (g[r.type] = g[r.type] || []).push(r) })
    return Object.entries(g).sort(([a], [b]) => a === 'คอมพิวเตอร์' ? -1 : b === 'คอมพิวเตอร์' ? 1 : a.localeCompare(b))
  }, [filtered])

  const columns = [
    { label: 'ที่', get: (r, i) => i + 1 }, { label: 'ชนิด', get: r => r.type }, { label: 'ชื่อเครื่องจักร', key: 'name' },
    { label: 'รุ่น', key: 'model' }, { label: 'รหัสเครื่องจักร', key: 'tag' }, { label: 'Capacity', key: 'capacity' },
    { label: 'สถานที่ติดตั้ง', key: 'location' }, { label: 'วันรับเข้า', get: r => r.received || '' }, { label: 'RANK', key: 'rank' },
    ...(showUser ? [{ label: 'ผู้ใช้งาน', key: 'user' }, { label: 'สถานะ', get: r => STATUS_TH[r.status] || r.status }] : []),
  ]
  const exportCSV = () => {
    const parts = groups.map(([t, list]) => `${t}\n` + toCSV(list.map((r, i) => ({ ...r, _i: i })), columns.map(c => c.get ? { ...c, get: r => c.get(r, r._i) } : c)))
    downloadText(`FQP-IT-01-01_ทะเบียนเครื่อง_${today()}.csv`, parts.join('\n\n'), 'text/csv')
  }

  return (
    <div>
      <DocToolbar>
        <input placeholder="ค้นหา รหัส / ชื่อเครื่อง / รุ่น / ผู้ใช้..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={showUser} onChange={e => setShowUser(e.target.checked)} /> แสดงผู้ใช้งาน/สถานะ</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={includeRetired} onChange={e => setIncludeRetired(e.target.checked)} /> รวมที่ปลดระวาง</label>
        <button className="secondary" onClick={exportCSV} disabled={!filtered.length}>📥 Export CSV</button>
        <button className="ghost" onClick={load} disabled={loading}>↻</button>
      </DocToolbar>

      {error && <div className="card" style={{ color: '#991b1b', background: '#fef2f2', marginBottom: 16 }}>⚠️ {error}</div>}

      {loading && <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>กำลังโหลดทะเบียน...</div>}
      {!loading && !groups.length && <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>ไม่พบข้อมูล</div>}

      {groups.map(([type, list]) => (
        <div key={type} className="doc card landscape sheet" style={{ marginBottom: 16 }}>
          <DocHeader title="ทะเบียนรายชื่อเครื่องคอมพิวเตอร์และอุปกรณ์ IT" code="FQP-IT-01:01"
            extra={[['ประเภท', `${type} (${list.length} เครื่อง)`]]} />
          <table className="doc-table">
            <thead><tr>{columns.map(c => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{r.type} {i + 1}</td><td>{r.name}</td><td>{r.model || '-'}</td><td><strong>{r.tag}</strong></td>
                  <td>{r.capacity || '-'}</td><td>{r.location || '-'}</td><td>{r.received ? fmtDate(r.received) : ''}</td><td style={{ textAlign: 'center' }}>{r.rank}</td>
                  {showUser && <><td>{r.user}</td><td>{STATUS_TH[r.status] || r.status}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
          <SignatureBlock roles={[{ role: 'ผู้จัดทำ (เจ้าหน้าที่ IT)' }, { role: 'อนุมัติโดย (ผช.ผจก.ฝ่ายทรัพยากรบุคคล)' }]} />
        </div>
      ))}
    </div>
  )
}
