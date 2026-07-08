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

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('computers').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
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
                            <th style={{ padding: '10px 16px' }}>Computer ID</th>
                            <th style={{ padding: '10px 16px' }}>Specification</th>
                            <th style={{ padding: '10px 16px' }}>User / Borrower</th>
                            <th style={{ padding: '10px 16px' }}>Type</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{it.computer_id}</td>
                                <td style={{ padding: '10px 16px', fontSize: '0.875rem' }}>{it.spec}</td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div>{it.user_id || it.loan_borrower_name || '-'}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>{it.asset_type}</td>
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
                    </tbody>
                </table>
            </div>
        </div>
    )
}
