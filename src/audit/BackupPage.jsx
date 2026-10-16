import { useEffect, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { DocHeader, SignatureBlock, DocToolbar, fmtDateTime, downloadText, toCSV, today, localStamp, getDocSettings } from './docs.jsx'

const TABLES = [
  ['assets', 'ทรัพย์สิน IT'], ['computers', 'คอมพิวเตอร์'], ['printers', 'เครื่องพิมพ์'], ['employees', 'พนักงาน'],
  ['software', 'ซอฟต์แวร์/ลิขสิทธิ์'], ['spare_parts', 'คลังอะไหล่'], ['maintenance_logs', 'ประวัติบำรุงรักษา'],
  ['repair_requests', 'แจ้งซ่อม'], ['loans', 'ยืม-คืน'], ['audit_logs', 'บันทึกการตรวจสอบ'],
]

// สำรองข้อมูลทุกตารางเป็นไฟล์ และบันทึกประวัติลง audit_logs (action = 'backup') เพื่อใช้เป็นหลักฐานออดิท
export default function BackupPage() {
  const [counts, setCounts] = useState({})
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [note, setNote] = useState('')
  const [storage, setStorage] = useState('โฟลเดอร์ Downloads ของเครื่องนี้')

  async function load() {
    const client = getSupabase()
    if (!client) return
    const res = await Promise.all(TABLES.map(([t]) => client.from(t).select('id', { count: 'exact', head: true })))
    setCounts(Object.fromEntries(TABLES.map(([t], i) => [t, res[i].count ?? '?'])))
    const { data } = await client.from('audit_logs').select('*').eq('action', 'backup').order('created_at', { ascending: false }).limit(50)
    setHistory(data || [])
  }
  useEffect(() => { load() }, [])

  async function fetchAll(table) {
    const client = getSupabase()
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from(table).select('*').order('id').range(from, from + 999)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  async function record(kind, detail) {
    const client = getSupabase()
    const s = getDocSettings()
    const { error } = await client.from('audit_logs').insert({
      action: 'backup', table_name: kind, record_id: today(),
      new_data: { ...detail, storage, note, performed_at: new Date().toISOString() },
      performed_by: s.preparer || 'IT Admin',
    })
    if (error) alert('บันทึกประวัติการสำรองไม่สำเร็จ: ' + error.message)
  }

  async function backupAll(format) {
    setBusy(true)
    try {
      const dump = {}
      const summary = {}
      for (const [t, label] of TABLES) {
        setProgress(`กำลังดึง ${label}...`)
        dump[t] = await fetchAll(t)
        summary[t] = dump[t].length
      }
      const stamp = localStamp()
      if (format === 'json') {
        downloadText(`it-asset-backup_${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2), 'application/json')
      } else {
        for (const [t] of TABLES) {
          if (!dump[t].length) continue
          const cols = Object.keys(dump[t][0]).map(k => ({ label: k, get: r => typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k] }))
          downloadText(`${t}_${stamp}.csv`, toCSV(dump[t], cols), 'text/csv')
          await new Promise(r => setTimeout(r, 300)) // เว้นช่วงให้เบราว์เซอร์ดาวน์โหลดทีละไฟล์
        }
      }
      await record(format === 'json' ? 'full_json' : 'full_csv', { tables: summary, total: Object.values(summary).reduce((a, b) => a + b, 0) })
      alert('สำรองข้อมูลเรียบร้อย และบันทึกประวัติแล้ว')
      setNote('')
      load()
    } catch (e) {
      alert('สำรองข้อมูลไม่สำเร็จ: ' + e.message)
    } finally {
      setBusy(false); setProgress('')
    }
  }

  async function backupOne(t) {
    setBusy(true)
    try {
      const rows = await fetchAll(t)
      const cols = rows.length ? Object.keys(rows[0]).map(k => ({ label: k, get: r => typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k] })) : []
      downloadText(`${t}_${today()}.csv`, toCSV(rows, cols), 'text/csv')
      await record(t, { tables: { [t]: rows.length }, total: rows.length })
      load()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  async function recordManual() {
    if (!note.trim()) return alert('กรุณาระบุรายละเอียด เช่น สำรอง Server ด้วย Veeam')
    setBusy(true)
    await record('manual', { total: null })
    setNote(''); setBusy(false); load()
  }

  const totalRows = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0)
  const FULL = ['full_json', 'full_csv', 'auto_file', 'manual']
  const last = history.find(h => FULL.includes(h.table_name))
  const daysSince = last ? Math.floor((Date.now() - new Date(last.created_at)) / 86400000) : null

  return (
    <div>
      <div className="card no-print" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', background: daysSince == null || daysSince > 7 ? '#fef2f2' : '#f0fdf4', borderColor: daysSince == null || daysSince > 7 ? '#fecaca' : '#bbf7d0' }}>
        <div style={{ fontSize: '1.6rem' }}>{daysSince == null || daysSince > 7 ? '⚠️' : '✅'}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{last ? `สำรองข้อมูลล่าสุด ${fmtDateTime(last.created_at)} (${daysSince} วันก่อน)` : 'ยังไม่มีประวัติการสำรองข้อมูล'}</div>
          <div className="muted">แนะนำสำรองอย่างน้อยสัปดาห์ละ 1 ครั้ง · ข้อมูลในระบบทั้งหมด {totalRows.toLocaleString()} แถว</div>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 16 }}>
        <h3 className="section-title">สำรองข้อมูลทั้งระบบ (กดเองเมื่อต้องการ)</h3>
        <div style={{ background: '#eef2ff', color: '#3730a3', padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: '0.9rem' }}>
          💡 ตั้งสำรองอัตโนมัติได้ด้วย <code>npm run backup</code> ใน Task Scheduler (วิธีอยู่ใน <code>scripts/backup-schedule.md</code>) ไฟล์เก็บในโฟลเดอร์ <code>backup</code> ของโปรแกรม ประวัติจะขึ้นในตารางด้านล่างเป็น "🤖 อัตโนมัติ"
        </div>
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label>สถานที่จัดเก็บไฟล์สำรอง</label><input value={storage} onChange={e => setStorage(e.target.value)} /></div>
          <div><label>หมายเหตุ</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น สำรองประจำสัปดาห์" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="primary" disabled={busy} onClick={() => backupAll('json')}>💾 ดาวน์โหลดไฟล์สำรองทั้งหมด (JSON)</button>
          <button className="secondary" disabled={busy} onClick={() => backupAll('csv')}>📥 ดาวน์โหลดทุกตารางเป็น CSV</button>
          <button className="secondary" disabled={busy} onClick={recordManual}>📝 บันทึกการสำรองที่ทำนอกระบบ</button>
          {progress && <span className="muted">{progress}</span>}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>ไฟล์ JSON กู้คืนด้วยคำสั่ง npm run restore -- ชื่อไฟล์ (ดู scripts/backup-schedule.md) · ทุกครั้งที่กดจะบันทึกประวัติลงระบบอัตโนมัติ</div>
      </div>

      <div className="card no-print" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead><tr><th style={{ padding: '10px 16px' }}>ตาราง</th><th style={{ padding: '10px 16px', textAlign: 'right' }}>จำนวนแถว</th><th style={{ padding: '10px 16px', textAlign: 'right' }}></th></tr></thead>
          <tbody>
            {TABLES.map(([t, label]) => (
              <tr key={t}>
                <td style={{ padding: '8px 16px' }}>{label} <span className="muted">({t})</span></td>
                <td style={{ padding: '8px 16px', textAlign: 'right' }}>{counts[t] ?? '…'}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right' }}><button className="ghost" disabled={busy} onClick={() => backupOne(t)}>CSV</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocToolbar><span className="muted">บันทึกการสำรองข้อมูล (พิมพ์แนบแฟ้มออดิท)</span></DocToolbar>
      <div className="doc card">
        <DocHeader title="บันทึกการสำรองข้อมูลระบบ IT Asset (เอกสารภายใน)" />
        <table className="doc-table">
          <thead><tr><th>ลำดับ</th><th>วัน-เวลา</th><th>ประเภท</th><th>จำนวนข้อมูล</th><th>สถานที่จัดเก็บ</th><th>ผู้ดำเนินการ</th><th>หมายเหตุ</th><th>ผลการทดสอบกู้คืน</th></tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={h.id}>
                <td>{i + 1}</td><td>{fmtDateTime(h.created_at)}</td>
                <td>{{ full_json: 'ทั้งระบบ (JSON)', full_csv: 'ทั้งระบบ (CSV)', manual: 'นอกระบบ', auto_file: '🤖 อัตโนมัติ' }[h.table_name] || h.table_name}</td>
                <td>{h.new_data?.total != null ? `${Number(h.new_data.total).toLocaleString()} แถว` : '-'}</td>
                <td>{h.new_data?.storage || ''}</td><td>{h.performed_by}</td><td>{h.new_data?.note || ''}</td><td></td>
              </tr>
            ))}
            {!history.length && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 20 }}>ยังไม่มีบันทึก</td></tr>}
            {[0, 1, 2].map(i => <tr key={'b' + i}><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>)}
          </tbody>
        </table>
        <SignatureBlock roles={[{ role: 'ผู้สำรองข้อมูล (เจ้าหน้าที่ IT)' }, { role: 'อนุมัติโดย (ผช.ผจก.ฝ่ายทรัพยากรบุคคล)' }]} />
      </div>
    </div>
  )
}
