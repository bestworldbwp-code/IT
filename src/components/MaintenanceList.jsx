import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function MaintenanceList({ onEdit }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client
            .from('maintenance_logs')
            .select('*, assets(asset_tag, model)')
            .order('created_at', { ascending: false })
        setLoading(false)
        if (!error) setItems(data || [])
    }

    useEffect(() => {
        load()
    }, [])

    return (
        <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '16px 24px' }}>วันที่</th>
                            <th style={{ padding: '16px 24px' }}>อ้างอิงทรัพย์สิน</th>
                            <th style={{ padding: '16px 24px' }}>ประเภทงาน</th>
                            <th style={{ padding: '16px 24px' }}>รายละเอียด</th>
                            <th style={{ padding: '16px 24px' }}>ผู้ดำเนินการ / ค่าใช้จ่าย</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px' }}>{new Date(it.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.assets?.asset_tag}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.assets?.model}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        background: it.log_type === 'repair' ? '#fee2e2' : '#f1f5f9'
                                    }}>
                                        {it.log_type}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px', maxWidth: 300 }}>{it.description}</td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div>{it.performed_by}</div>
                                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>฿{it.cost?.toLocaleString()}</div>
                                </td>
                            </tr>
                        ))}
                        {!items.length && !loading && (
                            <tr><td colSpan="5" style={{ padding: 40, textAlign: 'center' }}>ไม่มีประวัติการบำรุงรักษา</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
