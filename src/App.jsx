import { useEffect, useRef, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import AssetForm from './components/AssetForm.jsx'
import AssetList from './components/AssetList.jsx'
import ComputerList from './components/ComputerList.jsx'
import ComputerForm from './components/ComputerForm.jsx'
import EmployeeList from './components/EmployeeList.jsx'
import EmployeeForm from './components/EmployeeForm.jsx'
import PrinterList from './components/PrinterList.jsx'
import PrinterForm from './components/PrinterForm.jsx'
import SoftwareList from './components/SoftwareList.jsx'
import SoftwareForm from './components/SoftwareForm.jsx'
import MaintenanceList from './components/MaintenanceList.jsx'
import MaintenanceForm from './components/MaintenanceForm.jsx'
import SparePartsList from './components/SparePartsList.jsx'
import SparePartsForm from './components/SparePartsForm.jsx'
import LoanList from './components/LoanList.jsx'
import LoanForm from './components/LoanForm.jsx'
import RepairList from './components/RepairList.jsx'
import RepairForm from './components/RepairForm.jsx'
import ScanFlow from './components/ScanFlow.jsx'
import ProceduresPage from './audit/ProceduresPage.jsx'
import RegisterPage from './audit/RegisterPage.jsx'
import HistoryPage from './audit/HistoryPage.jsx'
import RepairFormPage from './audit/RepairFormPage.jsx'
import BackupPage from './audit/BackupPage.jsx'
import QrLabelsPage from './audit/QrLabelsPage.jsx'
import SurveyPage from './audit/SurveyPage.jsx'
import { isEnvReady, getSupabase } from './supabaseClient.js'
import { useAdminAuth, LoginScreen } from './auth.jsx'

// ตั้งค่าแต่ละหน้าไว้ที่เดียว: หัวข้อ, คำอธิบาย, ปุ่มเพิ่ม, รายการ, ฟอร์ม
const PAGES = {
  home: { label: 'หน้าหลัก', icon: '🏠', title: 'ภาพรวมระบบ', desc: 'สรุปสถานะทรัพย์สินและงานที่ต้องจัดการวันนี้' },
  repairs: {
    label: 'แจ้งซ่อม', icon: '🛎️', title: 'แจ้งซ่อมคอมพิวเตอร์และอุปกรณ์ IT', desc: 'QP-IT-01 ข้อ 5.2 — รับเรื่อง ซ่อม ปิดงาน แล้วลงประวัติเครื่องอัตโนมัติ (FQP-IT-01:03)',
    addLabel: 'แจ้งซ่อมใหม่', adminOnlyAdd: false,
    List: (p) => <RepairList onNewRepair={p.onAdd} readOnly={p.readOnly} />,
    Form: (p) => <RepairForm onSaved={p.onSaved} presetAssetId={p.presetAssetId} />,
  },
  loans: {
    label: 'ยืม-คืน', icon: '🔄', title: 'ยืม-คืนเครื่องและอุปกรณ์ IT', desc: 'ติดตามการยืม-คืนเครื่องและโน้ตบุ๊ก',
    addLabel: 'บันทึกการยืม',
    List: (p) => <LoanList onNewLoan={p.onAdd} readOnly={p.readOnly} />,
    Form: (p) => <LoanForm onSaved={p.onSaved} presetAssetId={p.presetAssetId} />,
  },
  maintenance: {
    label: 'ประวัติบำรุงรักษา', icon: '🔧', title: 'บันทึกการซ่อม/บำรุงรักษา', desc: 'QP-IT-01 ข้อ 5.3 — รายการที่ลงในประวัติเครื่อง (FQP-IT-01:02)',
    addLabel: 'บันทึกการซ่อม/บำรุงรักษา',
    List: (p) => <MaintenanceList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <MaintenanceForm maintenanceId={p.id} onSaved={p.onSaved} />,
  },
  assets: {
    label: 'เครื่องและอุปกรณ์ IT', icon: '📦', title: 'เครื่องคอมพิวเตอร์และอุปกรณ์ IT', desc: 'ทะเบียนหลักตาม QP-IT-01 ข้อ 5.1 — ทุกเครื่องมีรหัส AAA-BB-CC และป้ายชี้บ่ง',
    addLabel: 'ขึ้นทะเบียนเครื่องใหม่',
    List: (p) => <AssetList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <AssetForm assetId={p.id} onSaved={p.onSaved} />,
  },
  computers: {
    label: 'คอมพิวเตอร์', icon: '💻', title: 'คอมพิวเตอร์ (ข้อมูลเดิม)', desc: 'ทะเบียนคอมพิวเตอร์ชุดเดิม — เพิ่มเครื่องใหม่ที่หน้า เครื่องและอุปกรณ์ IT',
    noAdd: true,
    List: (p) => <ComputerList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <ComputerForm computerId={p.id} onSaved={p.onSaved} />,
  },
  printers: {
    label: 'เครื่องพิมพ์', icon: '🖨️', title: 'เครื่องพิมพ์ (ข้อมูลเดิม)', desc: 'ทะเบียนเครื่องพิมพ์ชุดเดิม — เพิ่มเครื่องใหม่ที่หน้า เครื่องและอุปกรณ์ IT',
    noAdd: true,
    List: (p) => <PrinterList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <PrinterForm printerId={p.id} onSaved={p.onSaved} />,
  },
  spare_parts: {
    label: 'คลังอะไหล่', icon: '🧰', title: 'คลังอะไหล่', desc: 'สต๊อกอุปกรณ์ต่อพ่วงและวัสดุสิ้นเปลือง',
    addLabel: 'เพิ่มรายการ',
    List: (p) => <SparePartsList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <SparePartsForm sparePartId={p.id} onSaved={p.onSaved} />,
  },
  employees: {
    label: 'พนักงาน', icon: '👥', title: 'ทะเบียนพนักงาน', desc: 'ใช้อ้างอิงผู้ใช้งานเครื่องและผู้แจ้งซ่อม',
    addLabel: 'เพิ่มพนักงาน',
    List: (p) => <EmployeeList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <EmployeeForm employeeId={p.id} onSaved={p.onSaved} />,
  },
  software: {
    label: 'ซอฟต์แวร์/ลิขสิทธิ์', icon: '💿', title: 'ซอฟต์แวร์และลิขสิทธิ์', desc: 'ควบคุมไลเซนส์และวันหมดอายุ',
    addLabel: 'เพิ่มลิขสิทธิ์',
    List: (p) => <SoftwareList onEdit={p.onEdit} readOnly={p.readOnly} />,
    Form: (p) => <SoftwareForm softwareId={p.id} onSaved={p.onSaved} />,
  },
  // ---- เอกสารสำหรับออดิท (สร้างจากข้อมูลเดิม พิมพ์ได้) ----
  procedures: { label: 'ระเบียบปฏิบัติงาน IT', icon: '📘', title: 'ระเบียบปฏิบัติงานแผนก IT', desc: 'QP-IT-01 ระเบียบปฏิบัติงานแผนก IT ฉบับ 16 ต.ค. 2566', List: () => <ProceduresPage /> },
  register: { label: 'ทะเบียนเครื่อง', icon: '📋', title: 'ทะเบียนรายชื่อเครื่องคอมพิวเตอร์และอุปกรณ์ IT', desc: 'FQP-IT-01:01 แยกตาราง Computer / Printer ตามแบบฟอร์มเดิม', List: () => <RegisterPage /> },
  history: { label: 'ประวัติเครื่อง', icon: '🗂️', title: 'ประวัติเครื่องคอมพิวเตอร์และอุปกรณ์ IT', desc: 'FQP-IT-01:02 บันทึกการซ่อม/บำรุงรักษารายเครื่อง', List: () => <HistoryPage /> },
  repair_form: { label: 'ใบแจ้งซ่อม', icon: '📝', title: 'ใบแจ้งซ่อมคอมพิวเตอร์และอุปกรณ์ IT', desc: 'FQP-IT-01:03 พิมพ์จากรายการแจ้งซ่อมในระบบ หรือฟอร์มเปล่า', List: () => <RepairFormPage /> },
  survey: { label: 'สำรวจเครื่อง', icon: '📋', title: 'สำรวจเครื่องคอมพิวเตอร์และอุปกรณ์', desc: 'เดินตรวจว่าเครื่องอยู่กับใคร ที่ไหน แล้วอัปเดตทะเบียน FQP-IT-01:01 ทันที', List: () => <SurveyPage /> },
  qr_labels: { label: 'ป้าย QR ติดเครื่อง', icon: '🏷️', title: 'พิมพ์ป้าย QR ติดเครื่อง', desc: 'แบบฟอร์มสติกเกอร์ชี้บ่งเครื่อง (ข้อ 5.1) พร้อม QR สแกนแจ้งซ่อม', List: () => <QrLabelsPage /> },
  backup: { label: 'สำรองข้อมูล', icon: '💾', title: 'สำรองข้อมูล (Backup)', desc: 'ดาวน์โหลดไฟล์สำรองข้อมูลระบบ และบันทึกว่าสำรองเมื่อไหร่', List: () => <BackupPage /> },
}

const NAV_GROUPS = [
  { title: null, items: ['home'] },
  { title: 'งานบริการ', items: ['repairs', 'loans', 'maintenance', 'survey'] },
  { title: 'ทรัพย์สิน', items: ['assets', 'computers', 'printers', 'spare_parts', 'qr_labels'] },
  { title: 'ข้อมูลอ้างอิง', items: ['employees', 'software'] },
  { title: 'เอกสารออดิท (QP-IT-01)', items: ['procedures', 'register', 'history', 'repair_form'] },
  { title: 'เครื่องมือ', items: ['backup'] },
]

const tabFromHash = () => {
  const h = window.location.hash.replace('#', '')
  return PAGES[h] ? h : 'home'
}

export default function App() {
  const [activeTab, setActiveTab] = useState(tabFromHash)
  const [editingId, setEditingId] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const auth = useAdminAuth()
  const [pendingRepairs, setPendingRepairs] = useState(0)
  const [listKey, setListKey] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scanTag, setScanTag] = useState(() => new URLSearchParams(window.location.search).get('asset'))

  const clearScanUrl = () => {
    setScanTag(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  async function loadPendingRepairs() {
    const client = getSupabase()
    if (!client) return
    const { count } = await client
      .from('repair_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingRepairs(count || 0)
  }

  useEffect(() => { loadPendingRepairs() }, [activeTab, isAdding])

  // ปุ่ม Back/Forward ของเบราว์เซอร์ใช้เปลี่ยนหน้าได้
  // เทียบกับหน้าปัจจุบันก่อน — ไม่งั้น hashchange ที่เกิดจาก navigate() เองจะไปปิดฟอร์มที่เพิ่งเปิด
  // (ปุ่ม "ทำรายการด่วน" ในหน้าหลักเคยเปิดฟอร์มไม่ขึ้นเพราะเหตุนี้)
  const tabRef = useRef(activeTab)
  useEffect(() => {
    const onHash = () => {
      const t = tabFromHash()
      if (t === tabRef.current) return
      tabRef.current = t
      setActiveTab(t)
      closeForm()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Esc ปิดฟอร์ม
  useEffect(() => {
    if (!isAdding) return
    const onKey = (e) => { if (e.key === 'Escape') closeForm() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAdding])

  function navigate(tab, openAdd = false) {
    tabRef.current = tab
    if (window.location.hash !== '#' + tab) window.location.hash = tab
    setActiveTab(tab)
    setEditingId(null)
    setIsAdding(openAdd)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }

  function closeForm() {
    setIsAdding(false)
    setEditingId(null)
  }

  const handleEdit = (id) => {
    setEditingId(id)
    setIsAdding(true)
  }

  const handleSaved = () => {
    closeForm()
    setListKey(k => k + 1) // โหลดรายการใหม่หลังบันทึก
  }

  // สแกน QR เข้ามา (?asset=ASSET_TAG) -> โหมดมือถือเฉพาะกิจ ไม่เข้าหน้าแอดมิน
  if (scanTag) {
    return <ScanFlow assetTag={scanTag} onClose={clearScanUrl} />
  }

  // หน้าแอดมินต้องใส่รหัสผ่านก่อน (ใช้คนเดียว) — หน้าสแกน QR ด้านบนไม่ต้อง
  if (!auth.ok) {
    return <LoginScreen onLogin={auth.login} />
  }

  const page = PAGES[activeTab]
  const readOnly = false
  const canAdd = !!page.Form && !page.noAdd

  return (
    <div className="app">
      {menuOpen && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setMenuOpen(false)} />}

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">🖥️</div>
          <div>
            <div className="brand-name">IT Asset</div>
            <div className="brand-sub">เบสท์เวิลด์ อินเตอร์พลาส</div>
          </div>
        </div>

        <div className="nav">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.title && <div className="nav-group-title">{group.title}</div>}
              {group.items.map(id => {
                const p = PAGES[id]
                const badge = id === 'repairs' ? pendingRepairs : 0
                return (
                  <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => navigate(id)}>
                    <span className="icon">{p.icon}</span>
                    <span>{p.label}</span>
                    {badge > 0 && <span className="nav-badge">{badge}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => { if (confirm('ออกจากระบบ?')) auth.logout() }}>
            <span className="icon">🔒</span><span>ออกจากระบบ</span>
          </button>
          {!isEnvReady() && (
            <div style={{ marginTop: 12, background: '#450a0a', border: '1px solid #7f1d1d', padding: 10, borderRadius: 8, fontSize: '0.75rem' }}>
              ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล
            </div>
          )}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button className="ghost menu-btn" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู">☰</button>
          <div>
            <h1>{page.title}</h1>
            <p>{page.desc}</p>
          </div>
          <div className="actions">
            {canAdd && (
              <button className="primary" onClick={() => { setEditingId(null); setIsAdding(true) }}>
                + {page.addLabel}
              </button>
            )}
          </div>
        </header>

        <main className="content">
          {activeTab === 'home'
            ? <Dashboard onNavigate={navigate} />
            : <page.List key={listKey} onEdit={handleEdit} onAdd={() => setIsAdding(true)} readOnly={readOnly} />}
        </main>
      </div>

      {isAdding && page.Form && (
        <>
          <div className="overlay" onClick={closeForm} />
          <aside className="drawer" role="dialog" aria-modal="true">
            <div className="drawer-head">
              <span className="hint">กด Esc เพื่อปิด</span>
              <button className="ghost" onClick={closeForm} aria-label="ปิด">✕</button>
            </div>
            <div className="drawer-body">
              <page.Form id={editingId} onSaved={handleSaved} />
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
