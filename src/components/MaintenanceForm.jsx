import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    asset_id: '',
    log_type: 'inspection',
    description: '',
    performed_by: '',
    cost: 0,
    next_check_date: '',
}

export default function MaintenanceForm({ onSaved }) {
    const [data, setData] = useState(initial)
    const [loading, setLoading] = useState(false)
    const [assets, setAssets] = useState([])

    useEffect(() => {
        async function loadAssets() {
            const client = getSupabase()
            const { data: list } = await client.from('assets').select('id, asset_tag, model').limit(100)
            if (list) setAssets(list)
        }
        loadAssets()
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        const client = getSupabase()
        setLoading(true)
        const { error } = await client.from('maintenance_logs').insert(data)
        setLoading(false)
        if (!error) onSaved()
        else alert(error.message)
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>บันทึกการบำรุงรักษา/ซ่อมแซม</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>อ้างอิงทรัพย์สิน *</label>
                    <select required value={data.asset_id} onChange={(e) => setData({ ...data, asset_id: e.target.value })}>
                        <option value="">-- เลือกอุปกรณ์ --</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} - {a.model}</option>)}
                    </select>
                </div>
                <div>
                    <label>ประเภทงาน</label>
                    <select value={data.log_type} onChange={(e) => setData({ ...data, log_type: e.target.value })}>
                        <option value="inspection">ตรวจเช็คประจำปี (Inspection)</option>
                        <option value="repair">งานซ่อม (Repair)</option>
                        <option value="update">อัปเกรด/อัปเดต (Update)</option>
                        <option value="backup_check">ตรวจสอบสำรองข้อมูล (Backup Check)</option>
                    </select>
                </div>
                <div>
                    <label>ผู้ดำเนินการ</label>
                    <input value={data.performed_by} onChange={(e) => setData({ ...data, performed_by: e.target.value })} placeholder="ชื่อช่าง/บริษัทนอก" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>รายละเอียดงาน</label>
                    <textarea rows="4" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
                </div>
                <div>
                    <label>ค่าใช้จ่าย (บาท)</label>
                    <input type="number" value={data.cost} onChange={(e) => setData({ ...data, cost: parseFloat(e.target.value) })} />
                </div>
                <div>
                    <label>วันตรวจเช็คครั้งถัดไป</label>
                    <input type="date" value={data.next_check_date} onChange={(e) => setData({ ...data, next_check_date: e.target.value })} />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกประวัติ'}
            </button>
        </form>
    )
}
