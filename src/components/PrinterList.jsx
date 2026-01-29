import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function PrinterList({ onEdit, readOnly }) {
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

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Printer ID', 'Model', 'User ID']
        const csvData = items.map(it => [
            it.printer_id, it.model, it.user_id
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_printers_${new Date().toISOString().split('T')[0]}.csv`
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
                    placeholder="ค้นหา Printer ID หรือรุ่น..."
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
                                    {!readOnly && <button onClick={() => onEdit(it.id)}>แก้ไข</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
