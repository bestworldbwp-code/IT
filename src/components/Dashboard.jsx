import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

export default function Dashboard() {
    const [stats, setStats] = useState({
        assets: 0,
        computers: 0,
        software: 0,
        maintenance: 0,
        alerts: 0
    })
    const [loading, setLoading] = useState(true)

    async function loadStats() {
        const client = getSupabase()
        if (!client) return

        const [resAssets, resComps, resSoft, resMain, resSpare] = await Promise.all([
            client.from('assets').select('id', { count: 'exact' }),
            client.from('computers').select('id', { count: 'exact' }),
            client.from('software').select('id', { count: 'exact' }),
            client.from('maintenance_logs').select('id', { count: 'exact' }),
            client.from('spare_parts').select('id', { count: 'exact' })
        ])

        // Check for alerts
        const { count: alerts } = await client.from('software').select('id', { count: 'exact' }).lt('expiry_date', new Date().toISOString())
        const { data: lowStock } = await client.from('spare_parts').select('id')
            .filter('stock_quantity', 'lte', 'min_stock_level')

        setStats({
            assets: resAssets.count || 0,
            computers: resComps.count || 0,
            software: resSoft.count || 0,
            maintenance: resMain.count || 0,
            spare: resSpare.count || 0,
            alerts: (alerts || 0) + (lowStock?.length || 0)
        })
        setLoading(false)
    }

    useEffect(() => {
        loadStats()
    }, [])

    const cards = [
        { label: 'ทรัพยสินทั้งหมด', value: stats.assets, icon: '📦', color: '#3b82f6' },
        { label: 'คอมพิวเตอร์', value: stats.computers, icon: '💻', color: '#10b981' },
        { label: 'ซอฟต์แวร์/ลิขสิทธิ์', value: stats.software, icon: '💿', color: '#8b5cf6' },
        { label: 'อะไหล่คงคลัง', value: stats.spare, icon: '🛠️', color: '#ec4899' },
    ]

    return (
        <div>
            <h1 style={{ marginBottom: 32 }}>IT Overview Dashboard</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 40 }}>
                {cards.map(c => (
                    <div key={c.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{
                            fontSize: '2rem',
                            background: c.color + '20',
                            color: c.color,
                            width: 60, height: 60, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {c.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{c.label}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{loading ? '...' : c.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                <div className="card">
                    <h3 style={{ marginBottom: 20 }}>ISO 27001 Compliance Status</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Asset Inventory Tracking</span>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Complete</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Software Licensing Control</span>
                            <span style={{ color: stats.software > 0 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                                {stats.software > 0 ? '✅ Active' : '⚠️ Pending Data'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Maintenance & Continuity</span>
                            <span style={{ color: stats.maintenance > 0 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                                {stats.maintenance > 0 ? '✅ Active' : '⚠️ Pending Data'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ background: stats.alerts > 0 ? '#fff1f2' : '#f0fdf4', border: 'none' }}>
                    <h3 style={{ marginBottom: 12 }}>System Alerts</h3>
                    {stats.alerts > 0 ? (
                        <div style={{ color: '#e11d48' }}>
                            <strong>{stats.alerts} item(s)</strong> have expired licenses or warranties. Please check the software module.
                        </div>
                    ) : (
                        <div style={{ color: '#15803d' }}>
                            All systems are within warranty and license periods.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
