import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { today } from '../audit/docs.jsx'

const initial = {
    asset_id: '',
    log_type: 'repair',
    description: '',
    performed_by: '',
    cost: 0,
    next_check_date: '',
    reference_doc: '',
    remarks: '',
    log_date: '',
}
const blank = () => ({ ...initial, log_date: today() }) // วันที่ตามเวลาไทย คำนวณตอนเปิดฟอร์ม

export default function MaintenanceForm({ maintenanceId, onSaved }) {
    const [data, setData] = useState(blank)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(!!maintenanceId)
    const [loadFailed, setLoadFailed] = useState(false)
    const [assets, setAssets] = useState([])

    useEffect(() => {
        async function loadAssets() {
            const client = getSupabase()
            const { data: list } = await client.from('assets').select('id, asset_tag, model').order('asset_tag').limit(500)
            if (list) setAssets(list)
        }
        loadAssets()
    }, [])

    useEffect(() => {
        async function loadRecord() {
            if (!maintenanceId) {
                setData(blank())
                return
            }
            const client = getSupabase()
            setFetching(true); setLoadFailed(false)
            const { data: rec, error } = await client.from('maintenance_logs').select('*').eq('id', maintenanceId).single()
            setFetching(false)
            if (error) { setLoadFailed(true); alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message) }
            if (rec) setData({
                asset_id: rec.asset_id ?? '',
                log_type: rec.log_type ?? 'repair',
                description: rec.description ?? '',
                performed_by: rec.performed_by ?? '',
                cost: rec.cost ?? 0,
                next_check_date: rec.next_check_date ?? '',
                reference_doc: rec.reference_doc ?? '',
                remarks: rec.remarks ?? '',
                log_date: rec.log_date ?? String(rec.created_at || '').slice(0, 10),
            })
        }
        loadRecord()
    }, [maintenanceId])

    async function handleSubmit(e) {
        e.preventDefault()
        if (loadFailed) return alert('โหลดข้อมูลเดิมไม่สำเร็จ — ปิดแล้วเปิดใหม่ก่อนบันทึก (กันบันทึกค่าว่างทับของเดิม)')
        const client = getSupabase()
        setLoading(true)
        const payload = { ...data, next_check_date: data.next_check_date || null, log_date: data.log_date || null, cost: parseFloat(data.cost) || 0 }
        const { error } = maintenanceId
            ? await client.from('maintenance_logs').update(payload).eq('id', maintenanceId)
            : await client.from('maintenance_logs').insert(payload)
        setLoading(false)
        if (!error) onSaved()
        else alert(error.message)
    }

    if (fetching) return <div>กำลังโหลด...</div>

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>{maintenanceId ? 'แก้ไขบันทึกการซ่อม/บำรุงรักษา' : 'บันทึกการซ่อม/บำรุงรักษา (ลงประวัติเครื่อง FQP-IT-01:02)'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label>เครื่อง (M/C Code) *</label>
                    <select required value={data.asset_id} onChange={(e) => setData({ ...data, asset_id: e.target.value })}>
                        <option value="">-- เลือกอุปกรณ์ --</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} - {a.model}</option>)}
                    </select>
                </div>
                <div>
                    <label>วัน/เดือน/ปี *</label>
                    <input type="date" required value={data.log_date} onChange={(e) => setData({ ...data, log_date: e.target.value })} />
                </div>
                <div>
                    <label>ประเภทงาน</label>
                    <select value={data.log_type} onChange={(e) => setData({ ...data, log_type: e.target.value })}>
                        <option value="repair">ซ่อมแซม / แก้ไข</option>
                        <option value="parts">เปลี่ยนอะไหล่</option>
                        <option value="preventive">บำรุงรักษาตามแผน / ตรวจเช็ค</option>
                        <option value="update">ติดตั้ง / อัปเดตโปรแกรม</option>
                        <option value="other">อื่นๆ</option>
                        {!['repair', 'parts', 'preventive', 'update', 'other'].includes(data.log_type) && <option value={data.log_type}>{data.log_type} (ประเภทเดิม)</option>}
                    </select>
                </div>
                <div>
                    <label>ผู้ดำเนินการ</label>
                    <input required value={data.performed_by} onChange={(e) => setData({ ...data, performed_by: e.target.value })} placeholder="ชื่อช่าง/บริษัทนอก" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label>รายละเอียดการแก้ไข/บำรุงรักษา *</label>
                    <textarea rows="4" required value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
                </div>
                <div>
                    <label>ค่าใช้จ่าย (บาท)</label>
                    <input type="number" value={data.cost} onChange={(e) => setData({ ...data, cost: e.target.value })} />
                </div>
                <div>
                    <label>เอกสารอ้างอิง</label>
                    <input value={data.reference_doc} onChange={(e) => setData({ ...data, reference_doc: e.target.value })} placeholder="เช่น ใบแจ้งซ่อม No. 2510-001 / ใบสั่งซื้อ" />
                </div>
                <div>
                    <label>หมายเหตุ</label>
                    <input value={data.remarks} onChange={(e) => setData({ ...data, remarks: e.target.value })} />
                </div>
                <div>
                    <label>วันตรวจเช็คครั้งถัดไป</label>
                    <input type="date" value={data.next_check_date} onChange={(e) => setData({ ...data, next_check_date: e.target.value })} />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : (maintenanceId ? 'บันทึกการแก้ไข' : 'บันทึกประวัติ')}
            </button>
        </form>
    )
}
