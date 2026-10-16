import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { useEmployees, EmployeeName } from '../useEmployees.jsx'
import { byTag, textMatch, exportCSV, today } from '../audit/docs.jsx'

export default function ComputerList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const emp = useEmployees()

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client.from('computers').select('*').order('computer_id', { ascending: true })
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems((data || []).sort(byTag('computer_id')))
    }
    useEffect(() => { load() }, [])

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้จากทะเบียนคอมพิวเตอร์ชุดเดิม?\n(ทะเบียนหลักอยู่ที่หน้า "เครื่องและอุปกรณ์ IT")')) return
        const client = getSupabase()
        const { error } = await client.from('computers').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const visible = items.filter(it => textMatch(search, it.computer_id, it.spec, it.user_id, emp[it.user_id]?.name, it.loan_borrower_name, it.asset_type, it.remarks))

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_computers_${today()}.csv`, ['รหัสเครื่องจักร', 'ชนิด', 'สเปก', 'รหัสผู้ใช้', 'ชื่อผู้ใช้', 'ผู้ยืม', 'ประวัติซ่อม', 'หมายเหตุ'],
            visible.map(it => [it.computer_id, it.asset_type, it.spec, it.user_id, it.user_id === '0000' ? 'เครื่องส่วนกลาง' : (emp[it.user_id]?.name || ''), it.loan_borrower_name, it.repair_history, it.remarks]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหา รหัสเครื่องจักร, สเปก, ชื่อหรือรหัสผู้ใช้..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="secondary" onClick={doExport} disabled={!visible.length}>📥 Export CSV</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '10px 16px' }}>รหัสเครื่องจักร</th>
                            <th style={{ padding: '10px 16px' }}>Capacity / สเปก</th>
                            <th style={{ padding: '10px 16px' }}>ผู้ใช้งาน / ผู้ยืม</th>
                            <th style={{ padding: '10px 16px' }}>ชนิด</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{it.computer_id}</td>
                                <td style={{ padding: '10px 16px', fontSize: '0.875rem' }}>{it.spec}</td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div><EmployeeName id={it.user_id} map={emp} />{it.loan_borrower_name && <div style={{ fontSize: '0.8rem', color: '#b45309' }}>ยืม: {it.loan_borrower_name}</div>}</div>
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
                        {!visible.length && !loading && (
                            <tr><td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
