import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { textMatch, exportCSV, today, fmtDate } from '../audit/docs.jsx'

const LICENSE_TH = { subscription: 'Subscription (เช่ารายปี)', perpetual: 'Perpetual (ซื้อขาด)', open_source: 'Open Source / Free' }

export default function SoftwareList({ onEdit, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        const { data, error } = await client.from('software').select('*').order('name', { ascending: true })
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems(data || [])
    }
    useEffect(() => { load() }, [])

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('software').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    // ชื่อ vendor มีเครื่องหมาย , เช่น "CO.,LTD" — กรองในเครื่องแทนการประกอบ query
    const visible = items.filter(it => textMatch(search, it.name, it.vendor, it.version, it.license_key, it.assigned_to))
    const t = today()
    const expired = (it) => it.expiry_date && it.expiry_date < t

    const doExport = () => {
        if (!visible.length) return
        exportCSV(`it_software_${t}.csv`, ['ชื่อ', 'Vendor', 'เวอร์ชัน', 'ประเภทลิขสิทธิ์', 'License Key', 'วันหมดอายุ', 'จำนวนสิทธิ์', 'ผู้ใช้'],
            visible.map(it => [it.name, it.vendor, it.version, LICENSE_TH[it.license_type] || it.license_type, it.license_key, it.expiry_date, it.total_licenses, it.assigned_to]))
    }

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                <input
                    placeholder="ค้นหาชื่อซอฟต์แวร์, Vendor, License Key, หรือผู้ใช้..."
                    value={search}
                    style={{ flex: 1 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="secondary" onClick={doExport} disabled={!visible.length}>📥 Export CSV</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '10px 16px' }}>ชื่อซอฟต์แวร์</th>
                            <th style={{ padding: '10px 16px' }}>โมเดลลิขสิทธิ์ / สัญญา</th>
                            <th style={{ padding: '10px 16px' }}>Key / พนักงานที่ถือ</th>
                            <th style={{ padding: '10px 16px' }}>วันหมดอายุ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{[it.vendor, it.version && `v${it.version}`].filter(Boolean).join(' · ') || '-'}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div>{LICENSE_TH[it.license_type] || it.license_type || '-'}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>จำนวน: {it.total_licenses ?? '-'}</div>
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.license_key || '-'}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>ผู้ใช้: {it.assigned_to || '-'}</div>
                                </td>
                                <td style={{ padding: '10px 16px', color: expired(it) ? 'crimson' : 'inherit', fontWeight: expired(it) ? 600 : undefined }}>
                                    {it.expiry_date ? fmtDate(it.expiry_date) : 'ไม่มีวันหมดอายุ'}
                                    {expired(it) && <div style={{ fontSize: '0.75rem' }}>หมดอายุแล้ว</div>}
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
                            <tr><td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
