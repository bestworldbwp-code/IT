import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { isLeaver, today } from '../audit/docs.jsx'

// stacked = โหมดหน้าสแกน QR สาธารณะ (ไม่ต้อง login) — ไม่แสดงรหัสพนักงาน
export default function LoanForm({ onSaved, presetAssetId, stacked }) {
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState('')
    const [assets, setAssets] = useState([])
    const [employees, setEmployees] = useState([])
    const busy = useRef(false)
    const [formData, setFormData] = useState({
        asset_id: presetAssetId ? String(presetAssetId) : '',
        employee_id: '',
        due_date: '',
        remarks: ''
    })

    async function loadOptions() {
        const client = getSupabase()
        if (!client) return
        setLoadError('')
        const [a, e] = await Promise.all([
            client.from('assets').select('id, asset_tag, model').order('asset_tag'),
            client.from('employees').select('employee_id, name').order('name'),
        ])
        if (a.error || e.error) { setLoadError((a.error || e.error).message); return }
        setAssets(a.data || [])
        setEmployees((e.data || []).filter(x => !isLeaver(x.name) && x.employee_id !== '0000'))
    }
    useEffect(() => { loadOptions() }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.asset_id || !formData.employee_id) return alert('กรุณาเลือกเครื่องและผู้ยืม')
        if (busy.current) return
        busy.current = true
        setLoading(true)
        try {
            const client = getSupabase()
            // เครื่องเดียวยืมซ้อนกันไม่ได้ — เดิมสแกนแล้วกดยืมซ้ำได้เรื่อย ๆ
            const { data: active, error: chkErr } = await client.from('loans')
                .select('id, employee:employees!loans_employee_id_fkey (name)')
                .eq('asset_id', formData.asset_id).eq('status', 'active').limit(1)
            if (chkErr) return alert('ตรวจสอบการยืมไม่สำเร็จ: ' + chkErr.message)
            if (active?.length) {
                const who = active[0].employee?.name || 'มีผู้ยืมอยู่'
                if (stacked) return alert(`เครื่องนี้ถูกยืมอยู่แล้ว (${who}) — กรุณาติดต่อเจ้าหน้าที่ IT`)
                if (!confirm(`เครื่องนี้ยังไม่ได้คืนจากการยืมครั้งก่อน (${who})\nบันทึกการยืมใหม่ซ้อนไปเลยไหม?`)) return
            }
            const { error } = await client.from('loans').insert([{
                asset_id: formData.asset_id,
                employee_id: formData.employee_id,
                loan_date: today(), // ค่าเริ่มต้นของฐานข้อมูลเป็นเวลา UTC — ช่วงตี 0–7 จะได้วันที่ของเมื่อวาน
                due_date: formData.due_date || null,
                remarks: formData.remarks.trim(),
                status: 'active'
            }])
            if (error) alert(error.message)
            else onSaved()
        } finally {
            busy.current = false
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {loadError && (
                <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
                    โหลดรายชื่อไม่สำเร็จ ({loadError}) <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={loadOptions}>ลองใหม่</button>
                </div>
            )}
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div className="form-group">
                    <label>เครื่อง (M/C Code)</label>
                    <select
                        value={formData.asset_id}
                        onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                        required
                    >
                        <option value="">-- เลือกรายการ --</option>
                        {assets.map(a => (
                            <option key={a.id} value={a.id}>{a.asset_tag} - {a.model}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>ผู้ยืม (พนักงาน)</label>
                    <select
                        value={formData.employee_id}
                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                        required
                    >
                        <option value="">-- เลือกพนักงาน --</option>
                        {employees.map(e => (
                            <option key={e.employee_id} value={e.employee_id}>{stacked ? e.name : `${e.name} (${e.employee_id})`}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>กำหนดคืน (ถ้ารู้)</label>
                    <input
                        type="date"
                        min={today()}
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>หมายเหตุ</label>
                    <input
                        placeholder="เช่น ยืมไปไซด์งาน..."
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    />
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <button type="submit" className="primary" disabled={loading}>
                    {loading ? 'กำลังบันทึก...' : 'บันทึกการยืม'}
                </button>
            </div>
        </form>
    )
}
