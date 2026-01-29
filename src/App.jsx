import AssetForm from './components/AssetForm.jsx'
import AssetList from './components/AssetList.jsx'
import { isEnvReady } from './supabaseClient.js'

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, display: 'grid', gap: 24 }}>
      <h1 style={{ margin: 0 }}>ระบบจัดการทรัพย์สิน IT</h1>
      {!isEnvReady() && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 12, borderRadius: 8 }}>
          ตั้งค่าแปรค่าแวดล้อม VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ก่อนใช้งาน
        </div>
      )}
      <AssetForm onSaved={() => {}} />
      <AssetList />
    </div>
  )
}
