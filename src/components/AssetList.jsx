import { useEffect, useState } from 'react'
import { getSupabase, isEnvReady } from '../supabaseClient.js'

export default function AssetList() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setError('')
    const client = getSupabase()
    if (!client) {
      setError('ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL/ANON_KEY')
      return
    }
    setLoading(true)
    const { data, error: err } = await client
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setItems(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>รายการล่าสุด</h2>
        <button onClick={load} disabled={loading}>{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</button>
      </div>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
            <div><b>{it.asset_tag}</b> • {it.serial} • {it.model}</div>
            <div>{it.cpu} • {it.ram} • {it.storage}</div>
            <div>{it.owner} • {it.location} • {it.status}</div>
          </div>
        ))}
        {!items.length && <div>ยังไม่มีข้อมูล</div>}
      </div>
    </div>
  )
}
