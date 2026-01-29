import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    name: '',
    version: '',
    license_key: '',
    license_type: 'subscription',
    expiry_date: '',
    total_licenses: 1,
    assigned_to: '',
    vendor: '',
}

export default function SoftwareForm({ softwareId, onSaved }) {
    const [data, setData] = useState(initial)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)

    useEffect(() => {
        async function load() {
            if (!softwareId) {
                setData(initial)
                return
            }
            const client = getSupabase()
            setFetching(true)
            const { data: soft, error } = await client.from('software').select('*').eq('id', softwareId).single()
            setFetching(false)
            if (!error) setData(soft)
        }
        load()
    }, [softwareId])

    async function handleSubmit(e) {
        e.preventDefault()
        const client = getSupabase()
        setLoading(true)
        const payload = { ...data }
        delete payload.id
        delete payload.created_at

        let res
        if (softwareId) {
            res = await client.from('software').update(payload).eq('id', softwareId)
        } else {
            res = await client.from('software').insert(payload)
        }
        setLoading(false)
        if (!res.error) onSaved()
        else alert(res.error.message)
    }

    if (fetching) return <div>กำลังโหลด...</div>

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>{softwareId ? 'แก้ไขข้อมูลซอฟต์แวร์' : 'บันทึกซอฟต์แวร์ใหม่'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <label>ชื่อซอฟต์แวร์ *</label>
                    <input required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="เช่น Adobe Creative Cloud" />
                </div>
                <div>
                    <label>ผู้ผลิต/Vendor</label>
                    <input value={data.vendor} onChange={(e) => setData({ ...data, vendor: e.target.value })} placeholder="เช่น Adobe Inc." />
                </div>
                <div>
                    <label>เวอร์ชัน</label>
                    <input value={data.version} onChange={(e) => setData({ ...data, version: e.target.value })} />
                </div>
                <div>
                    <label>ประเภทลิขสิทธิ์</label>
                    <select value={data.license_type} onChange={(e) => setData({ ...data, license_type: e.target.value })}>
                        <option value="subscription">Subscription (เช่ารายปี)</option>
                        <option value="perpetual">Perpetual (ซื้อขาด)</option>
                        <option value="open_source">Open Source / Free</option>
                    </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>License Key</label>
                    <input value={data.license_key} onChange={(e) => setData({ ...data, license_key: e.target.value })} />
                </div>
                <div>
                    <label>จำนวนสิทธิ์ (Licenses)</label>
                    <input type="number" value={data.total_licenses} onChange={(e) => setData({ ...data, total_licenses: parseInt(e.target.value) })} />
                </div>
                <div>
                    <label>ถือกรรมสิทธิ์โดย ( Assigned To)</label>
                    <input value={data.assigned_to} onChange={(e) => setData({ ...data, assigned_to: e.target.value })} placeholder="ชื่อพนักงานหรือรหัส" />
                </div>
                <div>
                    <label>วันหมดอายุสัญญา/ลิขสิทธิ์</label>
                    <input type="date" value={data.expiry_date || ''} onChange={(e) => setData({ ...data, expiry_date: e.target.value })} />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลซอฟต์แวร์'}
            </button>
        </form>
    )
}
