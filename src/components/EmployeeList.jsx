import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function EmployeeList({ onEdit }) {
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

    useEffect(() => {
        const timer = setTimeout(load, 300)
        return () => clearTimeout(timer)
    }, [search])

    return (
        <div>
            <div className="card" style={{ marginBottom: 24 }}>
                <input
                    placeholder="ค้นหาชื่อพนักงาน, รหัส, หรือแผนก..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '16px 24px' }}>รหัสพนักงาน</th>
                            <th style={{ padding: '16px 24px' }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '16px 24px' }}>ตำแหน่ง / แผนก</th>
                            <th style={{ padding: '16px 24px' }}>อีเมล / เบอร์ติดต่อ</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px' }}>{it.employee_id}</td>
                                <td style={{ padding: '16px 24px', fontWeight: 600 }}>{it.name}</td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div>{it.position}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.department}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div>{it.email}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.desk_phone}</div>
                                </td>
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
