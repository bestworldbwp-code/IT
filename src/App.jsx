import { useState } from 'react'
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
import ScanLanding from './components/ScanLanding.jsx'
import { isEnvReady, logAction, getSupabase } from './supabaseClient.js'
import { useEffect } from 'react'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [editingId, setEditingId] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [role, setRole] = useState('admin') // Simple role: admin, viewer
  const [pendingRepairs, setPendingRepairs] = useState(0)
  const [presetAssetId, setPresetAssetId] = useState(null)
  const [scanTag, setScanTag] = useState(() => new URLSearchParams(window.location.search).get('asset'))

  const clearScanUrl = () => {
    setScanTag(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const handleScanRepair = (assetId) => {
    setPresetAssetId(assetId)
    setActiveTab('repairs')
    setIsAdding(true)
    clearScanUrl()
  }

  const handleScanLoan = (assetId) => {
    setPresetAssetId(assetId)
    setActiveTab('loans')
    setIsAdding(true)
    clearScanUrl()
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

  useEffect(() => {
    loadPendingRepairs()
  }, [activeTab, isAdding])

  const handleEdit = (id) => {
    setEditingId(id)
    setIsAdding(true)
  }

  const handleSaved = () => {
    setIsAdding(false)
    setEditingId(null)
    setPresetAssetId(null)
  }

  // แสดงหน้า Landing เมื่อสแกน QR เข้ามา (?asset=ASSET_TAG)
  if (scanTag) {
    return (
      <ScanLanding
        assetTag={scanTag}
        onRepair={handleScanRepair}
        onLoan={handleScanLoan}
        onClose={clearScanUrl}
      />
    )
  }

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: '📊' },
    { id: 'assets', label: 'ทรัพย์สิน IT (Hardware)', icon: '📦' },
    { id: 'computers', label: 'คอมพิวเตอร์ (PC/NB)', icon: '💻' },
    { id: 'printers', label: 'เครื่องพิมพ์ (Printers)', icon: '🖨️' },
    { id: 'employees', label: 'ทะเบียนพนักงาน', icon: '👥' },
    { id: 'software', label: 'ซอฟต์แวร์และลิขสิทธิ์', icon: '💿' },
    { id: 'repairs', label: 'แจ้งซ่อม (Repair)', icon: '🛎️', badge: pendingRepairs },
    { id: 'maintenance', label: 'ประวัติบำรุงรักษา', icon: '🔧' },
    { id: 'spare_parts', label: 'คลังอะไหล่ (Spare Parts)', icon: '🛠️' },
    { id: 'loans', label: 'ยืม-คืน (Loan System)', icon: '🔄' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 280,
        background: '#0f172a',
        color: 'white',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxShadow: '4px 0 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: 32, padding: '0 8px' }}>
          <h2 style={{ color: 'white', fontSize: '1.25rem', marginBottom: 4 }}>IT Asset ISO</h2>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Corporate Asset Management</div>
        </div>

        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setIsAdding(false); setEditingId(null); }}
            style={{
              background: activeTab === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: activeTab === item.id ? 'white' : '#94a3b8',
              border: 'none',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'all 0.2s'
            }}
          >
            <span>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge > 0 && (
              <span style={{
                background: '#dc2626',
                color: 'white',
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 700,
                minWidth: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px'
              }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 8 }}>SESSION ROLE</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              padding: '4px 8px'
            }}
          >
            <option value="admin">Administrator (Modify)</option>
            <option value="viewer">Viewer (Read-only)</option>
          </select>
        </div>

        {!isEnvReady() && (
          <div style={{ marginTop: 16, background: '#450a0a', border: '1px solid #7f1d1d', padding: 12, borderRadius: 8, fontSize: '0.75rem' }}>
            Environment variables not set.
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 60px', overflowY: 'auto', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {isAdding ? (
            <div>
              <button
                className="btn-back"
                onClick={() => { setIsAdding(false); setEditingId(null); setPresetAssetId(null); }}
                style={{ marginBottom: 24, border: 'none', background: 'none', color: '#64748b' }}
              >
                ← กลับไปหน้ารายการ
              </button>
              <div className="card">
                {activeTab === 'assets' && <AssetForm assetId={editingId} onSaved={handleSaved} />}
                {activeTab === 'computers' && <ComputerForm computerId={editingId} onSaved={handleSaved} />}
                {activeTab === 'employees' && <EmployeeForm employeeId={editingId} onSaved={handleSaved} />}
                {activeTab === 'printers' && <PrinterForm printerId={editingId} onSaved={handleSaved} />}
                {activeTab === 'software' && <SoftwareForm softwareId={editingId} onSaved={handleSaved} />}
                {activeTab === 'maintenance' && <MaintenanceForm maintenanceId={editingId} onSaved={handleSaved} />}
                {activeTab === 'spare_parts' && <SparePartsForm sparePartId={editingId} onSaved={handleSaved} />}
                {activeTab === 'loans' && <LoanForm onSaved={handleSaved} presetAssetId={presetAssetId} />}
                {activeTab === 'repairs' && <RepairForm onSaved={handleSaved} presetAssetId={presetAssetId} />}
              </div>
            </div>
          ) : (
            <div>
              {activeTab === 'home' && <Dashboard />}
              {activeTab === 'assets' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ทรัพย์สิน IT</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>จัดการฮาร์ดแวร์และอุปกรณ์ทั้งหมดในบริษัท (ISO 27001 Assets)</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มทรัพย์สินใหม่</button>}
                  </div>
                  <AssetList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'computers' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>คอมพิวเตอร์</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ทะเบียนเครื่องคอมพิวเตอร์และโน้ตบุ๊กแยกหมวดหมู่</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มเครื่องใหม่</button>}
                  </div>
                  <ComputerList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'employees' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ทะเบียนพนักงาน</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ข้อมูลพนักงานเพื่ออ้างอิงสิทธิ์การเข้าถึงและการครอบครอง</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มพนักงานใหม่</button>}
                  </div>
                  <EmployeeList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'printers' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>เครื่องพิมพ์</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ทรัพยากรเครื่องพิมพ์และการแชร์ใช้งาน</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มเครื่องพิมพ์ใหม่</button>}
                  </div>
                  <PrinterList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'software' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ซอฟต์แวร์และลิขสิทธิ์</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ควบคุมซอฟต์แวร์ลิขสิทธิ์ (ISO A.18.2 Compliance)</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มลิขสิทธิ์ใหม่</button>}
                  </div>
                  <SoftwareList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'maintenance' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ประวัติบำรุงรักษา</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>บันทึกการซ่อมแซมและการตรวจเช็คตามรอบ (ISO Continuity)</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ บันทึกงานซ่อม/บำรุง</button>}
                  </div>
                  <MaintenanceList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'spare_parts' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>คลังอะไหล่ (Spare Parts)</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>สต๊อกอุปกรณ์ต่อพ่วงและวัสดุสิ้นเปลือง (ISO Stock Control)</p>
                    </div>
                    {role === 'admin' && <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มรายการใหม่</button>}
                  </div>
                  <SparePartsList onEdit={handleEdit} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'loans' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ระบบยืม-คืน (Loan System)</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ติดตามการยืม-คืนอุปกรณ์และโน้ตบุ๊ก</p>
                    </div>
                  </div>
                  <LoanList onNewLoan={() => setIsAdding(true)} readOnly={role === 'viewer'} />
                </>
              )}
              {activeTab === 'repairs' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ระบบแจ้งซ่อม (Repair Request)</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>รับแจ้งซ่อม ติดตามสถานะ และปิดงานพร้อมบันทึกประวัติบำรุงรักษาอัตโนมัติ</p>
                    </div>
                  </div>
                  <RepairList onNewRepair={() => setIsAdding(true)} readOnly={role === 'viewer'} />
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
