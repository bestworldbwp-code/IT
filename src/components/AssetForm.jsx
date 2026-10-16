import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { categoryOfTag, isLeaver } from '../audit/docs.jsx'

const initial = {
  asset_tag: '',
  serial: '',
  model: '',
  cpu: '',
  ram: '',
  storage: '',
  owner: '',
  location: '',
  building: '',
  position_detail: '',
  rank: 'A',
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
      const { data: emps } = await client.from('employees').select('employee_id, name, department').order('employee_id').limit(500)
      if (emps) setEmployees(emps)
    }
    loadEmployees()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const client = getSupabase()
    if (!client) return

    setLoading(true)
    const payload = { ...data, asset_tag: String(data.asset_tag || '').trim().toUpperCase(), owner: String(data.owner || '').trim() }
    delete payload.id
    delete payload.created_at
    if (!payload.category) payload.category = categoryOfTag(payload.asset_tag)

    const save = (body) => assetId ? client.from('assets').update(body).eq('id', assetId) : client.from('assets').insert(body)
    let result = await save(payload)
    // ฐานข้อมูลบางชุดยังไม่มีคอลัมน์นี้ (ดู migrations/2026-10-15c) — ตัดออกแล้วบันทึกซ้ำ ไม่ให้ผู้ใช้ติดค้าง
    if (result.error?.message?.includes("'document_url' column")) {
      delete payload.document_url
      result = await save(payload)
    }

    if (!result.error) {
      // ทะเบียนชุดเดิม (computers / printers) ให้ผู้ใช้ตรงกับทะเบียนหลักเสมอ
      await Promise.all([
        client.from('computers').update({ user_id: payload.owner }).eq('computer_id', payload.asset_tag),
        client.from('printers').update({ user_id: payload.owner }).eq('printer_id', payload.asset_tag),
      ])
    }
    setLoading(false)
    if (result.error) {
      setError(result.error.code === '23505' ? `รหัสเครื่องจักร ${payload.asset_tag} มีอยู่ในทะเบียนแล้ว` : result.error.message)
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
      <h2 style={{ marginBottom: 24 }}>{assetId ? 'แก้ไขทะเบียนเครื่อง' : 'ขึ้นทะเบียนเครื่องใหม่ (FQP-IT-01:01)'}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div>
          <label>รหัสเครื่องจักร (AAA-BB-CC) *</label>
          <input required value={data.asset_tag} onChange={(e) => setField('asset_tag', e.target.value.toUpperCase())} placeholder="เช่น COM-IT-65 / PNT-IT-26" pattern="[A-Z]+-[A-Z]+-[0-9]+" title="รูปแบบ AAA-BB-CC เช่น COM-IT-01" />
        </div>
        <div>
          <label>S/N No</label>
          <input value={data.serial || ''} onChange={(e) => setField('serial', e.target.value)} placeholder="S/N ของเครื่อง" />
        </div>
        <div>
          <label>รุ่น (Brand / Model)</label>
          <input value={data.model || ''} onChange={(e) => setField('model', e.target.value)} placeholder="เช่น Dell OptiPlex 7000" />
        </div>
        <div>
          <label>Capacity — CPU</label>
          <input value={data.cpu || ''} onChange={(e) => setField('cpu', e.target.value)} placeholder="เช่น i7-12700" />
        </div>
        <div>
          <label>Capacity — RAM</label>
          <input value={data.ram || ''} onChange={(e) => setField('ram', e.target.value)} placeholder="เช่น 16GB" />
        </div>
        <div>
          <label>Capacity — Storage</label>
          <input value={data.storage || ''} onChange={(e) => setField('storage', e.target.value)} placeholder="เช่น 512GB SSD" />
        </div>
        <div>
          <label>ผู้ใช้งาน (รหัสพนักงาน)</label>
          <input
            list="employee-list"
            value={data.owner || ''}
            onChange={(e) => setField('owner', e.target.value)}
            placeholder="รหัสพนักงาน เช่น 110001"
          />
          <datalist id="employee-list">
            {[...employees].filter(e => !isLeaver(e.name)).sort((a, b) => (a.employee_id === '0000' ? -1 : b.employee_id === '0000' ? 1 : 0)).map(e => <option key={e.employee_id} value={e.employee_id}>{e.employee_id === '0000' ? '🏢 เครื่องส่วนกลาง (ไม่มีผู้ใช้ประจำ)' : `${e.name}${e.department ? ` (${e.department})` : ''}`}</option>)}
          </datalist>
        </div>
        <div>
          <label>แผนก / สถานที่ติดตั้ง</label>
          <input value={data.location || ''} onChange={(e) => setField('location', e.target.value)} placeholder="เช่น บัญชี" />
        </div>
        <div>
          <label>อาคาร</label>
          <input value={data.building || ''} onChange={(e) => setField('building', e.target.value)} placeholder="เช่น อาคารสำนักงาน" />
        </div>
        <div>
          <label>ตำแหน่งที่ตั้ง (ชั้น / ห้อง / จุดวาง)</label>
          <input value={data.position_detail || ''} onChange={(e) => setField('position_detail', e.target.value)} placeholder="เช่น ชั้น 2 โต๊ะ 3" />
        </div>
        <div>
          <label>RANK (ความสำคัญตามทะเบียน)</label>
          <select value={data.rank || 'A'} onChange={(e) => setField('rank', e.target.value)}>
            <option value="A">A — สำคัญมาก</option>
            <option value="B">B — ปานกลาง</option>
            <option value="C">C — ทั่วไป</option>
          </select>
        </div>
        <div>
          <label>วันรับเข้า (Received Date)</label>
          <input type="date" value={data.purchase_date || ''} onChange={(e) => setField('purchase_date', e.target.value)} />
        </div>
        <div>
          <label>วันหมดประกัน</label>
          <input type="date" value={data.warranty_expiry || ''} onChange={(e) => setField('warranty_expiry', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label>สถานะ</label>
          <select value={data.status || 'in_use'} onChange={(e) => setField('status', e.target.value)}>
            <option value="in_use">ใช้งาน</option>
            <option value="stock">สำรอง</option>
            <option value="repair">ส่งซ่อม</option>
            <option value="retired">ปลดระวาง / ยกเลิก</option>
          </select>
        </div>

        {/* ISO 27001 Classification Section */}
        <div style={{ gridColumn: '1 / -1', marginTop: 12, padding: 16, background: '#f1f5f9', borderRadius: 8 }}>
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
          <div style={{ marginTop: 12 }}>
            <label>Link เอกสารอ้างอิง (Google Drive/Share Point)</label>
            <input
              value={data.document_url || ''}
              onChange={(e) => setField('document_url', e.target.value)}
              placeholder="เช่น Link ใบเสร็จ หรือ ใบรับประกัน"
            />
          </div>
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
