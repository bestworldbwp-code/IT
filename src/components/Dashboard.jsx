import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { today as localToday } from '../audit/docs.jsx'

const REPAIR_STATUS = {
    pending: { label: 'รอรับเรื่อง', cls: 'status-retired', style: { background: '#fee2e2', color: '#b91c1c' } },
    in_progress: { label: 'กำลังซ่อม', style: { background: '#fef3c7', color: '#b45309' } },
    done: { label: 'ซ่อมเสร็จ', style: { background: '#dcfce7', color: '#15803d' } },
}

// ศูนย์ควบคุม: ทุกหน้าของระบบจัดเป็นหมวด กดจากหน้าหลักได้เลย ไม่ต้องหาในเมนูข้าง
// [หน้า, ไอคอน, ชื่อ, คำอธิบาย, เปิดฟอร์มเพิ่มทันที]
const HUB = [
    { title: 'งานประจำวัน', items: [
        ['repairs', '🛎️', 'แจ้งซ่อม', 'รับเรื่อง / ปิดงานซ่อม'],
        ['repairs', '➕', 'แจ้งซ่อมแทนผู้ใช้', 'เปิดฟอร์มแจ้งซ่อมใหม่', true],
        ['loans', '🔄', 'ยืม-คืน', 'บันทึกการยืมอุปกรณ์'],
        ['survey', '📋', 'สำรวจเครื่อง', 'เครื่องอยู่กับใคร ที่ไหน'],
    ] },
    { title: 'เครื่องและทะเบียน', items: [
        ['assets', '📦', 'เครื่องและอุปกรณ์', 'ค้นหา / แก้ไข / ปลดระวาง'],
        ['assets', '➕', 'ขึ้นทะเบียนเครื่องใหม่', 'เพิ่มเครื่องเข้าระบบ', true],
        ['qr_labels', '🏷️', 'ป้าย QR', 'พิมพ์สติกเกอร์ติดเครื่อง'],
        ['inventory', '🔌', 'นำเข้าข้อมูล USB', 'เติม S/N / สเปคจากโปรแกรม USB'],
    ] },
    { title: 'เอกสารออดิท (QP-IT-01)', items: [
        ['register', '📋', 'ทะเบียนเครื่อง', 'FQP-IT-01:01'],
        ['history', '🗂️', 'ประวัติเครื่อง', 'FQP-IT-01:02 + ใบแจ้งซ่อม'],
        ['repair_form', '📝', 'ใบแจ้งซ่อม', 'FQP-IT-01:03 พิมพ์ / ฟอร์มเปล่า'],
        ['procedures', '📘', 'ระเบียบปฏิบัติงาน', 'QP-IT-01'],
    ] },
    { title: 'ข้อมูลและเครื่องมือ', items: [
        ['maintenance', '🔧', 'ลงประวัติบำรุงรักษา', 'บันทึกงานที่ไม่ได้มาจากใบแจ้งซ่อม'],
        ['employees', '👥', 'พนักงาน', 'ทะเบียนพนักงาน'],
        ['software', '💿', 'ซอฟต์แวร์/ลิขสิทธิ์', 'ไลเซนส์และวันหมดอายุ'],
        ['backup', '💾', 'สำรองข้อมูล', 'ดาวน์โหลดไฟล์สำรอง'],
    ] },
]

export default function Dashboard({ onNavigate }) {
    const [stats, setStats] = useState(null)
    const [showAdmin, setShowAdmin] = useState(false)
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

    const alerts = stats ? [
        { n: stats.pendingRepairs, label: 'งานแจ้งซ่อมที่ยังไม่ปิด', icon: '🛎️', color: '#ff3b30', tab: 'repairs' },
        { n: stats.leaverAssets, label: 'เครื่องที่ผู้ถือครองลาออกแล้ว', icon: '🚪', color: '#ff9500', tab: 'survey' },
        { n: stats.unknownOwners, label: 'ผู้ใช้ไม่ตรงกับทะเบียนพนักงาน', icon: '❔', color: '#ff9500', tab: 'survey' },
        { n: stats.overdueLoans, label: 'ยืมเกินกำหนดคืน', icon: '⏰', color: '#ff3b30', tab: 'loans' },
        { n: stats.expiredLicenses, label: 'ลิขสิทธิ์หมดอายุแล้ว', icon: '📄', color: '#af52de', tab: 'software' },
    ].filter(a => a.n > 0) : []
    const todo = alerts.reduce((s, a) => s + a.n, 0)

    const widgets = [
        { label: 'เครื่องทั้งหมด', value: v('assets'), sub: 'ในทะเบียน FQP-IT-01:01', color: '#007aff', icon: '🖥️', tab: 'assets' },
        { label: 'งานซ่อมค้าง', value: v('pendingRepairs'), sub: 'รอรับเรื่อง / กำลังซ่อม', color: '#ff3b30', icon: '🛎️', tab: 'repairs' },
        { label: 'กำลังถูกยืม', value: v('loans'), sub: 'ยังไม่คืน', color: '#ff9500', icon: '🔄', tab: 'loans' },
        { label: 'ต้องจัดการ', value: stats ? todo : v('x'), sub: !stats ? 'กำลังตรวจสอบ...' : todo ? 'ดูรายการด้านล่าง' : 'เรียบร้อยทั้งหมด', color: !stats || todo ? '#af52de' : '#34c759', icon: !stats || todo ? '📌' : '✅' },
    ]
    const hour = new Date().getHours()
    const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

    return (
        <div className="home">
            {loadError && (
                <div className="card" style={{ marginBottom: 16, background: '#fff1f0', color: '#c0392b', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>⚠️ เชื่อมต่อฐานข้อมูลไม่ได้: {loadError}</span>
                    <button className="secondary" style={{ marginLeft: 'auto' }} onClick={loadStats}>ลองใหม่</button>
                </div>
            )}

            <div className="home-hello">
                <div>
                    <div className="home-greet">{greet} 👋</div>
                    <div className="muted">{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <button className="primary home-cta" onClick={() => onNavigate('repairs', true)}>＋ แจ้งซ่อม</button>
            </div>

            <div className="widgets">
                {widgets.map(w => (
                    <button key={w.label} className="widget" onClick={() => w.tab && onNavigate(w.tab)} disabled={!w.tab}>
                        <div className="widget-top">
                            <span className="widget-icon" style={{ background: w.color }}>{w.icon}</span>
                            <span className="widget-label">{w.label}</span>
                        </div>
                        <div className="widget-value" style={{ color: w.color }}>{w.value}</div>
                        <div className="widget-sub">{w.sub}</div>
                    </button>
                ))}
            </div>

            <div className="dash-grid">
                <div className="card">
                    <div className="card-head">
                        <h3 className="section-title" style={{ margin: 0 }}>แจ้งซ่อมล่าสุด</h3>
                        <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('repairs')}>ดูทั้งหมด</button>
                    </div>
                    {recentRepairs.length === 0 && <div className="empty">{stats ? '🎉 ยังไม่มีเรื่องแจ้งซ่อม' : 'กำลังโหลด...'}</div>}
                    {recentRepairs.map(r => {
                        const st = REPAIR_STATUS[r.status] || REPAIR_STATUS.pending
                        return (
                            <button key={r.id} className="ios-row" onClick={() => onNavigate('repairs')}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{r.assets?.asset_tag || r.device_name || 'ไม่ระบุอุปกรณ์'}</div>
                                    <div className="muted ellipsis">{r.problem} · {r.reporter_name || '-'}</div>
                                </div>
                                <span className="badge" style={st.style}>{st.label}</span>
                                <span className="chev">›</span>
                            </button>
                        )
                    })}
                </div>

                <div className="card">
                    <div className="card-head"><h3 className="section-title" style={{ margin: 0 }}>ต้องจัดการ</h3></div>
                    {!stats && <div className="empty">กำลังตรวจสอบ...</div>}
                    {stats && !loadError && alerts.length === 0 && <div className="empty">✅ ทุกอย่างเรียบร้อย</div>}
                    {alerts.map(a => (
                        <button key={a.label} className="ios-row" onClick={() => onNavigate(a.tab)}>
                            <span className="widget-icon sm" style={{ background: a.color }}>{a.icon}</span>
                            <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
                            <span className="count" style={{ background: a.color }}>{a.n}</span>
                            <span className="chev">›</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="card">
                <div className="card-head"><h3 className="section-title" style={{ margin: 0 }}>เมนูหลัก</h3></div>
                <div className="apps">
                    {MAIN_APPS.map(([tab, icon, label, desc, add], i) => (
                        <button key={label} className="app-tile" onClick={() => onNavigate(tab, add)} title={desc}>
                            <span className="app-icon" style={{ background: APP_COLORS[i % APP_COLORS.length] }}>{icon}</span>
                            <span className="app-label">{label}</span>
                        </button>
                    ))}
                </div>
                <button className="ghost" style={{ marginTop: 8 }} onClick={() => setShowAdmin(v => !v)}>{showAdmin ? '▾' : '▸'} เครื่องมือแอดมิน</button>
                {showAdmin && (
                    <div className="apps">
                        {ADMIN_APPS.map(([tab, icon, label, desc], i) => (
                            <button key={label} className="app-tile" onClick={() => onNavigate(tab)} title={desc}>
                                <span className="app-icon" style={{ background: '#8e8e93' }}>{icon}</span>
                                <span className="app-label">{label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// เมนูหลักสำหรับงานประจำ + เตรียมออดิท · ที่เหลือพับไว้ใน "เครื่องมือแอดมิน"
const MAIN_APPS = [
    ['repairs', '🛎️', 'แจ้งซ่อม', 'รับเรื่อง / ปิดงานซ่อม'],
    ['repairs', '➕', 'แจ้งซ่อมใหม่', 'เปิดฟอร์มแจ้งซ่อม', true],
    ['assets', '📦', 'ทะเบียนเครื่อง', 'ค้นหา / แก้ไขเครื่อง'],
    ['register', '📋', 'FQP-IT-01:01', 'ทะเบียนรายชื่อเครื่อง (พิมพ์)'],
    ['history', '🗂️', 'FQP-IT-01:02', 'ประวัติเครื่อง + ใบแจ้งซ่อม'],
    ['repair_form', '📝', 'FQP-IT-01:03', 'ใบแจ้งซ่อม (พิมพ์)'],
    ['procedures', '📘', 'QP-IT-01', 'ระเบียบปฏิบัติงาน'],
]
const ADMIN_APPS = [
    ['survey', '🔍', 'สำรวจเครื่อง'], ['qr_labels', '🏷️', 'ป้าย QR'], ['inventory', '🔌', 'นำเข้า USB'],
    ['loans', '🔄', 'ยืม-คืน'], ['maintenance', '🔧', 'บำรุงรักษา'], ['employees', '👥', 'พนักงาน'],
    ['software', '💿', 'ซอฟต์แวร์'], ['backup', '💾', 'สำรองข้อมูล'],
]

const APP_COLORS = ['#007aff', '#ff9500', '#34c759', '#5856d6', '#ff2d55', '#5ac8fa', '#af52de', '#ffcc00', '#30b0c7', '#ff3b30', '#64d2ff', '#a2845e']
