import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function ScanLanding({ assetTag, onRepair, onLoan, onClose }) {
    const [asset, setAsset] = useState(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        async function load() {
            const client = getSupabase()
            if (!client) { setLoading(false); return }
            const { data } = await client
                .from('assets')
                .select('id, asset_tag, model, serial, owner, location, status')
                .eq('asset_tag', assetTag)
                .maybeSingle()
            setLoading(false)
            if (data) setAsset(data)
            else setNotFound(true)
        }
        load()
    }, [assetTag])

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 20 }}>
            <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📱</div>
                <h2 style={{ marginBottom: 4 }}>สแกนอุปกรณ์</h2>

                {loading && <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูลเครื่อง...</p>}

                {notFound && (
                    <div style={{ margin: '20px 0', padding: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
                        ไม่พบเครื่องรหัส <strong>{assetTag}</strong> ในระบบ
                    </div>
                )}

                {asset && (
                    <>
                        <div style={{ margin: '16px 0 24px', padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'left' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{asset.asset_tag}</div>
                            <div style={{ fontWeight: 500 }}>{asset.model || '-'}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                S/N: {asset.serial || '-'}<br />
                                ผู้ถือครอง: {asset.owner || '-'}<br />
                                สถานที่: {asset.location || '-'}
                            </div>
                        </div>

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
