import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function SoftwareList({ onEdit, readOnly }) {
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

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('software').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Name', 'Vendor', 'Version', 'License Key', 'Expiry Date', 'Total']
        const csvData = items.map(it => [
            it.name, it.vendor, it.version, it.license_key, it.expiry_date, it.total_licenses
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_software_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    useEffect(() => {
        const timer = setTimeout(load, 300)
        return () => clearTimeout(timer)
    }, [search])

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหาชื่อซอฟต์แวร์, Vendor, หรือ License Key..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="secondary" onClick={exportToCSV}>📥 Export CSV</button>
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
                                    {!readOnly && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>
                                            <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it.id)}>ลบ</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
