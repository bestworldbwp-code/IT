import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function AssetList({ onEdit, readOnly }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  async function load() {
    setError('')
    const client = getSupabase()
    if (!client) return

    setLoading(true)
    let query = client.from('assets').select('*').order('created_at', { ascending: false })

    if (search) {
      query = query.or(`asset_tag.ilike.%${search}%,serial.ilike.%${search}%,model.ilike.%${search}%,owner.ilike.%${search}%`)
    }

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    const { data, error: err } = await query.limit(100)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setItems(data || [])
  }

  async function deleteItem(id) {
    if (!confirm('ยืนยันการลบทรัพย์สินนี้?')) return
    const client = getSupabase()
    const { error: err } = await client.from('assets').delete().eq('id', id)
    if (err) {
      alert(err.message)
    } else {
      load()
    }
  }

  const exportToCSV = () => {
    if (!items.length) return
    const headers = ['Asset Tag', 'Serial', 'Model', 'CPU', 'RAM', 'Storage', 'Owner', 'Location', 'Purchase Date', 'Status', 'Confidentiality']
    const csvData = items.map(it => [
      it.asset_tag, it.serial, it.model, it.cpu, it.ram, it.storage, it.owner, it.location, it.purchase_date, it.status, it.confidentiality_level
    ].map(v => `"${v || ''}"`).join(','))

    const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `it_assets_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const [qrAsset, setQrAsset] = useState(null)

  // ลิงก์ที่ฝังใน QR: สแกนแล้วเปิดแอปมาที่เครื่องนี้ (แจ้งซ่อม/ยืม)
  const assetUrl = (tag) => `${window.location.origin}${window.location.pathname}?asset=${encodeURIComponent(tag)}`
  const qrImg = (tag, size = 250) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(assetUrl(tag))}`

  const printSingleQR = (tag) => {
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>QR ${tag}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;">
        <img src="${qrImg(tag, 300)}" style="width:300px;height:300px;" />
        <div style="font-size:24px;font-weight:700;margin-top:12px;">${tag}</div>
        <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
      </body></html>`)
    w.document.close()
  }

  const printAllQR = () => {
    if (!items.length) return
    const cards = items.map(it => `
      <div style="border:1px solid #ccc;border-radius:8px;padding:12px;text-align:center;page-break-inside:avoid;">
        <img src="${qrImg(it.asset_tag, 200)}" style="width:150px;height:150px;" />
        <div style="font-size:14px;font-weight:700;margin-top:6px;">${it.asset_tag}</div>
        <div style="font-size:11px;color:#555;">${it.model || ''}</div>
      </div>`).join('')
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>QR Codes - ทรัพย์สินทั้งหมด</title></head>
      <body style="font-family:sans-serif;padding:20px;">
        <h2>ป้าย QR Code ทรัพย์สิน (${items.length} เครื่อง)</h2>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">${cards}</div>
        <script>window.onload=function(){setTimeout(function(){window.print()},600)}<\/script>
      </body></html>`)
    w.document.close()
  }

  useEffect(() => {
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [search, filterStatus])

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_use': return '#dcfce7'
      case 'stock': return '#dbeafe'
      case 'repair': return '#fef3c7'
      case 'retired': return '#f3f4f6'
      default: return '#ffffff'
    }
  }

  const getStatusText = (status) => {
    const map = { in_use: 'ใช้งาน', stock: 'สต๊อก', repair: 'ซ่อม', retired: 'ปลดระวาง' }
    return map[status] || status
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>รายการทรัพย์สิน</h1>
        <button className="primary" onClick={load} disabled={loading}>
          {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
        <input
          placeholder="ค้นหา Asset Tag, Serial, รุ่น, หรือเจ้าของ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="in_use">ใช้งาน</option>
          <option value="stock">สต๊อก</option>
          <option value="repair">ซ่อม</option>
          <option value="retired">ปลดระวาง</option>
        </select>
        <button className="secondary" onClick={exportToCSV}>📥 Export CSV</button>
        <button className="secondary" onClick={printAllQR}>🏷️ พิมพ์ QR ทั้งหมด</button>
      </div>

      {qrAsset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setQrAsset(null)}>
          <div className="card" style={{ textAlign: 'center', padding: 40, maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>QR Code เครื่องนี้</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>สแกนเพื่อแจ้งซ่อม / ยืมเครื่องนี้</p>
            <img src={qrImg(qrAsset)} alt="QR Code" style={{ width: 220, height: 220, marginBottom: 16 }} />
            <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{qrAsset}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="secondary" style={{ flex: 1 }} onClick={() => printSingleQR(qrAsset)}>🖨️ พิมพ์</button>
              <button className="primary" style={{ flex: 1 }} onClick={() => setQrAsset(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
              <th style={{ padding: '16px 24px' }}>Asset Tag / Serial</th>
              <th style={{ padding: '16px 24px' }}>Model / Spec</th>
              <th style={{ padding: '16px 24px' }}>Owner / Location</th>
              <th style={{ padding: '16px 24px' }}>Status</th>
              <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{it.asset_tag}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>S/N: {it.serial}</div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontWeight: 500 }}>{it.model}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.cpu} / {it.ram} / {it.storage}</div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div>{it.owner || '-'}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.location || '-'}</div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className={`status-badge status-${it.status}`}>
                    {it.status === 'in_use' ? 'ใช้งาน' : it.status === 'stock' ? 'สำรอง' : it.status === 'repair' ? 'ส่งซ่อม' : 'ปลดระวาง'}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => setQrAsset(it.asset_tag)}>QR</button>
                    {!readOnly && <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>}
                    {!readOnly && <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it.id)}>ลบ</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  ไม่พบข้อมูลทรัพย์สิน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
