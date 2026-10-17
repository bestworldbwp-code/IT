import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { DocToolbar, fmtDate, repairDocNo, monthKey } from './docs.jsx'
import logo from '../assets-bwp-logo.png'

const STATUS = { pending: 'รอรับเรื่อง', in_progress: 'กำลังซ่อม', done: 'ซ่อมเสร็จ' }
const Chk = ({ on, children }) => <span className="chk">{on ? '☑' : '☐'} {children}</span>
const Dots = ({ n = 40 }) => <span style={{ letterSpacing: 1 }}>{'.'.repeat(n)}</span>

// เดาประเภทปัญหา (ฟอร์มเดิมมีช่องติ๊ก) จากข้อความอาการและประเภทเครื่อง
function problemType(it) {
  if (it?.problem_type) return it.problem_type
  const p = `${it?.problem || ''}`.toLowerCase()
  if (/เน็ต|internet|wifi|wi-fi|lan|network|เครือข่าย/.test(p)) return 'internet'
  if (/โปรแกรม|program|software|express|excel|word|windows|ลงโปรแกรม|ไวรัส|virus/.test(p)) return 'software'
  if (/ปริ้น|พิมพ์|printer|หมึก|กระดาษ/.test(p) || /^pnt|^pt-/i.test(it?.assets?.asset_tag || '')) return 'printer'
  if (/^com|^nb/i.test(it?.assets?.asset_tag || '') || /คอม|จอ|เมาส์|คีย์บอร์ด|เปิดไม่ติด|ช้า|ค้าง/.test(p)) return 'computer'
  return it ? 'other' : null
}

// ใบแจ้งซ่อมคอมพิวเตอร์และอุปกรณ์ IT (FQP-IT-01:03) — เลย์เอาต์ตามแบบฟอร์มเดิม
export default function RepairFormPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [month, setMonth] = useState('')
  const [picked, setPicked] = useState(new Set())

  // กรองที่ฐานข้อมูล — Supabase ส่งได้ครั้งละ 1,000 แถว ถ้ากรองในเครื่อง ใบเก่าของเดือนก่อน ๆ จะหาไม่เจอเมื่อมีใบเยอะ
  const reqRef = useRef(0)
  async function load() {
    const client = getSupabase()
    if (!client) return
    const req = ++reqRef.current
    setLoading(true)
    let q = client.from('repair_requests').select('*, assets(asset_tag, model, serial, owner, location)').order('created_at', { ascending: false }).limit(1000)
    if (filter !== 'all') q = q.eq('status', filter)
    if (month) {
      // ขอบเดือนตามเวลาไทย
      const [y, m] = month.split('-').map(Number)
      q = q.gte('created_at', new Date(y, m - 1, 1).toISOString()).lt('created_at', new Date(y, m, 1).toISOString())
    }
    const { data, error } = await q
    if (req !== reqRef.current) return
    if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { setPicked(new Set()); load() }, [filter, month]) // เปลี่ยนตัวกรองแล้วล้างที่เลือกไว้ ไม่ให้ "เลือก 5 ใบ" ค้างทั้งที่พิมพ์ไม่ครบ

  const filtered = useMemo(() => items.filter(it =>
    (filter === 'all' || it.status === filter) && (!month || monthKey(it.created_at) === month)
  ), [items, filter, month])

  const toPrint = picked.size ? filtered.filter(it => picked.has(it.id)) : filtered.slice(0, 1)
  const toggle = (id) => setPicked(s => { const n = new Set(s); n.delete(0); n.has(id) ? n.delete(id) : n.add(id); return n })
  const docNo = repairDocNo

  return (
    <div>
      <DocToolbar>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 160 }}>
          <option value="all">ทุกสถานะ</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 170 }} />
        <button className="secondary" onClick={() => setPicked(new Set(filtered.map(i => i.id)))}>เลือกทั้งหมด ({filtered.length})</button>
        <button className="ghost" onClick={() => setPicked(new Set())}>ล้าง</button>
        <button className="secondary" onClick={() => setPicked(new Set([0]))}>📄 ฟอร์มเปล่า</button>
        <span className="muted">{picked.has(0) ? 'พิมพ์ฟอร์มเปล่า' : picked.size ? `เลือก ${picked.size} ใบ` : 'ไม่ได้เลือก = พิมพ์ใบล่าสุด'}</span>
      </DocToolbar>

      <div className="history-layout">
        <div className="card no-print device-list">
          {loading && <div className="muted" style={{ padding: 12 }}>กำลังโหลด...</div>}
          {!loading && !filtered.length && <div className="muted" style={{ padding: 12 }}>ยังไม่มีใบแจ้งซ่อมในระบบ — กด "ฟอร์มเปล่า" เพื่อพิมพ์ FQP-IT-01:03 ไว้กรอกมือ</div>}
          {filtered.map(it => (
            <label key={it.id} className={`device-row ${picked.has(it.id) ? 'on' : ''}`} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 16, marginTop: 3 }} checked={picked.has(it.id)} onChange={() => toggle(it.id)} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>No. {docNo(it)} · {it.assets?.asset_tag || it.device_name || '-'}</div>
                <div className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{STATUS[it.status]} · {fmtDate(it.created_at)} · {it.problem}</div>
              </div>
            </label>
          ))}
        </div>

        <div>
          {picked.has(0) ? <RepairSheet /> : toPrint.map(it => <RepairSheet key={it.id} it={it} docNo={docNo(it)} />)}
          {!picked.has(0) && !toPrint.length && !loading && <div className="card no-print muted" style={{ textAlign: 'center', padding: 40 }}>ไม่มีใบแจ้งซ่อมให้แสดง</div>}
        </div>
      </div>
    </div>
  )
}


// ใบแจ้งซ่อม FQP-IT-01:03 — วางตามไฟล์ Excel ต้นฉบับ (เอกสาร/FQP-IT-0103.xlsx) ทุกบรรทัด
// ช่องที่มีข้อมูลในระบบจะเติมให้ ช่องที่ไม่มีเว้นจุดไว้เขียนมือเหมือนฟอร์มเดิม
const Box = ({ on }) => <span className="rf-box">{on ? '✓' : ''}</span>
const Fill = ({ v, w }) => v ? <span className="rf-fill" style={{ minWidth: w }}>{v}</span> : <span className="rf-dots" style={{ minWidth: w }} />

function Sig({ role, name }) {
  return (
    <div className="rf-sig">
      <span>ลงชื่อ</span>
      <span className="rf-sigline">{name || ''}</span>
      <span>{role}</span>
    </div>
  )
}

function RepairSheet({ it, docNo }) {
  const d = it ? new Date(it.created_at) : null
  const type = problemType(it)
  const rr = it?.repair_result
  const th = (dt) => dt ? { day: dt.getDate(), month: dt.toLocaleDateString('th-TH', { month: 'long' }), year: dt.getFullYear() + 543, time: dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) } : {}
  const td = th(d)
  const tm = (v) => v ? th(new Date(v)).time : ''
  const fixed = rr === 'fixed_no_part' || rr === 'fixed_replaced'
  const unfixed = rr === 'unfixed_outsource' || rr === 'unfixed_buy_new'
  const a = it?.assets
  const device = a ? `${a.asset_tag}${a.model ? ` (${a.model})` : ''}` : (it?.device_name || '')
  const problem = [device && `[${device}]`, it?.problem].filter(Boolean).join(' ')

  return (
    <div className="doc card sheet rf">
      <div className="rf-head">
        <img src={logo} alt="BWP" className="rf-logo" />
        <div className="rf-title">ใบแจ้งซ่อมคอมพิวเตอร์และอุปกรณ์ IT</div>
        <div className="rf-company">บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</div>
      </div>

      <div className="rf-meta">
        <div>No./เลขที่ <Fill v={docNo} w={190} /></div>
        <div>วันที่<Fill v={td.day} w={40} />เดือน<Fill v={td.month} w={90} />พ.ศ.<Fill v={td.year} w={50} /></div>
        <div>เวลา <Fill v={td.time} w={200} />น.</div>
      </div>

      <div className="rf-part">ส่วนที่ 1&nbsp; ข้อมูลผู้แจ้ง</div>
      <div className="rf-grid3">
        <span>แจ้งปัญหา</span>
        <span><Box on={type === 'computer'} /> คอมพิวเตอร์</span>
        <span><Box on={type === 'internet'} /> อินเตอร์เน็ต</span>
        <span><Box on={type === 'other'} /> อื่นๆ : <Fill v={type === 'other' ? (it?.device_name || '') : ''} w={150} /></span>
        <span />
        <span><Box on={type === 'printer'} /> เครื่องพิมพ์ ( Printer )</span>
        <span><Box on={type === 'software'} /> โปรแกรม</span>
        <span />
      </div>
      <div className="rf-label">รายละเอียดปัญหา</div>
      {problem
        ? <div className="rf-text">{problem}</div>
        : <><div className="rf-line" /><div className="rf-line" /></>}

      <Sig role={`( ผู้แจ้งซ่อม แผนก/หน่วยงาน ${it?.location || '...............'} )`} name={it?.reporter_name} />
      <Sig role="( หัวหน้าแผนก/ผช.ผจกฝ่าย/ผจก.ฝ่าย )" />
      <Sig role="( ผู้รับแจ้ง )" name={it?.handled_by} />
      <div className="rf-rule" />

      <div className="rf-part">ส่วนที่ 2&nbsp; สำหรับเจ้าหน้าที่</div>
      <div className="rf-label">ผลการซ่อม</div>
      <div className="rf-row" style={{ paddingLeft: 24 }}><Box on={fixed} /> สามารถแก้ปัญหาได้</div>
      <div className="rf-row2" style={{ paddingLeft: 48 }}>
        <span><Box on={rr === 'fixed_no_part'} /> ไม่ต้องเปลี่ยนอุปกรณ์</span>
        <span><Box on={rr === 'other'} /> อื่นๆ : <Fill v={rr === 'other' ? ' ' : ''} w={170} /></span>
        <span><Box on={rr === 'fixed_replaced'} /> ต้องเปลี่ยนอุปกรณ์</span>
        <span>เวลาเริ่ม <Fill v={tm(it?.started_at)} w={60} /> น. จบ. <Fill v={tm(it?.completed_at)} w={60} /> น.</span>
      </div>
      <div className="rf-row">วิธีการแก้ไข : {fixed || rr === 'other' ? <span className="rf-fill rf-grow">{it?.resolution || ''}</span> : <span className="rf-dots rf-grow" />}</div>
      <div className="rf-line" />

      <div className="rf-row" style={{ paddingLeft: 24, marginTop: 6 }}><Box on={unfixed} /> ไม่สามารถแก้ปัญหาได้</div>
      <div className="rf-row2" style={{ paddingLeft: 0 }}>
        <span>วิธีการดำเนินการต่อ&nbsp;&nbsp; <Box on={rr === 'unfixed_outsource'} /> ส่งซ่อม</span>
        <span><Box on={false} /> อื่นๆ : <Fill v="" w={170} /></span>
        <span style={{ paddingLeft: 136 }}><Box on={rr === 'unfixed_buy_new'} /> ซื้อใหม่</span>
        <span />
      </div>
      <div className="rf-row">รายละเอียด : {unfixed ? <span className="rf-fill rf-grow">{it?.resolution || ''}</span> : <span className="rf-dots rf-grow" />}</div>
      <div className="rf-line" />

      <Sig role="( ผู้ซ่อม )" name={it?.status === 'done' ? it?.handled_by : ''} />
      <Sig role="( ผู้รับตรวจงาน )" />
      <div className="rf-sig">
        <span>วันที่รับคืน</span>
        <span className="rf-sigline">{it?.returned_at ? fmtDate(it.returned_at) : ''}</span>
        <span />
      </div>

      <div className="rf-code">FQP-IT-01:03</div>
    </div>
  )
}
