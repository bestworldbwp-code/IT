import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function SoftwareList({ onEdit }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client.from('software').select('*').order('name', { ascending: true })
        if (search) {
            query = query.or(`name.ilike.%${search}%,vendor.ilike.%${search}%,license_key.ilike.%${search}%`)
        }
        const { data, error } = await query
        setLoading(false)
        if (!error) setItems(data || [])
    }

    useEffect(() => {
        const timer = setTimeout(load, 300)
        return () => clearTimeout(timer)
    }, [search])

    return (
        <div>
            <div className="card" style={{ marginBottom: 24 }}>
                <input
                    placeholder="ค้นหาชื่อซอฟต์แวร์, ผู้ผลิต, หรือ Key..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '16px 24px' }}>ชื่อซอฟต์แวร์</th>
                            <th style={{ padding: '16px 24px' }}>โมเดลลิขสิทธิ์ / สัญญา</th>
                            <th style={{ padding: '16px 24px' }}>Key / พนักงานที่ถือ</th>
                            <th style={{ padding: '16px 24px' }}>วันหมดอายุ</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.vendor} (v{it.version})</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div>{it.license_type}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>จำนวน: {it.total_licenses}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.license_key || '-'}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>ผู้ใช้: {it.assigned_to || '-'}</div>
                                </td>
                                <td style={{ padding: '16px 24px', color: (new Date(it.expiry_date) < new Date()) ? 'crimson' : 'inherit' }}>
                                    {it.expiry_date || 'N/A'}
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                    <button onClick={() => onEdit(it.id)}>แก้ไข</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
