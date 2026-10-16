import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    name: '',
    category: 'Peripheral',
    stock_quantity: 0,
    min_stock_level: 5,
    location: '',
    remarks: '',
}

export default function SparePartsForm({ sparePartId, onSaved }) {
    const [data, setData] = useState(initial)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)

    useEffect(() => {
        async function load() {
            if (!sparePartId) {
                setData(initial)
                return
            }
            const client = getSupabase()
            setFetching(true)
            const { data: part, error } = await client.from('spare_parts').select('*').eq('id', sparePartId).single()
            setFetching(false)
            if (error) alert(error.message)
            else setData(part)
        }
        load()
    }, [sparePartId])

    async function handleSubmit(e) {
        e.preventDefault()
        const client = getSupabase()
        setLoading(true)
        const payload = { ...data, stock_quantity: parseInt(data.stock_quantity, 10) || 0, min_stock_level: parseInt(data.min_stock_level, 10) || 0 }
        delete payload.id
        delete payload.created_at

        let res
        if (sparePartId) {
            res = await client.from('spare_parts').update(payload).eq('id', sparePartId)
        } else {
            res = await client.from('spare_parts').insert(payload)
        }
        setLoading(false)
        if (!res.error) onSaved()
        else alert(res.error.message)
    }

    if (fetching) return <div>กำลังโหลด...</div>

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>{sparePartId ? 'แก้ไขข้อมูลอะไหล่' : 'เพิ่มอะไหล่ใหม่'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label>ชื่อรายการ *</label>
                    <input required value={data.name ?? ''} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="เช่น เมาส์ไร้สาย Logitech, หมึก HP 85A" />
                </div>
                <div>
                    <label>หมวดหมู่</label>
                    <select value={data.category ?? ''} onChange={(e) => setData({ ...data, category: e.target.value })}>
                        <option value="Peripheral">อุปกรณ์ต่อพ่วง (Keyboard/Mouse)</option>
                        <option value="Consumable">วัสดุสิ้นเปลือง (Toner/Ink)</option>
                        <option value="Component">ชิ้นส่วนภายใน (RAM/SSD/HDD)</option>
                        <option value="Network">อุปกรณ์เครือข่าย (Cables/Adapters)</option>
                    </select>
                </div>
                <div>
                    <label>สถานที่จัดเก็บ (Storage location)</label>
                    <input value={data.location ?? ''} onChange={(e) => setData({ ...data, location: e.target.value })} placeholder="ตู้เลขที่... / ชั้น..." />
                </div>
                <div>
                    <label>จำนวนคงเหลือตอนนี้</label>
                    <input type="number" value={data.stock_quantity ?? ''} min="0" onChange={(e) => setData({ ...data, stock_quantity: e.target.value })} />
                </div>
                <div>
                    <label>จุดที่ต้องสั่งซื้อเพิ่ม (Min Stock)</label>
                    <input type="number" value={data.min_stock_level ?? ''} min="0" onChange={(e) => setData({ ...data, min_stock_level: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label>หมายเหตุ</label>
                    <textarea rows="3" value={data.remarks ?? ''} onChange={(e) => setData({ ...data, remarks: e.target.value })} />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
        </form>
    )
}
