import { useEffect, useState } from 'react'
import { getSupabase } from './supabaseClient.js'

let cache = null

// โหลดทะเบียนพนักงานครั้งเดียว ใช้แปลงรหัสพนักงาน -> ชื่อ (แผนก) ในทุกตาราง
export function useEmployees() {
  const [map, setMap] = useState(cache || {})
  useEffect(() => {
    const client = getSupabase()
    if (!client) return
    client.from('employees').select('employee_id, name, department, position').then(({ data }) => {
      cache = Object.fromEntries((data || []).map(e => [e.employee_id, e]))
      setMap(cache)
    })
  }, [])
  return map
}

// แสดง "รหัส · ชื่อ (แผนก)" — ถ้ารหัสไม่ตรงกับทะเบียน แสดงตามที่บันทึกไว้
export const SHARED_ID = '0000' // รหัสพิเศษ = เครื่องส่วนกลาง ใช้ร่วมกันในแผนก

export function EmployeeName({ id, map }) {
  if (!id) return <span style={{ color: 'var(--text-muted)' }}>-</span>
  if (id === SHARED_ID) return <span className="badge" style={{ background: '#e0f2fe', color: '#075985' }}>🏢 เครื่องส่วนกลาง</span>
  const e = map?.[id]
  if (!e) return <span>{id}</span>
  const left = /^\[ลาออก\]/.test(e.name)
  return (
    <span>
      {left && <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', marginRight: 6 }}>ลาออก</span>}
      <span style={{ fontWeight: 500, color: left ? '#991b1b' : undefined }}>{e.name.replace(/^\[ลาออก\]\s*/, '')}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> · {id}{e.department ? ` · ${e.department}` : ''}</span>
    </span>
  )
}
