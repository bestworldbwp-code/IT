import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '../supabaseClient.js'
import { DocHeader, DocToolbar, fmtDate, repairDocNo, monthKey } from './docs.jsx'

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

function RepairSheet({ it, docNo }) {
  const a = it?.assets
  const d = it ? new Date(it.created_at) : null
  const done = it ? new Date(it.completed_at || 0) : null
  const type = problemType(it)
  const rr = it?.repair_result
  const thDate = (dt) => dt ? { day: dt.getDate(), month: dt.toLocaleDateString('th-TH', { month: 'long' }), year: dt.getFullYear() + 543, time: dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) } : {}
  const td = thDate(d)
  const device = a ? `${a.asset_tag}${a.model ? ` (${a.model})` : ''}` : (it?.device_name || '')

  return (
    <div className="doc card sheet">
      <DocHeader title="ใบแจ้งซ่อมคอมพิวเตอร์และอุปกรณ์ IT" code="FQP-IT-01:03"
        extra={[['No./เลขที่', docNo || '....................']]} />

      <div className="doc-row" style={{ justifyContent: 'space-between' }}>
        <span>วันที่ <u>&nbsp;{td.day || '........'}&nbsp;</u> เดือน <u>&nbsp;{td.month || '......................'}&nbsp;</u> พ.ศ. <u>&nbsp;{td.year || '...........'}&nbsp;</u></span>
        <span>เวลา <u>&nbsp;{td.time || '..................'}&nbsp;</u> น.</span>
      </div>

      <div className="doc-part">ส่วนที่ 1 ข้อมูลผู้แจ้ง</div>
      <div className="doc-row">
        <span>แจ้งปัญหา</span>
        <Chk on={type === 'computer'}>คอมพิวเตอร์</Chk>
        <Chk on={type === 'printer'}>เครื่องพิมพ์ (Printer)</Chk>
        <Chk on={type === 'internet'}>อินเตอร์เน็ต</Chk>
        <Chk on={type === 'software'}>โปรแกรม</Chk>
        <Chk on={type === 'other'}>อื่นๆ : {type === 'other' ? '' : <Dots n={30} />}</Chk>
      </div>
      <div className="doc-row"><span>เครื่อง / รหัสเครื่องจักร : {device || <Dots n={50} />}</span><span>ผู้แจ้ง : {it?.reporter_name || <Dots n={30} />}</span></div>
      <div style={{ padding: '4px 4px 0' }}>รายละเอียดปัญหา</div>
      <div className="doc-lines" style={{ padding: '0 4px' }}>
        {it ? <div style={{ height: 'auto', minHeight: 52, whiteSpace: 'pre-wrap', borderBottom: 'none' }}>{it.problem}</div> : <><div /><div /></>}
      </div>
      <div className="sig-grid three" style={{ marginTop: 18 }}>
        <div className="sig"><div className="sig-line" style={{ height: 30 }} /><div>( ผู้แจ้งซ่อม แผนก/หน่วยงาน {it?.location || '..................'} )</div></div>
        <div className="sig"><div className="sig-line" style={{ height: 30 }} /><div>( หัวหน้าแผนก/ผช.ผจก.ฝ่าย/ผจก.ฝ่าย )</div></div>
        <div className="sig"><div className="sig-line" style={{ height: 30 }} /><div>( ผู้รับแจ้ง{it?.handled_by ? ` : ${it.handled_by}` : ''} )</div></div>
      </div>

      <div className="doc-part">ส่วนที่ 2 สำหรับเจ้าหน้าที่</div>
      <div style={{ padding: '2px 4px' }}><strong>ผลการซ่อม</strong></div>
      <div className="doc-row" style={{ paddingLeft: 16 }}>
        <Chk on={rr === 'fixed_no_part' || rr === 'fixed_replaced'}>สามารถแก้ปัญหาได้</Chk>
        <Chk on={rr === 'fixed_no_part'}>ไม่ต้องเปลี่ยนอุปกรณ์</Chk>
        <Chk on={rr === 'fixed_replaced'}>ต้องเปลี่ยนอุปกรณ์</Chk>
        <Chk on={rr === 'other'}>อื่นๆ : <Dots n={30} /></Chk>
      </div>
      <div className="doc-row" style={{ paddingLeft: 16 }}>
        <span>เวลาเริ่ม <u>&nbsp;{it?.started_at ? thDate(new Date(it.started_at)).time : '................'}&nbsp;</u> น. &nbsp; จบ <u>&nbsp;{it?.completed_at ? thDate(done).time : '................'}&nbsp;</u> น.</span>
        {it?.cost > 0 && <span>ค่าใช้จ่าย {Number(it.cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>}
      </div>
      <div style={{ padding: '2px 4px 0 16px' }}>วิธีการแก้ไข :</div>
      <div className="doc-lines" style={{ padding: '0 4px 0 16px' }}>
        {it?.resolution ? <div style={{ height: 'auto', minHeight: 52, whiteSpace: 'pre-wrap', borderBottom: 'none' }}>{it.resolution}</div> : <><div /><div /></>}
      </div>
      <div className="doc-row" style={{ paddingLeft: 16 }}><Chk on={rr === 'unfixed_outsource' || rr === 'unfixed_buy_new'}>ไม่สามารถแก้ปัญหาได้</Chk></div>
      <div className="doc-row" style={{ paddingLeft: 32 }}>
        <span>วิธีการดำเนินการต่อ</span>
        <Chk on={rr === 'unfixed_outsource'}>ส่งซ่อม</Chk>
        <Chk on={rr === 'unfixed_buy_new'}>ซื้อใหม่</Chk>
        <Chk on={false}>อื่นๆ : <Dots n={30} /></Chk>
      </div>
      <div style={{ padding: '2px 4px 0 32px' }}>รายละเอียด :</div>
      <div className="doc-lines" style={{ padding: '0 4px 0 32px' }}><div /><div /></div>

      <div className="sig-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 18 }}>
        <div className="sig"><div className="sig-line" style={{ height: 30 }} /><div>( ผู้ซ่อม{it?.handled_by ? ` : ${it.handled_by}` : ''} )</div></div>
        <div className="sig"><div className="sig-line" style={{ height: 30 }} /><div>( ผู้รับตรวจงาน )</div></div>
        <div className="sig" style={{ textAlign: 'left', alignSelf: 'end' }}>วันที่รับคืน <u>&nbsp;{it?.returned_at ? fmtDate(it.returned_at) : it?.completed_at ? fmtDate(it.completed_at) : '........../..................../...........'}&nbsp;</u></div>
      </div>
    </div>
  )
}
