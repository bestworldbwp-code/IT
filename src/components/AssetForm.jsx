import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'

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

export default function AssetForm({ assetId, onSaved }) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState([])

  useEffect(() => {
    async function loadAsset() {
      if (!assetId) {
        setData(initial)
        return
      }
      const client = getSupabase()
      setFetching(true)
      const { data: asset, error: err } = await client.from('assets').select('*').eq('id', assetId).single()
      setFetching(false)
      if (err) {
        setError(err.message)
      } else {
        setData(asset)
      }
    }
    loadAsset()
  }, [assetId])

  useEffect(() => {
    async function loadEmployees() {
      const client = getSupabase()
      if (!client) return
      const { data: emps } = await client.from('employees').select('name').limit(100)
      if (emps) setEmployees(emps.map(e => e.name))
    }
    loadEmployees()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const client = getSupabase()
    if (!client) return

    setLoading(true)
    const payload = { ...data }
    delete payload.id
    delete payload.created_at

    let result
    if (assetId) {
      result = await client.from('assets').update(payload).eq('id', assetId)
    } else {
      result = await client.from('assets').insert(payload)
    }

    setLoading(false)
    if (result.error) {
      setError(result.error.message)
    } else {
      onSaved()
    }
  }

  function setField(k, v) {
    setData((d) => ({ ...d, [k]: v }))
  }

  if (fetching) return <div>กำลังโหลดข้อมูล...</div>

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ marginBottom: 24 }}>{assetId ? 'แก้ไขข้อมูลทรัพย์สิน' : 'บันทึกทรัพย์สินใหม่'}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div>
          <label>Asset Tag *</label>
          <input required value={data.asset_tag} onChange={(e) => setField('asset_tag', e.target.value)} placeholder="เช่น PC001" />
        </div>
        <div>
          <label>Serial Number *</label>
          <input required value={data.serial} onChange={(e) => setField('serial', e.target.value)} placeholder="S/N ของเครื่อง" />
        </div>
        <div>
          <label>รุ่น/โมเดล</label>
          <input value={data.model} onChange={(e) => setField('model', e.target.value)} placeholder="เช่น Dell OptiPlex 7000" />
        </div>
        <div>
          <label>หน่วยประมวลผล (CPU)</label>
          <input value={data.cpu} onChange={(e) => setField('cpu', e.target.value)} placeholder="เช่น i7-12700" />
        </div>
        <div>
          <label>หน่วยความจำ (RAM)</label>
          <input value={data.ram} onChange={(e) => setField('ram', e.target.value)} placeholder="เช่น 16GB" />
        </div>
        <div>
          <label>ความจุ (Storage)</label>
          <input value={data.storage} onChange={(e) => setField('storage', e.target.value)} placeholder="เช่น 512GB SSD" />
        </div>
        <div>
          <label>ผู้ถือครอง</label>
          <input
            list="employee-list"
            value={data.owner}
            onChange={(e) => setField('owner', e.target.value)}
            placeholder="ชื่อพนักงาน"
          />
          <datalist id="employee-list">
            {employees.map(name => <option key={name} value={name} />)}
          </datalist>
        </div>
        <div>
          <label>สถานที่</label>
          <input value={data.location} onChange={(e) => setField('location', e.target.value)} placeholder="ชั้น/ห้อง" />
        </div>
        <div>
          <label>วันที่ซื้อ</label>
          <input type="date" value={data.purchase_date || ''} onChange={(e) => setField('purchase_date', e.target.value)} />
        </div>
        <div>
          <label>วันหมดประกัน</label>
          <input type="date" value={data.warranty_expiry || ''} onChange={(e) => setField('warranty_expiry', e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label>สถานะ</label>
          <select value={data.status} onChange={(e) => setField('status', e.target.value)}>
            <option value="in_use">ใช้งาน (In Use)</option>
            <option value="stock">สต๊อก (Stock)</option>
            <option value="repair">ซ่อม (Repair)</option>
            <option value="retired">ปลดระวาง (Retired)</option>
          </select>
        </div>

        {/* ISO 27001 Classification Section */}
        <div style={{ gridColumn: 'span 2', marginTop: 12, padding: 16, background: '#f1f5f9', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>ISO 27001 Classification & Lifecycle</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label>Confidentiality</label>
              <select value={data.confidentiality_level || 'internal'} onChange={(e) => setField('confidentiality_level', e.target.value)}>
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
            <div>
              <label>Integrity</label>
              <select value={data.integrity_level || 'medium'} onChange={(e) => setField('integrity_level', e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label>Availability</label>
              <select value={data.availability_level || 'medium'} onChange={(e) => setField('availability_level', e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {data.status === 'retired' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label>วันที่จำหน่ายออก (Disposal Date)</label>
                <input type="date" value={data.disposal_date || ''} onChange={(e) => setField('disposal_date', e.target.value)} />
              </div>
              <div>
                <label>วิธีการทำลาย/จำหน่าย (Disposal Method)</label>
                <input value={data.disposal_method || ''} onChange={(e) => setField('disposal_method', e.target.value)} placeholder="เช่น ทำลายฮาร์ดดิสก์/บริจาค" />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="primary" style={{ flex: 1 }} disabled={loading} type="submit">
          {loading ? 'กำลังบันทึก...' : assetId ? 'บันทึกการแก้ไข' : 'บันทึกทรัพย์สิน'}
        </button>
      </div>
    </form>
  )
}
