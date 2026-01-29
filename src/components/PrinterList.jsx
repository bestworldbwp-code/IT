import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function PrinterList({ onEdit }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client.from('printers').select('*').order('printer_id', { ascending: true })
        if (search) {
            query = query.or(`printer_id.ilike.%${search}%,model.ilike.%${search}%`)
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
                    placeholder="ค้นหา Printer ID หรือรุ่น..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '16px 24px' }}>Printer ID</th>
                            <th style={{ padding: '16px 24px' }}>รุ่น/โมเดล</th>
                            <th style={{ padding: '16px 24px' }}>ผู้ใช้งานหลัก</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px', fontWeight: 600 }}>{it.printer_id}</td>
                                <td style={{ padding: '16px 24px' }}>{it.model}</td>
                                <td style={{ padding: '16px 24px' }}>{it.user_id || '-'}</td>
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
