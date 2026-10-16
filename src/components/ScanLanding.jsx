import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { machineName, isLeaver } from '../audit/docs.jsx'

// หน้าสาธารณะ (ไม่ต้อง login) — ไม่แสดงรหัสพนักงาน แสดงเฉพาะชื่อผู้ใช้เพื่อยืนยันว่าเป็นเครื่องที่ถูกต้อง
export default function ScanLanding({ assetTag, onRepair, onLoan, onClose }) {
    const [asset, setAsset] = useState(null)
    const [userName, setUserName] = useState('')
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            const client = getSupabase()
            if (!client) { setLoading(false); return }
            const { data, error: err } = await client
                .from('assets')
                .select('id, asset_tag, model, owner, location, building, position_detail, status')
                .eq('asset_tag', assetTag)
                .maybeSingle()
            if (err) { setError(err.message); setLoading(false); return }
            if (!data) { setNotFound(true); setLoading(false); return }
            setAsset(data)
            if (data.owner === '0000') setUserName('เครื่องส่วนกลาง')
            else if (data.owner) {
                const { data: emp } = await client.from('employees').select('name').eq('employee_id', data.owner).maybeSingle()
                if (emp && !isLeaver(emp.name)) setUserName(emp.name)
            }
            setLoading(false)
        }
        load()
    }, [assetTag])

    const place = asset ? [asset.building, asset.position_detail, asset.location].filter(Boolean).join(' · ') : ''

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 20 }}>
            <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📱</div>
                <h2 style={{ marginBottom: 4 }}>สแกนอุปกรณ์</h2>

                {loading && <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูลเครื่อง...</p>}

                {error && (
                    <div style={{ margin: '20px 0', padding: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
                        เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง หรือแจ้งเจ้าหน้าที่ IT โดยตรง<br />
                        <span style={{ fontSize: '0.8rem' }}>({error})</span>
                    </div>
                )}

                {notFound && (
                    <div style={{ margin: '20px 0', padding: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
                        ไม่พบเครื่องรหัส <strong>{assetTag}</strong> ในระบบ — กรุณาแจ้งเจ้าหน้าที่ IT
                    </div>
                )}

                {asset && (
                    <>
                        <div style={{ margin: '16px 0 24px', padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'left' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{machineName(asset.asset_tag)}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{asset.asset_tag}</div>
                            <div style={{ fontWeight: 500 }}>{asset.model || '-'}</div>
                            {(userName || place) && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                    {userName && <>ผู้ใช้งาน: {userName}<br /></>}
                                    {place && <>สถานที่: {place}</>}
                                </div>
                            )}
                        </div>

                        {asset.status === 'retired' && (
                            <div style={{ marginBottom: 16, padding: 12, background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: '0.9rem' }}>
                                เครื่องนี้ถูกปลดระวางแล้ว ถ้ายังใช้งานอยู่กรุณาแจ้งเจ้าหน้าที่ IT
                            </div>
                        )}

                        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>ต้องการทำรายการอะไรกับเครื่องนี้?</p>
                        <div style={{ display: 'grid', gap: 12 }}>
                            <button className="primary" style={{ padding: '16px', fontSize: '1.05rem' }} onClick={() => onRepair(asset.id)}>
                                🛎️ แจ้งซ่อมเครื่องนี้
                            </button>
                            <button className="secondary" style={{ padding: '16px', fontSize: '1.05rem' }} onClick={() => onLoan(asset.id)}>
                                🔄 ยืมเครื่องนี้
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
