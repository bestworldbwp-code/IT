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
import { isEnvReady } from './supabaseClient.js'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [editingId, setEditingId] = useState(null)
  const [isAdding, setIsAdding] = useState(false)

  const handleEdit = (id) => {
    setEditingId(id)
    setIsAdding(true)
  }

  const handleSaved = () => {
    setIsAdding(false)
    setEditingId(null)
  }

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: '📊' },
    { id: 'assets', label: 'ทรัพย์สิน IT (Hardware)', icon: '📦' },
    { id: 'computers', label: 'คอมพิวเตอร์ (PC/NB)', icon: '💻' },
    { id: 'printers', label: 'เครื่องพิมพ์ (Printers)', icon: '🖨️' },
    { id: 'employees', label: 'ทะเบียนพนักงาน', icon: '👥' },
    { id: 'software', label: 'ซอฟต์แวร์และลิขสิทธิ์', icon: '💿' },
    { id: 'maintenance', label: 'ประวัติบำรุงรักษา', icon: '🔧' },
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
            {item.label}
          </button>
        ))}

        {!isEnvReady() && (
          <div style={{ marginTop: 'auto', background: '#450a0a', border: '1px solid #7f1d1d', padding: 12, borderRadius: 8, fontSize: '0.75rem' }}>
            Environment variables not set.
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 60px', overflowY: 'auto', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {activeTab === 'home' && !isAdding && <Dashboard />}

          {isAdding ? (
            <div>
              <button
                className="btn-back"
                onClick={() => { setIsAdding(false); setEditingId(null); }}
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
                {activeTab === 'maintenance' && <MaintenanceForm onSaved={handleSaved} />}
              </div>
            </div>
          ) : (
            <div>
              {/* ... (previous modules) */}
              {activeTab === 'assets' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ทรัพย์สิน IT</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>จัดการฮาร์ดแวร์และอุปกรณ์ทั้งหมดในบริษัท (ISO 27001 Assets)</p>
                    </div>
                    <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มทรัพย์สินใหม่</button>
                  </div>
                  <AssetList onEdit={handleEdit} />
                </>
              )}
              {activeTab === 'computers' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>คอมพิวเตอร์</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ทะเบียนเครื่องคอมพิวเตอร์และโน้ตบุ๊กแยกหมวดหมู่</p>
                    </div>
                    <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มเครื่องใหม่</button>
                  </div>
                  <ComputerList onEdit={handleEdit} />
                </>
              )}
              {activeTab === 'employees' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ทะเบียนพนักงาน</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ข้อมูลพนักงานเพื่ออ้างอิงสิทธิ์การเข้าถึงและการครอบครอง</p>
                    </div>
                    <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มพนักงานใหม่</button>
                  </div>
                  <EmployeeList onEdit={handleEdit} />
                </>
              )}
              {activeTab === 'printers' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>เครื่องพิมพ์</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ทรัพยากรเครื่องพิมพ์และการแชร์ใช้งาน</p>
                    </div>
                    <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มเครื่องพิมพ์ใหม่</button>
                  </div>
                  <PrinterList onEdit={handleEdit} />
                </>
              )}
              {activeTab === 'software' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ซอฟต์แวร์และลิขสิทธิ์</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>ควบคุมซอฟต์แวร์ลิขสิทธิ์ (ISO A.18.2 Compliance)</p>
                    </div>
                    <button className="primary" onClick={() => setIsAdding(true)}>+ เพิ่มลิขสิทธิ์ใหม่</button>
                  </div>
                  <SoftwareList onEdit={handleEdit} />
                </>
              )}
              {activeTab === 'maintenance' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.875rem' }}>ประวัติบำรุงรักษา</h1>
                      <p style={{ margin: '4px 0 0', color: '#64748b' }}>บันทึกการซ่อมแซมและการตรวจเช็คตามรอบ (ISO Continuity)</p>
                    </div>
                    <button className="primary" onClick={() => setIsAdding(true)}>+ บันทึกงานซ่อม/บำรุง</button>
                  </div>
                  <MaintenanceList />
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
