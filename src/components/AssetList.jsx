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

  async function handleDelete(id) {
    if (!confirm('ยืนยันการลบทรัพย์สินนี้?')) return
    const client = getSupabase()
    const { error: err } = await client.from('assets').delete().eq('id', id)
    if (err) {
      alert(err.message)
    } else {
      load()
    }
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
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
              <th style={{ padding: '16px 24px' }}>Asset Tag / Serial</th>
              <th style={{ padding: '16px 24px' }}>Spec</th>
              <th style={{ padding: '16px 24px' }}>ผู้ถือครอง / สถานที่</th>
              <th style={{ padding: '16px 24px' }}>สถานะ</th>
              <th style={{ padding: '16px 24px', textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontWeight: 600 }}>{it.asset_tag}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.serial}</div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div>{it.model}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {it.cpu} • {it.ram} • {it.storage}
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div>{it.owner || '-'}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.location || '-'}</div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: getStatusColor(it.status)
                  }}>
                    {getStatusText(it.status)}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <button onClick={() => onEdit(it.id)} style={{ marginRight: 8, padding: '4px 12px' }}>แก้ไข</button>
                  <button onClick={() => handleDelete(it.id)} style={{ padding: '4px 12px', color: 'crimson' }}>ลบ</button>
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
