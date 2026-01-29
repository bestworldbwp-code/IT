import { useState } from 'react'
import AssetForm from './components/AssetForm.jsx'
import AssetList from './components/AssetList.jsx'
import { isEnvReady } from './supabaseClient.js'

export default function App() {
  const [view, setView] = useState('list') // 'list' | 'add' | 'edit'
  const [editingId, setEditingId] = useState(null)

  const handleEdit = (id) => {
    setEditingId(id)
    setView('edit')
  }

  const handleSaved = () => {
    setView('list')
    setEditingId(null)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: 260,
        background: '#1e293b',
        color: 'white',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'sticky',
        top: 0,
        height: '100vh'
      }}>
        <h2 style={{ color: 'white', marginBottom: 32, fontSize: '1.25rem', padding: '0 8px' }}>Asset IT</h2>

        <button
          onClick={() => { setView('list'); setEditingId(null); }}
          style={{
            background: view === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: 'white',
            border: 'none',
            textAlign: 'left',
            padding: '12px 16px',
            borderRadius: 8
          }}
        >
          รายการทรัพย์สิน
        </button>

        <button
          onClick={() => { setView('add'); setEditingId(null); }}
          style={{
            background: view === 'add' ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: 'white',
            border: 'none',
            textAlign: 'left',
            padding: '12px 16px',
            borderRadius: 8
          }}
        >
          เพิ่มทรัพย์สินใหม่
        </button>

        {!isEnvReady() && (
          <div style={{ marginTop: 'auto', background: '#450a0a', border: '1px solid #7f1d1d', padding: 12, borderRadius: 8, fontSize: '0.75rem' }}>
            ยังไม่ได้ตั้งค่า Environment Variables
          </div>
        )}
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 40, overflowY: 'auto' }}>
        {view === 'list' && <AssetList onEdit={handleEdit} />}
        {(view === 'add' || view === 'edit') && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <button
              onClick={() => { setView('list'); setEditingId(null); }}
              style={{ marginBottom: 20, color: '#64748b' }}
            >
              ← กลับไปหน้ารายการ
            </button>
            <div className="card">
              <AssetForm assetId={editingId} onSaved={handleSaved} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
