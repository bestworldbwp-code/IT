import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getSupabase } from '../supabaseClient.js'
import { useEmployees, EmployeeName } from '../useEmployees.jsx'
import { assetUrl, machineName, byTag, tagType, textMatch, exportCSV, today, TagLink } from '../audit/docs.jsx'

const STATUS_TH = { in_use: 'ใช้งาน', stock: 'สำรอง', repair: 'ส่งซ่อม', retired: 'ปลดระวาง' }
const TYPES = { COM: 'คอมพิวเตอร์', NB: 'โน้ตบุ๊ก', PNT: 'เครื่องพิมพ์', SRV: 'เซิร์ฟเวอร์', NET: 'เครือข่าย' }

export default function AssetList({ onEdit, readOnly }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all') // ประเภทจากรหัส AAA-BB-CC: COM / PNT / NB ...
  const [qr, setQr] = useState(null) // { tag, src }
  const emp = useEmployees()

  // โหลดทั้งหมดครั้งเดียวแล้วกรองในเครื่อง — ค้นหาด้วยชื่อพนักงานได้ และข้อความที่มี , ( ) ไม่ทำให้ query พัง
  async function load() {
    setError('')
    const client = getSupabase()
    if (!client) return
    setLoading(true)
    const { data, error: err } = await client.from('assets').select('*').order('asset_tag', { ascending: true }).limit(5000)
    setLoading(false)
    if (err) { setError(err.message); return }
    setItems((data || []).sort(byTag('asset_tag')))
  }
  useEffect(() => { load() }, [])

  async function deleteItem(it) {
    const msg = `ลบ ${it.asset_tag} ออกจากทะเบียนถาวร?\n\n⚠️ ประวัติบำรุงรักษาและประวัติยืม-คืนของเครื่องนี้จะถูกลบไปด้วย\nถ้าเครื่องเสีย/เลิกใช้ ให้กด "แก้ไข" แล้วเปลี่ยนสถานะเป็น "ปลดระวาง" แทน (ประวัติยังอยู่สำหรับออดิท)`
    if (!confirm(msg)) return
    const client = getSupabase()
    const { error: err } = await client.from('assets').delete().eq('id', it.id)
    if (err) alert(err.message)
    else load()
  }

  const typeCounts = items.reduce((m, it) => { const t = tagType(it.asset_tag); m[t] = (m[t] || 0) + 1; return m }, {})
  const visible = items.filter(it =>
    (filterType === 'all' || tagType(it.asset_tag) === filterType) &&
    (filterStatus === 'all' || it.status === filterStatus) &&
    textMatch(search, it.asset_tag, it.serial, it.model, it.owner, emp[it.owner]?.name, it.location, it.building, it.position_detail)
  )

  const doExport = () => {
    if (!visible.length) return
    exportCSV(`it_assets_${today()}.csv`,
      ['รหัสเครื่องจักร', 'ชื่อเครื่องจักร', 'S/N', 'รุ่น', 'CPU', 'RAM', 'Storage', 'รหัสผู้ใช้', 'ชื่อผู้ใช้', 'แผนก/สถานที่', 'อาคาร', 'ตำแหน่ง', 'วันรับเข้า', 'สถานะ'],
      visible.map(it => [it.asset_tag, machineName(it.asset_tag), it.serial, it.model, it.cpu, it.ram, it.storage, it.owner,
        it.owner === '0000' ? 'เครื่องส่วนกลาง' : (emp[it.owner]?.name || ''), it.location, it.building, it.position_detail, it.purchase_date, STATUS_TH[it.status] || it.status]))
  }

  // QR สร้างในเครื่อง (เดิมเรียกเว็บภายนอก api.qrserver.com — ไม่มีเน็ตก็ใช้ไม่ได้)
  async function openQr(tag) {
    const src = await QRCode.toDataURL(assetUrl(tag), { margin: 1, width: 440, errorCorrectionLevel: 'M' })
    setQr({ tag, src })
  }
  const printSingleQR = ({ tag, src }) => {
    const w = window.open('', '_blank')
    if (!w) return alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up แล้วลองอีกครั้ง หรือใช้เมนู "ป้าย QR ติดเครื่อง"')
    w.document.write(`
      <html><head><title>QR ${tag}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;">
        <img src="${src}" style="width:300px;height:300px;" />
        <div style="font-size:14px;margin-top:8px;">${machineName(tag)}</div>
        <div style="font-size:24px;font-weight:700;">${tag}</div>
        <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
      </body></html>`)
    w.document.close()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={filterType === 'all' ? 'primary' : 'secondary'} onClick={() => setFilterType('all')}>ทั้งหมด ({items.length})</button>
        {Object.keys(typeCounts).sort().map(t => (
          <button key={t} className={filterType === t ? 'primary' : 'secondary'} onClick={() => setFilterType(t)}>
            {TYPES[t] || t} ({typeCounts[t]})
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
        <input
          placeholder="ค้นหา รหัสเครื่องจักร, S/N, รุ่น, ชื่อหรือรหัสผู้ใช้, สถานที่..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 180 }}>
          <option value="all">ทุกสถานะ</option>
          <option value="in_use">ใช้งาน</option>
          <option value="stock">สำรอง</option>
          <option value="repair">ส่งซ่อม</option>
          <option value="retired">ปลดระวาง</option>
        </select>
        <button className="secondary" onClick={doExport} disabled={!visible.length}>📥 Export CSV</button>
        <button className="secondary" onClick={() => { window.location.hash = 'qr_labels' }}>🏷️ พิมพ์ป้าย QR</button>
        <button className="ghost" onClick={load} disabled={loading} title="รีเฟรช">{loading ? '⏳' : '↻'}</button>
      </div>

      {qr && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setQr(null)}>
          <div className="card" style={{ textAlign: 'center', padding: 40, maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>QR Code เครื่องนี้</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>สแกนเพื่อแจ้งซ่อม / ยืมเครื่องนี้</p>
            <img src={qr.src} alt="QR Code" style={{ width: 220, height: 220, marginBottom: 16 }} />
            <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{qr.tag}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="secondary" style={{ flex: 1 }} onClick={() => printSingleQR(qr)}>🖨️ พิมพ์</button>
              <button className="primary" style={{ flex: 1 }} onClick={() => setQr(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="card" style={{ color: '#991b1b', background: '#fef2f2', marginBottom: 12 }}>⚠️ โหลดข้อมูลไม่สำเร็จ: {error}</div>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
              <th style={{ padding: '10px 16px' }}>รหัสเครื่องจักร / ชื่อเครื่องจักร</th>
              <th style={{ padding: '10px 16px' }}>รุ่น / Capacity</th>
              <th style={{ padding: '10px 16px' }}>ผู้ใช้งาน / สถานที่ติดตั้ง</th>
              <th style={{ padding: '10px 16px' }}>สถานะ</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div><TagLink tag={it.asset_tag} /></div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{machineName(it.asset_tag)}{it.serial ? ` · S/N ${it.serial}` : ''}</div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 500 }}>{it.model || '-'}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{[it.cpu, it.ram, it.storage].filter(Boolean).join(' / ')}</div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div><EmployeeName id={it.owner} map={emp} /></div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{[it.building, it.position_detail, it.location].filter(Boolean).join(' · ') || '-'}</div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span className={`status-badge status-${it.status}`}>{STATUS_TH[it.status] || it.status || '-'}</span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => openQr(it.asset_tag)}>QR</button>
                    {!readOnly && <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>}
                    {!readOnly && <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it)}>ลบ</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && !loading && (
              <tr>
                <td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
