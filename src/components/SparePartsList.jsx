import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { textMatch, exportCSV, today } from '../audit/docs.jsx'

const CATEGORY_TH = { Peripheral: 'อุปกรณ์ต่อพ่วง', Consumable: 'วัสดุสิ้นเปลือง', Component: 'ชิ้นส่วนภายใน', Network: 'อุปกรณ์เครือข่าย' }

export default function SparePartsList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client.from('spare_parts').select('*').order('name', { ascending: true })
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems(data || [])
    }
    useEffect(() => { load() }, [])

    // ปรับจำนวนบนหน้าจอทันที แล้วบันทึกค่าสุดท้ายครั้งเดียวเมื่อหยุดกด 0.6 วินาที
    // (เดิมยิงบันทึกทุกครั้งที่กด คำสั่งไปถึงสลับลำดับได้ ฐานข้อมูลจะได้ค่าเก่ากว่าที่เห็น)
    const timers = useRef({})
    const pendingQty = useRef({})
    function updateStock(id, delta) {
        if (readOnly) return
        const item = items.find(i => i.id === id)
        if (!item) return
        const base = pendingQty.current[id] ?? (item.stock_quantity || 0)
        const newQty = Math.max(0, base + delta)
        pendingQty.current[id] = newQty
        setItems(list => list.map(i => i.id === id ? { ...i, stock_quantity: newQty } : i))
        clearTimeout(timers.current[id])
        timers.current[id] = setTimeout(async () => {
            const qty = pendingQty.current[id]
            delete pendingQty.current[id]
            const { error } = await getSupabase().from('spare_parts').update({ stock_quantity: qty }).eq('id', id)
            if (error) { alert('บันทึกจำนวนไม่สำเร็จ: ' + error.message); load() }
        }, 600)
    }
    // ออกจากหน้าก่อนครบเวลา → บันทึกค่าที่ค้างอยู่ทันที
    useEffect(() => () => {
        for (const [id, qty] of Object.entries(pendingQty.current)) {
            clearTimeout(timers.current[id])
            getSupabase()?.from('spare_parts').update({ stock_quantity: qty }).eq('id', id).then(() => {})
        }
    }, [])

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('spare_parts').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const visible = items.filter(it => textMatch(search, it.name, it.category, CATEGORY_TH[it.category], it.location, it.remarks))
    const low = (it) => it.min_stock_level != null && (it.stock_quantity ?? 0) <= it.min_stock_level

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_spare_parts_${today()}.csv`, ['ชื่อ', 'หมวดหมู่', 'คงเหลือ', 'จุดสั่งซื้อ', 'สถานที่จัดเก็บ', 'หมายเหตุ'],
            visible.map(it => [it.name, CATEGORY_TH[it.category] || it.category, it.stock_quantity, it.min_stock_level, it.location, it.remarks]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหาชื่ออะไหล่, หมวดหมู่, หรือสถานที่..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="secondary" onClick={doExport} disabled={!visible.length}>📥 Export CSV</button>
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '10px 16px' }}>รายการอะไหล่ / หมวดหมู่</th>
                            <th style={{ padding: '10px 16px' }}>สถานที่จัดเก็บ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center' }}>จำนวนคงเหลือ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{CATEGORY_TH[it.category] || it.category}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>{it.location || '-'}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                        {!readOnly && <button className="secondary" style={{ padding: '4px 8px' }} onClick={() => updateStock(it.id, -1)}>-</button>}
                                        <span style={{ fontWeight: 700, color: low(it) ? 'crimson' : 'inherit', minWidth: 30 }}>{it.stock_quantity ?? 0}</span>
                                        {!readOnly && <button className="secondary" style={{ padding: '4px 8px' }} onClick={() => updateStock(it.id, 1)}>+</button>}
                                    </div>
                                    {low(it) && <div style={{ fontSize: '0.7rem', color: 'crimson', marginTop: 4 }}>ควรสั่งเพิ่ม! (Min: {it.min_stock_level})</div>}
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    {!readOnly && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => onEdit(it.id)}>แก้ไข</button>
                                            <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it.id)}>ลบ</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!visible.length && !loading && (
                            <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูลอะไหล่</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
