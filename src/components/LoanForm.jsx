import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function LoanForm({ onSaved, presetAssetId, stacked }) {
    const [loading, setLoading] = useState(false)
    const [assets, setAssets] = useState([])
    const [employees, setEmployees] = useState([])
    const [formData, setFormData] = useState({
        asset_id: presetAssetId ? String(presetAssetId) : '',
        employee_id: '',
        due_date: '',
        remarks: ''
    })

    useEffect(() => {
        async function loadOptions() {
            const client = getSupabase()

            // Load available assets (e.g. status in_use/stock and not currently in active loan)
            // For simplicity, we just load all assets and maybe filter later or just rely on manual check
            const { data: assetData } = await client
                .from('assets')
                .select('id, asset_tag, model')
                .order('asset_tag')

            const { data: empData } = await client
                .from('employees')
                .select('employee_id, name')
                .order('name')

            setAssets(assetData || [])
            setEmployees(empData || [])
        }
        loadOptions()
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.asset_id || !formData.employee_id) return alert('กรุณาเลือกเครื่องและผู้ยืม')

        setLoading(true)
        const client = getSupabase()
        const { error } = await client
            .from('loans')
            .insert([
                {
                    asset_id: formData.asset_id,
                    employee_id: formData.employee_id,
                    due_date: formData.due_date || null,
                    remarks: formData.remarks,
                    status: 'active'
                }
            ])

        setLoading(false)
        if (error) alert(error.message)
        else onSaved()
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div className="form-group">
                    <label>เลือกเครื่อง / อุปกรณ์</label>
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
                            <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>กำหนดคืน (ถ้ารู้)</label>
                    <input
                        type="date"
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
