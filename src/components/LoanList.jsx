import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function LoanList({ onNewLoan, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)

        // Join with assets and employees
        let { data, error } = await client
            .from('loans')
            .select(`
        *,
        assets (asset_tag, model),
        employee:employees!loans_employee_id_fkey (name)
      `)
            .order('created_at', { ascending: false })

        if (search) {
            // Simple client-side search for demo, or refine query
            data = data.filter(it =>
                it.assets?.asset_tag?.toLowerCase().includes(search.toLowerCase()) ||
                it.employee?.name?.toLowerCase().includes(search.toLowerCase())
            )
        }

        setLoading(false)
        if (!error) setItems(data || [])
    }

    async function markAsReturned(id) {
        if (!confirm('ยืนยันการคืนอุปกรณ์?')) return
        const client = getSupabase()
        const { error } = await client
            .from('loans')
            .update({
                status: 'returned',
                return_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', id)

        if (!error) load()
    }

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Asset Tag', 'Model', 'Borrower', 'Loan Date', 'Due Date', 'Return Date', 'Status']
        const csvData = items.map(it => [
            it.assets?.asset_tag,
            it.assets?.model,
            it.employee?.name,
            it.loan_date,
            it.due_date,
            it.return_date,
            it.status
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_loans_export_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    useEffect(() => {
        load()
    }, [search])

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                <input
                    placeholder="ค้นหา Asset Tag หรือชื่อพนักงาน..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="secondary" onClick={exportToCSV}>📥 Export CSV</button>
                {!readOnly && <button className="primary" onClick={onNewLoan}>+ ยืมเครื่องใหม่</button>}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '16px 24px' }}>ครุภัณฑ์ / รุ่น</th>
                            <th style={{ padding: '16px 24px' }}>ผู้ยืม</th>
                            <th style={{ padding: '16px 24px' }}>วันที่ยืม</th>
                            <th style={{ padding: '16px 24px' }}>กำหนดคืน</th>
                            <th style={{ padding: '16px 24px' }}>สถานะ</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.assets?.asset_tag || 'N/A'}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.assets?.model}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>{it.employee?.name || it.employee_id}</td>
                                <td style={{ padding: '16px 24px' }}>{it.loan_date}</td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span style={{ color: it.status === 'active' && new Date(it.due_date) < new Date() ? 'red' : 'inherit' }}>
                                        {it.due_date}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span className={`badge ${it.status}`}>
                                        {it.status === 'active' ? 'กำลังยืม' : it.status === 'returned' ? 'คืนแล้ว' : 'เกินกำหนด'}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                    {it.status === 'active' && !readOnly && (
                                        <button className="secondary" onClick={() => markAsReturned(it.id)}>คืนเครื่อง</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {loading ? 'กำลังโหลด...' : 'ไม่พบข้อมูลการยืม'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
