import { useState } from 'react'
import ScanLanding from './ScanLanding.jsx'
import RepairForm from './RepairForm.jsx'
import LoanForm from './LoanForm.jsx'

// โหมดเฉพาะสำหรับคนที่สแกน QR ด้วยมือถือ (ไม่เข้าหน้าแอดมิน)
export default function ScanFlow({ assetTag, onClose }) {
    const [mode, setMode] = useState('menu') // menu | repair | loan | done
    const [assetId, setAssetId] = useState(null)
    const [doneMsg, setDoneMsg] = useState('')

    if (mode === 'menu') {
        return (
            <ScanLanding
                assetTag={assetTag}
                onRepair={(id) => { setAssetId(id); setMode('repair') }}
                onLoan={(id) => { setAssetId(id); setMode('loan') }}
                onClose={onClose}
            />
        )
    }

    if (mode === 'done') {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 8 }}>✅</div>
                    <h2 style={{ marginBottom: 8 }}>ทำรายการสำเร็จ</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{doneMsg}</p>
                    <button className="primary" style={{ width: '100%', marginTop: 20 }} onClick={() => setMode('menu')}>
                        ทำรายการอื่นกับเครื่องนี้
                    </button>
                </div>
            </div>
        )
    }

    const wrap = (title, children) => (
        <div style={{ minHeight: '100vh', background: '#0f172a', padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
                <button className="secondary" style={{ marginBottom: 16 }} onClick={() => setMode('menu')}>← กลับ</button>
                <div className="card">{children}</div>
            </div>
        </div>
    )

    if (mode === 'repair') {
        return wrap('แจ้งซ่อม', (
            <RepairForm
                stacked
                presetAssetId={assetId}
                onSaved={() => { setDoneMsg('ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว เจ้าหน้าที่ IT จะดำเนินการต่อไป'); setMode('done') }}
            />
        ))
    }

    if (mode === 'loan') {
        return wrap('ยืมอุปกรณ์', (
            <LoanForm
                stacked
                presetAssetId={assetId}
                onSaved={() => { setDoneMsg('บันทึกการยืมเรียบร้อยแล้ว'); setMode('done') }}
            />
        ))
    }

    return null
}
