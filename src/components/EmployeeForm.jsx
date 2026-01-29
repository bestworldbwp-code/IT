import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    employee_id: '',
    name: '',
    position: '',
    department: '',
    email: '',
    username: '',
    desk_phone: '',
    user_share_drive_path: '',
}

export default function EmployeeForm({ employeeId, onSaved }) {
    const [data, setData] = useState(initial)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)

    useEffect(() => {
        async function load() {
            if (!employeeId) {
                setData(initial)
                return
            }
            const client = getSupabase()
            setFetching(true)
            const { data: emp, error } = await client.from('employees').select('*').eq('id', employeeId).single()
            setFetching(false)
            if (!error) setData(emp)
        }
        load()
    }, [employeeId])

    async function handleSubmit(e) {
        e.preventDefault()
        const client = getSupabase()
        setLoading(true)
        const payload = { ...data }
        delete payload.id
        delete payload.created_at

        let res
        if (employeeId) {
            res = await client.from('employees').update(payload).eq('id', employeeId)
        } else {
            res = await client.from('employees').insert(payload)
        }
        setLoading(false)
        if (!res.error) onSaved()
        else alert(res.error.message)
    }

    if (fetching) return <div>กำลังโหลด...</div>

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>{employeeId ? 'แก้ไขข้อมูลพนักงาน' : 'บันทึกพนักงานใหม่'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <label>รหัสพนักงาน *</label>
                    <input required value={data.employee_id} onChange={(e) => setData({ ...data, employee_id: e.target.value })} placeholder="เช่น 66001" />
                </div>
                <div>
                    <label>ชื่อ-นามสกุล *</label>
                    <input required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
                </div>
                <div>
                    <label>ตำแหน่ง</label>
                    <input value={data.position} onChange={(e) => setData({ ...data, position: e.target.value })} />
                </div>
                <div>
                    <label>แผนก</label>
                    <input value={data.department} onChange={(e) => setData({ ...data, department: e.target.value })} />
                </div>
                <div>
                    <label>อีเมล</label>
                    <input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
                </div>
                <div>
                    <label>เบอร์โทรศัพท์ (โต๊ะ)</label>
                    <input value={data.desk_phone} onChange={(e) => setData({ ...data, desk_phone: e.target.value })} />
                </div>
                <div>
                    <label>Username (System)</label>
                    <input value={data.username} onChange={(e) => setData({ ...data, username: e.target.value })} />
                </div>
                <div>
                    <label>Share Drive Path</label>
                    <input value={data.user_share_drive_path} onChange={(e) => setData({ ...data, user_share_drive_path: e.target.value })} placeholder="\\server\share\..." />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลพนักงาน'}
            </button>
        </form>
    )
}
