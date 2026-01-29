import { useState } from 'react'
import { getSupabase, isEnvReady } from '../supabaseClient.js'

const initial = {
  asset_tag: '',
  serial: '',
  model: '',
  cpu: '',
  ram: '',
  storage: '',
  owner: '',
  location: '',
  purchase_date: '',
  warranty_expiry: '',
  status: 'in_use',
}

export default function AssetForm({ onSaved }) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk(false)
    const client = getSupabase()
    if (!client) {
      setError('ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL/ANON_KEY')
      return
    }
    if (!data.asset_tag || !data.serial) {
      setError('กรอก Asset Tag และ Serial ให้ครบ')
      return
    }
    setLoading(true)
    const payload = {
      asset_tag: data.asset_tag.trim(),
      serial: data.serial.trim(),
      model: data.model.trim(),
      cpu: data.cpu.trim(),
      ram: data.ram.trim(),
      storage: data.storage.trim(),
      owner: data.owner.trim(),
      location: data.location.trim(),
      purchase_date: data.purchase_date || null,
      warranty_expiry: data.warranty_expiry || null,
      status: data.status,
    }
    const { error: insertError } = await client.from('assets').insert(payload)
    setLoading(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setOk(true)
    setData(initial)
    onSaved && onSaved()
  }

  function setField(k, v) {
    setData((d) => ({ ...d, [k]: v }))
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
      <h2>บันทึกทรัพย์สิน</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>
          Asset Tag
          <input value={data.asset_tag} onChange={(e) => setField('asset_tag', e.target.value)} />
        </label>
        <label>
          Serial
          <input value={data.serial} onChange={(e) => setField('serial', e.target.value)} />
        </label>
        <label>
          รุ่น/โมเดล
          <input value={data.model} onChange={(e) => setField('model', e.target.value)} />
        </label>
        <label>
          CPU
          <input value={data.cpu} onChange={(e) => setField('cpu', e.target.value)} />
        </label>
        <label>
          RAM
          <input value={data.ram} onChange={(e) => setField('ram', e.target.value)} />
        </label>
        <label>
          Storage
          <input value={data.storage} onChange={(e) => setField('storage', e.target.value)} />
        </label>
        <label>
          ผู้ถือครอง
          <input value={data.owner} onChange={(e) => setField('owner', e.target.value)} />
        </label>
        <label>
          สถานที่
          <input value={data.location} onChange={(e) => setField('location', e.target.value)} />
        </label>
        <label>
          วันซื้อ
          <input type="date" value={data.purchase_date} onChange={(e) => setField('purchase_date', e.target.value)} />
        </label>
        <label>
          หมดประกัน
          <input type="date" value={data.warranty_expiry} onChange={(e) => setField('warranty_expiry', e.target.value)} />
        </label>
        <label>
          สถานะ
          <select value={data.status} onChange={(e) => setField('status', e.target.value)}>
            <option value="in_use">ใช้งาน</option>
            <option value="stock">สต๊อก</option>
            <option value="repair">ซ่อม</option>
            <option value="retired">ปลดระวาง</option>
          </select>
        </label>
      </div>

      <button disabled={loading} type="submit">{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      {ok && <div style={{ color: 'green' }}>บันทึกสำเร็จ</div>}
    </form>
  )
}
