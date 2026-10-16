import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { textMatch, exportCSV, today, fmtDate } from '../audit/docs.jsx'

const LOG_TYPE_TH = { repair: 'ซ่อมแซม / แก้ไข', parts: 'เปลี่ยนอะไหล่', preventive: 'บำรุงรักษาตามแผน', inspection: 'ตรวจเช็ค', update: 'ติดตั้ง / อัปเดต', upgrade: 'อัปเกรด', install: 'ติดตั้ง', backup_check: 'ตรวจสอบสำรองข้อมูล', other: 'อื่นๆ' }

export default function MaintenanceList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client
            .from('maintenance_logs')
            .select('*, assets(asset_tag, model)')
            .order('log_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems(data || [])
    }
    useEffect(() => { load() }, [])

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบประวัตินี้? (จะหายจากประวัติเครื่อง FQP-IT-01:02 ด้วย)')) return
        const client = getSupabase()
        const { error } = await client.from('maintenance_logs').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const visible = items.filter(it => textMatch(search, it.assets?.asset_tag, it.assets?.model, it.description, LOG_TYPE_TH[it.log_type], it.log_type, it.performed_by, it.reference_doc, it.remarks))

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_maintenance_${today()}.csv`, ['วันที่', 'รหัสเครื่องจักร', 'ประเภทงาน', 'รายละเอียด', 'ผู้ดำเนินการ', 'ค่าใช้จ่าย', 'เอกสารอ้างอิง', 'หมายเหตุ', 'ตรวจครั้งถัดไป'],
            visible.map(it => [it.log_date || String(it.created_at || '').slice(0, 10), it.assets?.asset_tag, LOG_TYPE_TH[it.log_type] || it.log_type, it.description, it.performed_by, it.cost, it.reference_doc, it.remarks, it.next_check_date]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหารหัสเครื่อง, รายละเอียด, ประเภท, ผู้ดำเนินการ, เอกสารอ้างอิง..."
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
                            <th style={{ padding: '10px 16px' }}>วัน/เดือน/ปี</th>
                            <th style={{ padding: '10px 16px' }}>เครื่อง (M/C Code)</th>
                            <th style={{ padding: '10px 16px' }}>ประเภทงาน</th>
                            <th style={{ padding: '10px 16px' }}>รายละเอียดการแก้ไข/บำรุงรักษา</th>
                            <th style={{ padding: '10px 16px' }}>ผู้ดำเนินการ / ค่าใช้จ่าย</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{fmtDate(it.log_date || it.created_at)}</td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.assets?.asset_tag || '-'}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{it.assets?.model}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', whiteSpace: 'nowrap', background: it.log_type === 'repair' || it.log_type === 'parts' ? '#fee2e2' : '#f1f5f9' }}>
                                        {LOG_TYPE_TH[it.log_type] || it.log_type}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 16px', maxWidth: 320, whiteSpace: 'pre-wrap' }}>
                                    {it.description}
                                    {it.reference_doc && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>อ้างอิง: {it.reference_doc}</div>}
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div>{it.performed_by}</div>
                                    {Number(it.cost) > 0 && <div style={{ fontWeight: 600, color: 'var(--primary)' }}>฿{Number(it.cost).toLocaleString('th-TH')}</div>}
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
                            <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center' }}>ไม่มีประวัติการบำรุงรักษา</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
