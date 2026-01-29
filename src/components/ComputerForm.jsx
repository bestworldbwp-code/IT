import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    computer_id: '',
    spec: '',
    repair_history: '',
    user_id: '',
    asset_type: 'Desktop',
    loan_borrower_name: '',
    remarks: '',
}

export default function ComputerForm({ computerId, onSaved }) {
    const [data, setData] = useState(initial)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)

    useEffect(() => {
        async function load() {
            if (!computerId) {
                setData(initial)
                return
            }
            const client = getSupabase()
            setFetching(true)
            const { data: comp, error } = await client.from('computers').select('*').eq('id', computerId).single()
            setFetching(false)
            if (!error) setData(comp)
        }
        load()
    }, [computerId])

    async function handleSubmit(e) {
        e.preventDefault()
        const client = getSupabase()
        setLoading(true)
        const payload = { ...data }
        delete payload.id
        delete payload.created_at

        let res
        if (computerId) {
            res = await client.from('computers').update(payload).eq('id', computerId)
        } else {
            res = await client.from('computers').insert(payload)
        }
        setLoading(false)
        if (!res.error) onSaved()
    }

    if (fetching) return <div>กำลังโหลด...</div>

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>{computerId ? 'แก้ไขข้อมูลคอมพิวเตอร์' : 'บันทึกคอมพิวเตอร์ใหม่'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <label>Computer ID *</label>
                    <input required value={data.computer_id} onChange={(e) => setData({ ...data, computer_id: e.target.value })} placeholder="เช่น NB-IT-001" />
                </div>
                <div>
                    <label>ประเภท</label>
                    <select value={data.asset_type} onChange={(e) => setData({ ...data, asset_type: e.target.value })}>
                        <option value="Desktop">Desktop PC</option>
                        <option value="Notebook">Notebook / Laptop</option>
                        <option value="Server">Server</option>
                        <option value="Tablet">Tablet</option>
                    </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>สเป็กเครื่อง (Specification)</label>
                    <textarea rows="3" value={data.spec} onChange={(e) => setData({ ...data, spec: e.target.value })} placeholder="เช่น i5-12400, RAM 16GB, SSD 512GB" />
                </div>
                <div>
                    <label>รหัสพนักงานผู้ใช้งาน (User ID)</label>
                    <input value={data.user_id} onChange={(e) => setData({ ...data, user_id: e.target.value })} />
                </div>
                <div>
                    <label>ชื่อผู้ยืม (ถ้ามี)</label>
                    <input value={data.loan_borrower_name} onChange={(e) => setData({ ...data, loan_borrower_name: e.target.value })} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>ประวัติการซ่อม</label>
                    <textarea rows="3" value={data.repair_history} onChange={(e) => setData({ ...data, repair_history: e.target.value })} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>หมายเหตุ</label>
                    <input value={data.remarks} onChange={(e) => setData({ ...data, remarks: e.target.value })} />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
        </form>
    )
}
