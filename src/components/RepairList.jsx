import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

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
        if (!error) setItems(data || [])
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
            .update({ status: 'in_progress', handled_by: handledBy })
            .eq('id', item.id)
        if (error) alert(error.message)
        else load()
    }

    // ปิดงาน: -> done + บันทึกประวัติบำรุงรักษาอัตโนมัติ
    async function completeJob(item) {
        const resolution = prompt('สรุปการซ่อม / สิ่งที่ทำ:', item.resolution || '')
        if (resolution === null) return
        const costStr = prompt('ค่าใช้จ่าย (บาท):', item.cost || '0')
        if (costStr === null) return
        const cost = parseFloat(costStr) || 0
        const handledBy = item.handled_by || prompt('ชื่อผู้ซ่อม:', '') || ''

        const client = getSupabase()

        // 1) ปิดเรื่องแจ้งซ่อม
        const { error: upErr } = await client
            .from('repair_requests')
            .update({
                status: 'done',
                resolution,
                cost,
                handled_by: handledBy,
                completed_at: new Date().toISOString(),
            })
            .eq('id', item.id)

        if (upErr) return alert(upErr.message)

        // 2) บันทึกประวัติบำรุงรักษาอัตโนมัติ (เฉพาะที่อ้างอิงทรัพย์สิน)
        if (item.asset_id) {
            const deviceLabel = item.assets?.asset_tag || item.device_name || ''
            const { error: logErr } = await client.from('maintenance_logs').insert({
                asset_id: item.asset_id,
                log_type: 'repair',
                description: `[แจ้งซ่อม #${item.id}] อาการ: ${item.problem}\nการซ่อม: ${resolution}`,
                performed_by: handledBy,
                cost,
            })
            if (logErr) {
                alert('ปิดงานแล้ว แต่บันทึกประวัติไม่สำเร็จ: ' + logErr.message)
            } else {
                alert(`ปิดงานเรียบร้อย และบันทึกลงประวัติบำรุงรักษาของ ${deviceLabel} อัตโนมัติแล้ว`)
            }
        } else {
            alert('ปิดงานเรียบร้อย (ไม่ได้อ้างอิงทรัพย์สิน จึงไม่ได้ลงประวัติบำรุงรักษา)')
        }
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
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
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
                <button className="primary" onClick={onNewRepair}>+ แจ้งซ่อมใหม่</button>
            </div>

            {pendingCount > 0 && (
                <div className="card" style={{ marginBottom: 24, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 12 }}>
                    🔔 <strong>มีเรื่องแจ้งซ่อมรอดำเนินการ {pendingCount} รายการ</strong>
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
                                                {new Date(it.completed_at).toLocaleDateString()}
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
