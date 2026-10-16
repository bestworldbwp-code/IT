import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { today, repairDocNo, fmtDate, fmtDateTime } from '../audit/docs.jsx'

const STATUS_META = {
    pending: { label: 'รอรับเรื่อง', bg: '#fee2e2', color: '#b91c1c' },
    in_progress: { label: 'กำลังซ่อม', bg: '#fef3c7', color: '#b45309' },
    done: { label: 'ซ่อมเสร็จ', bg: '#dcfce7', color: '#15803d' },
}

const PRIORITY_META = {
    low: { label: 'ไม่เร่งด่วน', color: '#64748b' },
    normal: { label: 'ปกติ', color: '#2563eb' },
    high: { label: 'ด่วน', color: '#ea580c' },
    urgent: { label: 'ด่วนมาก', color: '#dc2626' },
}

export default function RepairList({ onNewRepair, readOnly }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState('all')

    async function load() {
        const client = getSupabase()
        if (!client) return
        setLoading(true)
        let query = client
            .from('repair_requests')
            .select('*, assets(asset_tag, model)')
            .order('created_at', { ascending: false })
        if (filter !== 'all') query = query.eq('status', filter)
        const { data, error } = await query
        setLoading(false)
        if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
        else setItems(data || [])
    }

    useEffect(() => {
        load()
    }, [filter])

    // รับเรื่อง: pending -> in_progress
    async function acceptJob(item) {
        const handledBy = prompt('ชื่อผู้รับงานซ่อม:', item.handled_by || '')
        if (handledBy === null) return
        const client = getSupabase()
        const { error } = await client
            .from('repair_requests')
            .update({ status: 'in_progress', handled_by: handledBy, started_at: new Date().toISOString() })
            .eq('id', item.id)
        if (error) alert(error.message)
        else load()
    }

    // ปิดงาน: เปิดฟอร์มส่วนที่ 2 ของใบแจ้งซ่อม -> done + บันทึกประวัติบำรุงรักษาอัตโนมัติ
    const [closing, setClosing] = useState(null)
    const [closeForm, setCloseForm] = useState({})
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false) // state อัปเดตไม่ทันถ้ากดรัว ๆ จึงล็อกด้วย ref
    function completeJob(item) {
        setClosing(item)
        setCloseForm({
            resolution: item.resolution || '', cost: item.cost || 0, handled_by: item.handled_by || '',
            repair_result: item.repair_result || 'fixed_no_part', returned_at: today(),
        })
    }

    async function submitClose(e) {
        e.preventDefault()
        if (savingRef.current) return // กันกดซ้ำ — เคยทำให้ประวัติเครื่องถูกบันทึกซ้ำ
        savingRef.current = true
        setSaving(true)
        try { await doClose() } finally { savingRef.current = false; setSaving(false) }
    }

    async function doClose() {
        const item = closing
        const f = closeForm
        const cost = parseFloat(f.cost) || 0
        const client = getSupabase()

        // 1) ปิดเรื่องแจ้งซ่อม
        const { error: upErr } = await client
            .from('repair_requests')
            .update({
                status: 'done', resolution: f.resolution, cost, handled_by: f.handled_by,
                repair_result: f.repair_result, returned_at: f.returned_at || null,
                started_at: item.started_at || item.created_at,
                completed_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        if (upErr) return alert(upErr.message)

        // 2) บันทึกประวัติบำรุงรักษาอัตโนมัติ (เฉพาะที่อ้างอิงทรัพย์สิน) — ตามระเบียบ QP-IT-01 ข้อ 5.3
        if (item.asset_id) {
            const deviceLabel = item.assets?.asset_tag || item.device_name || ''
            const { error: logErr } = await client.from('maintenance_logs').insert({
                asset_id: item.asset_id,
                log_type: f.repair_result === 'fixed_replaced' ? 'parts' : 'repair',
                log_date: today(),
                description: `อาการ: ${item.problem}\nการซ่อม: ${f.resolution}`,
                performed_by: f.handled_by,
                reference_doc: `ใบแจ้งซ่อม No. ${repairDocNo(item)}`,
                cost,
            })
            const { data: asset } = await client.from('assets').select('status').eq('id', item.asset_id).maybeSingle()
            if (asset) {
                const next = f.repair_result === 'unfixed_outsource' ? 'repair'
                    : (f.repair_result === 'fixed_no_part' || f.repair_result === 'fixed_replaced') && asset.status === 'repair' ? 'in_use' : null
                if (next && next !== asset.status) await client.from('assets').update({ status: next }).eq('id', item.asset_id)
            }
            if (logErr) alert('ปิดงานแล้ว แต่บันทึกประวัติไม่สำเร็จ: ' + logErr.message)
            else alert(`ปิดงานเรียบร้อย และบันทึกลงประวัติเครื่อง ${deviceLabel} อัตโนมัติแล้ว`)
        } else {
            alert('ปิดงานเรียบร้อย (ไม่ได้อ้างอิงทรัพย์สิน จึงไม่ได้ลงประวัติเครื่อง)')
        }
        setClosing(null)
        load()
    }

    async function deleteItem(id) {
        if (!confirm('ยืนยันการลบเรื่องแจ้งซ่อมนี้?')) return
        const client = getSupabase()
        const { error } = await client.from('repair_requests').delete().eq('id', id)
        if (error) alert(error.message)
        else load()
    }

    const pendingCount = items.filter(i => i.status === 'pending').length

    return (
        <div>
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                    {['all', 'pending', 'in_progress', 'done'].map(f => (
                        <button
                            key={f}
                            className={filter === f ? 'primary' : 'secondary'}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'ทั้งหมด' : STATUS_META[f].label}
                        </button>
                    ))}
                </div>
                <button className="secondary" onClick={load} disabled={loading}>
                    {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
            </div>

            {pendingCount > 0 && (
                <div className="card" style={{ marginBottom: 24, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 12 }}>
                    🔔 <strong>มีเรื่องแจ้งซ่อมรอดำเนินการ {pendingCount} รายการ</strong>
                </div>
            )}

            {closing && (
                <div className="overlay" onClick={() => setClosing(null)}>
                    <form className="card" onClick={e => e.stopPropagation()} onSubmit={submitClose}
                        style={{ maxWidth: 560, margin: '60px auto', padding: 24 }}>
                        <h3 style={{ marginBottom: 4 }}>ปิดงานซ่อม · {closing.assets?.asset_tag || closing.device_name || `#${closing.id}`}</h3>
                        <div className="muted" style={{ marginBottom: 16 }}>อาการ: {closing.problem}</div>
                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label>ผลการซ่อม</label>
                                <select value={closeForm.repair_result} onChange={e => setCloseForm({ ...closeForm, repair_result: e.target.value })}>
                                    <option value="fixed_no_part">แก้ปัญหาได้ — ไม่ต้องเปลี่ยนอุปกรณ์</option>
                                    <option value="fixed_replaced">แก้ปัญหาได้ — ต้องเปลี่ยนอุปกรณ์</option>
                                    <option value="unfixed_outsource">แก้ไม่ได้ — ส่งซ่อมภายนอก (ตาม QP-PUR-01)</option>
                                    <option value="unfixed_buy_new">แก้ไม่ได้ — ซื้อใหม่</option>
                                    <option value="other">อื่นๆ</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label>วิธีการแก้ไข / รายละเอียด *</label>
                                <textarea rows="3" required value={closeForm.resolution} onChange={e => setCloseForm({ ...closeForm, resolution: e.target.value })} />
                            </div>
                            <div><label>ผู้ซ่อม</label><input value={closeForm.handled_by} onChange={e => setCloseForm({ ...closeForm, handled_by: e.target.value })} /></div>
                            <div><label>ค่าใช้จ่าย (บาท)</label><input type="number" min="0" step="0.01" value={closeForm.cost} onChange={e => setCloseForm({ ...closeForm, cost: e.target.value })} /></div>
                            <div><label>วันที่รับคืน</label><input type="date" value={closeForm.returned_at} onChange={e => setCloseForm({ ...closeForm, returned_at: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                            <button className="primary" type="submit" style={{ flex: 1 }} disabled={saving}>{saving ? 'กำลังบันทึก...' : '✅ ปิดงาน'}</button>
                            <button className="secondary" type="button" onClick={() => setClosing(null)}>ยกเลิก</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                            <th style={{ padding: '10px 16px' }}>อุปกรณ์ / ผู้แจ้ง</th>
                            <th style={{ padding: '10px 16px' }}>อาการ</th>
                            <th style={{ padding: '10px 16px' }}>ความเร่งด่วน</th>
                            <th style={{ padding: '10px 16px' }}>สถานะ</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => {
                            const st = STATUS_META[it.status] || STATUS_META.pending
                            const pr = PRIORITY_META[it.priority] || PRIORITY_META.normal
                            return (
                                <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px 16px' }}>
                                        <div style={{ fontWeight: 600 }}>{it.assets?.asset_tag || it.device_name || '-'}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            แจ้งโดย: {it.reporter_name || '-'}{it.location ? ` · ${it.location}` : ''}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No. {repairDocNo(it)} · {fmtDateTime(it.created_at)}</div>
                                    </td>
                                    <td style={{ padding: '10px 16px', maxWidth: 320, whiteSpace: 'pre-wrap' }}>{it.problem}</td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <span style={{ color: pr.color, fontWeight: 600 }}>{pr.label}</span>
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600, background: st.bg, color: st.color }}>
                                            {st.label}
                                        </span>
                                        {it.status === 'done' && it.completed_at && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                เสร็จ {fmtDate(it.completed_at)}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                        {!readOnly && (
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                {it.status === 'pending' && (
                                                    <button className="secondary" style={{ padding: '6px 12px' }} onClick={() => acceptJob(it)}>รับเรื่อง</button>
                                                )}
                                                {it.status !== 'done' && (
                                                    <button className="primary" style={{ padding: '6px 12px' }} onClick={() => completeJob(it)}>ปิดงาน (ซ่อมเสร็จ)</button>
                                                )}
                                                <button className="danger" style={{ padding: '6px 12px' }} onClick={() => deleteItem(it.id)}>ลบ</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {!items.length && !loading && (
                            <tr><td colSpan="5" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่มีเรื่องแจ้งซ่อม</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
