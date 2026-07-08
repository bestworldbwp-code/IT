import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function EmployeeList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client.from('employees').select('*').order('name', { ascending: true })
        if (search) {
            query = query.or(`name.ilike.%${search}%,employee_id.ilike.%${search}%,department.ilike.%${search}%`)
        }
        const { data, error } = await query
        setLoading(false)
        if (!error) setItems(data || [])
    }

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('employees').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Employee ID', 'Name', 'Position', 'Department', 'Email', 'Username']
        const csvData = items.map(it => [
            it.employee_id, it.name, it.position, it.department, it.email, it.username
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_employees_${new Date().toISOString().split('T')[0]}.csv`
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
                    placeholder="ค้นหาชื่อ, รหัสพนักงาน, หรือแผนก..."
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
                            <th style={{ padding: '10px 16px' }}>รหัสพนักงาน</th>
                            <th style={{ padding: '10px 16px' }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '10px 16px' }}>ตำแหน่ง / แผนก</th>
                            <th style={{ padding: '10px 16px' }}>อีเมล / เบอร์ติดต่อ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>{it.employee_id}</td>
                                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{it.name}</td>
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
