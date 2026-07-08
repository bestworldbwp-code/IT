import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function SparePartsList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client.from('spare_parts').select('*').order('name', { ascending: true })
        if (search) {
            query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,location.ilike.%${search}%`)
        }
        const { data, error } = await query
        setLoading(false)
        if (!error) setItems(data || [])
    }

    useEffect(() => {
        const timer = setTimeout(load, 300)
        return () => clearTimeout(timer)
    }, [search])

    async function updateStock(id, delta) {
        if (readOnly) return
        const client = getSupabase()
        const item = items.find(i => i.id === id)
        const newQty = Math.max(0, (item.stock_quantity || 0) + delta)
        const { error } = await client.from('spare_parts').update({ stock_quantity: newQty }).eq('id', id)
        if (!error) load()
    }

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('spare_parts').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const exportToCSV = () => {
        if (!items.length) return
        const headers = ['Name', 'Category', 'Stock', 'Min Stock', 'Location', 'Remarks']
        const csvData = items.map(it => [
            it.name, it.category, it.stock_quantity, it.min_stock_level, it.location, it.remarks
        ].map(v => `"${v || ''}"`).join(','))
        const blob = new Blob([headers.join(',') + '\n' + csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `it_spare_parts_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
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
                <button className="secondary" onClick={exportToCSV}>📥 Export CSV</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                        {items.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.category}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>{it.location || '-'}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                        {!readOnly && <button className="secondary" style={{ padding: '4px 8px' }} onClick={() => updateStock(it.id, -1)}>-</button>}
                                        <span style={{
                                            fontWeight: 700,
                                            color: it.stock_quantity <= it.min_stock_level ? 'crimson' : 'inherit',
                                            minWidth: 30
                                        }}>
                                            {it.stock_quantity}
                                        </span>
                                        {!readOnly && <button className="secondary" style={{ padding: '4px 8px' }} onClick={() => updateStock(it.id, 1)}>+</button>}
                                    </div>
                                    {it.stock_quantity <= it.min_stock_level && (
                                        <div style={{ fontSize: '0.7rem', color: 'crimson', marginTop: 4 }}>ควรสั่งเพิ่ม! (Min: {it.min_stock_level})</div>
                                    )}
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
                        {!items.length && !loading && (
                            <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center' }}>ไม่พบข้อมูลอะไหล่</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
