import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { textMatch, exportCSV, today, fmtDate } from '../audit/docs.jsx'

const STATUS_TH = { active: 'กำลังยืม', returned: 'คืนแล้ว', overdue: 'เกินกำหนด' }

export default function LoanList({ onNewLoan, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client
            .from('loans')
            .select(`*, assets (asset_tag, model), employee:employees!loans_employee_id_fkey (name)`)
            .order('created_at', { ascending: false })
        setLoading(false)
        // เดิมกรองข้อมูลก่อนเช็ค error — ถ้าโหลดไม่สำเร็จขณะมีคำค้น หน้าจะพังทั้งหน้า
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems(data || [])
    }
    useEffect(() => { load() }, [])

    async function markAsReturned(id) {
        if (!confirm('ยืนยันการคืนอุปกรณ์?')) return
        const client = getSupabase()
        const { error } = await client.from('loans').update({ status: 'returned', return_date: today() }).eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    async function deleteLoan(it) {
        if (!confirm(`ลบรายการยืม ${it.assets?.asset_tag || ''} ของ ${it.employee?.name || it.employee_id} ?
(ใช้เมื่อบันทึกผิด — ถ้ายืมจริงและคืนแล้วให้กด "คืนเครื่อง" แทน)`)) return
        const { error } = await getSupabase().from('loans').delete().eq('id', it.id)
        if (error) alert(error.message)
        else load()
    }

    const t = today()
    const overdue = (it) => it.status === 'active' && it.due_date && it.due_date < t
    const visible = items.filter(it => textMatch(search, it.assets?.asset_tag, it.assets?.model, it.employee?.name, it.employee_id, it.remarks))

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_loans_${t}.csv`, ['รหัสเครื่องจักร', 'รุ่น', 'ผู้ยืม', 'รหัสผู้ยืม', 'วันที่ยืม', 'กำหนดคืน', 'วันที่คืน', 'สถานะ', 'หมายเหตุ'],
            visible.map(it => [it.assets?.asset_tag, it.assets?.model, it.employee?.name, it.employee_id, it.loan_date, it.due_date, it.return_date, overdue(it) ? 'เกินกำหนด' : (STATUS_TH[it.status] || it.status), it.remarks]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                <input
                    placeholder="ค้นหารหัสเครื่องจักร หรือชื่อ/รหัสผู้ยืม..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="secondary" onClick={doExport} disabled={!visible.length}>📥 Export CSV</button>
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '10px 16px' }}>รหัสเครื่องจักร / รุ่น</th>
                            <th style={{ padding: '10px 16px' }}>ผู้ยืม</th>
                            <th style={{ padding: '10px 16px' }}>วันที่ยืม</th>
                            <th style={{ padding: '10px 16px' }}>กำหนดคืน</th>
                            <th style={{ padding: '10px 16px' }}>สถานะ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.assets?.asset_tag || 'N/A'}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.assets?.model}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>{it.employee?.name || it.employee_id}</td>
                                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{fmtDate(it.loan_date)}</td>
                                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: overdue(it) ? 'crimson' : 'inherit', fontWeight: overdue(it) ? 600 : undefined }}>
                                    {it.due_date ? fmtDate(it.due_date) : '-'}
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <span className="badge" style={overdue(it) ? { background: '#fee2e2', color: '#b91c1c' } : it.status === 'returned' ? { background: '#dcfce7', color: '#15803d' } : { background: '#fef3c7', color: '#b45309' }}>
                                        {overdue(it) ? 'เกินกำหนด' : (STATUS_TH[it.status] || it.status)}
                                    </span>
                                    {it.return_date && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>คืน {fmtDate(it.return_date)}</div>}
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    {!readOnly && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            {it.status === 'active' && <button className="secondary" onClick={() => markAsReturned(it.id)}>คืนเครื่อง</button>}
                                            <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteLoan(it)}>ลบ</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
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
