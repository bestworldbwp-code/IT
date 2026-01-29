import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function AssetList({ onEdit }) {
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

  const [qrUrl, setQrUrl] = useState(null)

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
      </div>

      {qrUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setQrUrl(null)}>
          <div className="card" style={{ textAlign: 'center', padding: 40 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 20 }}>Asset QR Code</h3>
            <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, marginBottom: 20 }} />
            <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{qrUrl.split('data=')[1]}</div>
            <button className="primary" style={{ marginTop: 20, width: '100%' }} onClick={() => setQrUrl(null)}>ปิด</button>
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
                    <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${it.asset_tag}`)}>QR</button>
                    <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>
                    <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it.id)}>ลบ</button>
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
