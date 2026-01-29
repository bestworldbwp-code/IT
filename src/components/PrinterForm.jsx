import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

const initial = {
    printer_id: '',
    model: '',
    user_id: '',
}

export default function PrinterForm({ printerId, onSaved }) {
    const [data, setData] = useState(initial)
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)

    useEffect(() => {
        async function load() {
            if (!printerId) {
                setData(initial)
                return
            }
            const client = getSupabase()
            setFetching(true)
            const { data: prn, error } = await client.from('printers').select('*').eq('id', printerId).single()
            setFetching(false)
            if (!error) setData(prn)
        }
        load()
    }, [printerId])

    async function handleSubmit(e) {
        e.preventDefault()
        const client = getSupabase()
        setLoading(true)
        const payload = { ...data }
        delete payload.id
        delete payload.created_at

        let res
        if (printerId) {
            res = await client.from('printers').update(payload).eq('id', printerId)
        } else {
            res = await client.from('printers').insert(payload)
        }
        setLoading(false)
        if (!res.error) onSaved()
        else alert(res.error.message)
    }

    if (fetching) return <div>กำลังโหลด...</div>

    return (
        <form onSubmit={handleSubmit}>
            <h2 style={{ marginBottom: 24 }}>{printerId ? 'แก้ไขข้อมูลเครื่องพิมพ์' : 'บันทึกเครื่องพิมพ์ใหม่'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <label>Printer ID *</label>
                    <input required value={data.printer_id} onChange={(e) => setData({ ...data, printer_id: e.target.value })} placeholder="เช่น PRN-ACC-01" />
                </div>
                <div>
                    <label>รุ่น/โมเดล</label>
                    <input value={data.model} onChange={(e) => setData({ ...data, model: e.target.value })} placeholder="เช่น HP LaserJet Pro M404" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label>รหัสพนักงานผู้ใช้งานหลัก</label>
                    <input value={data.user_id} onChange={(e) => setData({ ...data, user_id: e.target.value })} />
                </div>
            </div>
            <button className="primary" style={{ width: '100%', marginTop: 24 }} type="submit" disabled={loading}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลเครื่องพิมพ์'}
            </button>
        </form>
    )
}
