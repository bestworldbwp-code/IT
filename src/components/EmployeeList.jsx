import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { textMatch, exportCSV, today, isLeaver } from '../audit/docs.jsx'

export default function EmployeeList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [showLeavers, setShowLeavers] = useState(false)

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client.from('employees').select('*').order('employee_id', { ascending: true })
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems(data || [])
    }
    useEffect(() => { load() }, [])

    async function deleteItem(it) {
        if (!confirm(`ลบ ${it.name} ออกจากทะเบียน?\n\nถ้าพนักงานลาออก แนะนำให้แก้ชื่อเป็น "[ลาออก] ชื่อ" แทนการลบ เพื่อให้ประวัติเครื่องยังอ้างถึงได้`)) return
        const client = getSupabase()
        const { error } = await client.from('employees').delete().eq('id', it.id)
        if (error) alert(error.code === '23503' ? 'ลบไม่ได้ — พนักงานคนนี้มีประวัติยืม-คืนอยู่ในระบบ' : error.message)
        else load()
    }

    const leaverCount = items.filter(it => isLeaver(it.name)).length
    const visible = items.filter(it =>
        (showLeavers || !isLeaver(it.name)) &&
        textMatch(search, it.employee_id, it.name, it.department, it.position, it.email, it.username))

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_employees_${today()}.csv`, ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'แผนก', 'อีเมล', 'เบอร์โต๊ะ', 'Username'],
            visible.map(it => [it.employee_id, it.name, it.position, it.department, it.email, it.desk_phone, it.username]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหาชื่อ, รหัสพนักงาน, แผนก, หรือตำแหน่ง..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={showLeavers} onChange={e => setShowLeavers(e.target.checked)} /> แสดงคนที่ลาออก ({leaverCount})
                </label>
                <button className="secondary" onClick={doExport} disabled={!visible.length}>📥 Export CSV</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '10px 16px' }}>รหัสพนักงาน</th>
                            <th style={{ padding: '10px 16px' }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '10px 16px' }}>ตำแหน่ง / แผนก</th>
                            <th style={{ padding: '10px 16px' }}>อีเมล / เบอร์ติดต่อ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>{it.employee_id}</td>
                                <td style={{ padding: '10px 16px', fontWeight: 600, color: isLeaver(it.name) ? '#991b1b' : undefined }}>{it.name}</td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div>{it.position}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.department}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div>{it.email}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.desk_phone}</div>
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    {!readOnly && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>
                                            <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it)}>ลบ</button>
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
