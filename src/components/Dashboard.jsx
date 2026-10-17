import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { today as localToday } from '../audit/docs.jsx'

const REPAIR_STATUS = {
    pending: { label: 'รอรับเรื่อง', cls: 'status-retired', style: { background: '#fee2e2', color: '#b91c1c' } },
    in_progress: { label: 'กำลังซ่อม', style: { background: '#fef3c7', color: '#b45309' } },
    done: { label: 'ซ่อมเสร็จ', style: { background: '#dcfce7', color: '#15803d' } },
}

export default function Dashboard({ onNavigate }) {
    const [stats, setStats] = useState(null)
    const [recentRepairs, setRecentRepairs] = useState([])
    const [loadError, setLoadError] = useState('')

    async function loadStats() {
        const client = getSupabase()
        if (!client) return
        const today = localToday()
        let firstError = null
        const check = (r) => { if (r.error && !firstError) firstError = r.error; return r }
        const count = (q) => q.then(check).then(r => r.count || 0)
        const head = { count: 'exact', head: true }

        setLoadError('')
        try {
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('หมดเวลารอ (ตรวจสอบอินเทอร์เน็ตหรือสถานะโปรเจกต์ Supabase)')), 10000))
        const [assets, computers, software, spare, loans, pendingRepairs, expiredLicenses, overdueLoans, spareRows, allEmployees, ownerRows, repairs] = await Promise.race([timeout, Promise.all([
            count(client.from('assets').select('id', head)),
            count(client.from('computers').select('id', head)),
            count(client.from('software').select('id', head)),
            count(client.from('spare_parts').select('id', head)),
            count(client.from('loans').select('id', head).eq('status', 'active')),
            count(client.from('repair_requests').select('id', head).neq('status', 'done')),
            count(client.from('software').select('id', head).lt('expiry_date', today)),
            count(client.from('loans').select('id', head).eq('status', 'active').lt('due_date', today)),
            client.from('spare_parts').select('stock_quantity, min_stock_level').then(check).then(r => r.data || []),
            client.from('employees').select('employee_id, name').then(check).then(r => r.data || []),
            client.from('assets').select('owner').neq('status', 'retired').then(check).then(r => r.data || []),
            client.from('repair_requests').select('id, problem, status, created_at, device_name, reporter_name, assets(asset_tag)')
                .order('created_at', { ascending: false }).limit(5).then(check).then(r => r.data || []),
        ])])

        // Supabase เทียบคอลัมน์กับคอลัมน์ไม่ได้ จึงคำนวณของใกล้หมดฝั่ง client
        const lowStock = spareRows.filter(r => r.min_stock_level != null && (r.stock_quantity ?? 0) <= r.min_stock_level).length

        // เครื่องที่ผู้ถือครองลาออกแล้ว (ชื่อในทะเบียนพนักงานขึ้นต้น [ลาออก]) ต้องไปสำรวจว่าใครใช้ต่อ
        const leftIds = new Set(allEmployees.filter(e => String(e.name).startsWith('[ลาออก]')).map(e => e.employee_id))
        const leaverAssets = ownerRows.filter(a => leftIds.has(a.owner)).length
        // ผู้ใช้ที่ไม่ใช่รหัสพนักงาน (พิมพ์ชื่อเล่น/ตัวย่อลงช่องผู้ใช้) — ออดิทจะถามว่าเครื่องอยู่กับใคร
        const empIds = new Set(allEmployees.map(e => e.employee_id))
        const unknownOwners = allEmployees.length ? ownerRows.filter(a => a.owner && a.owner !== '0000' && !empIds.has(a.owner)).length : 0
        setStats({ assets, computers, software, spare, loans, pendingRepairs, expiredLicenses, overdueLoans, lowStock, leaverAssets, unknownOwners })
        setRecentRepairs(repairs)
        if (firstError) setLoadError(firstError.message)
        } catch (e) {
            setLoadError(e.message)
        }
    }

    useEffect(() => { loadStats() }, [])

    const v = (k) => stats ? stats[k] : <span className="skeleton" />

    const cards = [
        { key: 'assets', label: 'เครื่องและอุปกรณ์ IT', icon: '📦', color: '#4f46e5', tab: 'assets' },
        { key: 'computers', label: 'คอมพิวเตอร์ (ข้อมูลเดิม)', icon: '💻', color: '#0891b2', tab: 'computers' },
        { key: 'pendingRepairs', label: 'งานซ่อมค้าง', icon: '🛎️', color: '#dc2626', tab: 'repairs' },
        { key: 'loans', label: 'กำลังถูกยืม', icon: '🔄', color: '#d97706', tab: 'loans' },
        { key: 'software', label: 'ซอฟต์แวร์/ลิขสิทธิ์', icon: '💿', color: '#7c3aed', tab: 'software' },
    ]

    const alerts = stats ? [
        { n: stats.leaverAssets, label: 'เครื่องที่ผู้ถือครองลาออกแล้ว (ไปสำรวจ)', icon: '🚪', tab: 'survey' },
        { n: stats.unknownOwners, label: 'ผู้ใช้ไม่ตรงกับทะเบียนพนักงาน (ไปแก้ในหน้าสำรวจ)', icon: '❔', tab: 'survey' },
        { n: stats.pendingRepairs, label: 'งานแจ้งซ่อมที่ยังไม่ปิด', icon: '🛎️', tab: 'repairs' },
        { n: stats.overdueLoans, label: 'ยืมเกินกำหนดคืน', icon: '⏰', tab: 'loans' },
        { n: stats.expiredLicenses, label: 'ลิขสิทธิ์หมดอายุแล้ว', icon: '📄', tab: 'software' },
    ].filter(a => a.n > 0) : []

    return (
        <div>
            {loadError && (
                <div className="card" style={{ marginBottom: 16, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>⚠️ เชื่อมต่อฐานข้อมูลไม่ได้: {loadError}</span>
                    <button className="secondary" style={{ marginLeft: 'auto' }} onClick={loadStats}>ลองใหม่</button>
                </div>
            )}
            <div className="stat-grid">
                {cards.map(c => (
                    <button key={c.key} className="stat" onClick={() => onNavigate(c.tab)}>
                        <div className="stat-icon" style={{ background: c.color + '18', color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="stat-label">{c.label}</div>
                            <div className="stat-value">{v(c.key)}</div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">ทำรายการด่วน</h3>
                <div className="quick">
                    <button onClick={() => onNavigate('repairs', true)}>🛎️ แจ้งซ่อม</button>
                    <button onClick={() => onNavigate('loans', true)}>🔄 บันทึกการยืม</button>
                    <button onClick={() => onNavigate('assets', true)}>📦 ขึ้นทะเบียนเครื่อง</button>
                    <button onClick={() => onNavigate('maintenance', true)}>🔧 ลงประวัติเครื่อง</button>
                    <button onClick={() => onNavigate('survey')}>📋 สำรวจเครื่อง</button>
                </div>
            </div>

            <div className="dash-grid">
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <h3 className="section-title" style={{ margin: 0 }}>แจ้งซ่อมล่าสุด</h3>
                        <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('repairs')}>ดูทั้งหมด →</button>
                    </div>
                    {recentRepairs.length === 0 && <div className="muted" style={{ padding: '20px 0' }}>{stats ? 'ยังไม่มีเรื่องแจ้งซ่อม' : 'กำลังโหลด...'}</div>}
                    {recentRepairs.map(r => {
                        const st = REPAIR_STATUS[r.status] || REPAIR_STATUS.pending
                        return (
                            <div key={r.id} className="list-row">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{r.assets?.asset_tag || r.device_name || 'ไม่ระบุอุปกรณ์'}</div>
                                    <div className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {r.problem} · {r.reporter_name || '-'}
                                    </div>
                                </div>
                                <span className="badge" style={st.style}>{st.label}</span>
                            </div>
                        )
                    })}
                </div>

                <div className="card">
                    <h3 className="section-title">ต้องจัดการ</h3>
                    {!stats && <div className="muted">กำลังตรวจสอบ...</div>}
                    {stats && !loadError && alerts.length === 0 && (
                        <div style={{ background: '#f0fdf4', color: '#15803d', padding: 14, borderRadius: 10 }}>
                            ✅ ทุกอย่างเรียบร้อย ไม่มีรายการที่ต้องจัดการ
                        </div>
                    )}
                    {alerts.map(a => (
                        <button key={a.label} className="alert-row" onClick={() => onNavigate(a.tab)}>
                            <span>{a.icon}</span>
                            <span>{a.label}</span>
                            <span className="n" style={{ color: 'var(--danger)' }}>{a.n}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
