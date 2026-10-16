import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { useEmployees, EmployeeName } from '../useEmployees.jsx'
import { byTag, textMatch, exportCSV, today } from '../audit/docs.jsx'

export default function PrinterList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const emp = useEmployees()

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client.from('printers').select('*').order('printer_id', { ascending: true })
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems((data || []).sort(byTag('printer_id')))
    }
    useEffect(() => { load() }, [])

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้จากทะเบียนเครื่องพิมพ์ชุดเดิม?\n(ทะเบียนหลักอยู่ที่หน้า "เครื่องและอุปกรณ์ IT")')) return
        const client = getSupabase()
        const { error } = await client.from('printers').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const visible = items.filter(it => textMatch(search, it.printer_id, it.model, it.user_id, emp[it.user_id]?.name))

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_printers_${today()}.csv`, ['รหัสเครื่องจักร', 'รุ่น', 'รหัสผู้ใช้', 'ชื่อผู้ใช้'],
            visible.map(it => [it.printer_id, it.model, it.user_id, it.user_id === '0000' ? 'เครื่องส่วนกลาง' : (emp[it.user_id]?.name || '')]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหา รหัสเครื่องจักร, รุ่น, ชื่อหรือรหัสผู้ใช้..."
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
                            <th style={{ padding: '10px 16px' }}>รุ่น</th>
                            <th style={{ padding: '10px 16px' }}>ผู้ใช้งานหลัก</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{it.printer_id}</td>
                                <td style={{ padding: '10px 16px' }}>{it.model}</td>
                                <td style={{ padding: '10px 16px' }}><EmployeeName id={it.user_id} map={emp} /></td>
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
                            <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
