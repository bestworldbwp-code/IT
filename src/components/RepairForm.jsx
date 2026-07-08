import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    asset_id: '',
    device_name: '',
    reporter_name: '',
    location: '',
    problem: '',
    priority: 'normal',
}

export default function RepairForm({ onSaved, presetAssetId }) {
    const [data, setData] = useState(() => presetAssetId ? { ...initial, asset_id: String(presetAssetId) } : initial)
    const [loading, setLoading] = useState(false)
    const [assets, setAssets] = useState([])

    useEffect(() => {
        async function loadAssets() {
            const client = getSupabase()
            if (!client) return
            const { data: list } = await client.from('assets').select('id, asset_tag, model').order('asset_tag')
            if (list) setAssets(list)
        }
        loadAssets()
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!data.problem.trim()) return alert('กรุณากรอกอาการเสีย')

        setLoading(true)
        const client = getSupabase()
        const { error } = await client.from('repair_requests').insert({
            asset_id: data.asset_id || null,
            device_name: data.device_name,
            reporter_name: data.reporter_name,
            location: data.location,
            problem: data.problem,
            priority: data.priority,
            status: 'pending',
        })
        setLoading(false)
        if (error) alert(error.message)
        else onSaved()
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>แจ้งซ่อมอุปกรณ์</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <label>อ้างอิงทรัพย์สิน (ถ้ามี)</label>
                    <select value={data.asset_id} onChange={(e) => setData({ ...data, asset_id: e.target.value })}>
                        <option value="">-- ไม่ระบุ / เลือกอุปกรณ์ --</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} - {a.model}</option>)}
                    </select>
                </div>
                <div>
                    <label>ชื่ออุปกรณ์ / เครื่อง</label>
                    <input value={data.device_name} onChange={(e) => setData({ ...data, device_name: e.target.value })} placeholder="เช่น Notebook ฝ่ายบัญชี" />
                </div>
                <div>
                    <label>ผู้แจ้ง</label>
                    <input value={data.reporter_name} onChange={(e) => setData({ ...data, reporter_name: e.target.value })} placeholder="ชื่อผู้แจ้ง" />
                </div>
                <div>
                    <label>สถานที่ / แผนก</label>
                    <input value={data.location} onChange={(e) => setData({ ...data, location: e.target.value })} placeholder="เช่น ชั้น 2 ฝ่ายบัญชี" />
                </div>
                <div>
                    <label>ระดับความเร่งด่วน</label>
                    <select value={data.priority} onChange={(e) => setData({ ...data, priority: e.target.value })}>
                        <option value="low">ไม่เร่งด่วน (Low)</option>
                        <option value="normal">ปกติ (Normal)</option>
                        <option value="high">ด่วน (High)</option>
                        <option value="urgent">ด่วนมาก (Urgent)</option>
                    </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>อาการเสีย / รายละเอียด *</label>
                    <textarea rows="4" required value={data.problem} onChange={(e) => setData({ ...data, problem: e.target.value })} placeholder="อธิบายอาการที่พบ..." />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังส่ง...' : 'ส่งเรื่องแจ้งซ่อม'}
            </button>
        </form>
    )
}
