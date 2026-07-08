import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function MaintenanceList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client
            .from('maintenance_logs')
            .select('*, assets(asset_tag, model), asset_id, next_check_date')
            .order('created_at', { ascending: false })

        if (search) {
            query = query.or(`description.ilike.%${search}%,log_type.ilike.%${search}%,performed_by.ilike.%${search}%`)
        }

        const { data, error } = await query
        setLoading(false)
        if (!error) setItems(data || [])
    }

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบประวัตินี้?')) return
        const client = getSupabase()
        const { error } = await client.from('maintenance_logs').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Asset ID', 'Log Type', 'Description', 'Performed By', 'Cost', 'Next Check']
        const csvData = items.map(it => [
            it.asset_id, it.log_type, it.description, it.performed_by, it.cost, it.next_check_date
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_maintenance_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    useEffect(() => {
        load()
    }, [search])

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหาคำอธิบาย, ประเภท, หรือผู้ดำเนินการ..."
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
                            <th style={{ padding: '10px 16px' }}>วันที่</th>
                            <th style={{ padding: '10px 16px' }}>อ้างอิงทรัพย์สิน</th>
                            <th style={{ padding: '10px 16px' }}>ประเภทงาน</th>
                            <th style={{ padding: '10px 16px' }}>รายละเอียด</th>
                            <th style={{ padding: '10px 16px' }}>ผู้ดำเนินการ / ค่าใช้จ่าย</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>{new Date(it.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.assets?.asset_tag}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.assets?.model}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        background: it.log_type === 'repair' ? '#fee2e2' : '#f1f5f9'
                                    }}>
                                        {it.log_type}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 16px', maxWidth: 300 }}>{it.description}</td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div>{it.performed_by}</div>
                                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>฿{it.cost?.toLocaleString()}</div>
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    {!readOnly && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>
                                            <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it.id)}>ลบ</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!items.length && !loading && (
                            <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center' }}>ไม่มีประวัติการบำรุงรักษา</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
