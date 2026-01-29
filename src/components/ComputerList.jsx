import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function ComputerList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client.from('computers').select('*').order('created_at', { ascending: false })
        if (search) {
            query = query.or(`computer_id.ilike.%${search}%,spec.ilike.%${search}%,loan_borrower_name.ilike.%${search}%`)
        }
        const { data, error } = await query
        setLoading(false)
        if (!error) setItems(data || [])
    }

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Computer ID', 'Type', 'Spec', 'User ID', 'Remarks']
        const csvData = items.map(it => [
            it.computer_id, it.asset_type, it.spec, it.user_id, it.remarks
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_computers_${new Date().toISOString().split('T')[0]}.csv`
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
                    placeholder="ค้นหา Computer ID, สเปก, หรือผู้ใช้..."
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
                            <th style={{ padding: '16px 24px' }}>Computer ID</th>
                            <th style={{ padding: '16px 24px' }}>Specification</th>
                            <th style={{ padding: '16px 24px' }}>User / Borrower</th>
                            <th style={{ padding: '16px 24px' }}>Type</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px', fontWeight: 600 }}>{it.computer_id}</td>
                                <td style={{ padding: '16px 24px', fontSize: '0.875rem' }}>{it.spec}</td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div>{it.user_id || it.loan_borrower_name || '-'}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>{it.asset_type}</td>
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
