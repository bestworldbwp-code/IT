import { Fragment, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { getSupabase } from '../supabaseClient.js'
import { useDocSettings, normalizeAppUrl, assetUrl, machineName, byTag, tagType, textMatch } from './docs.jsx'

// ขนาดป้ายสติกเกอร์ (มม.) ให้เลือกตามกระดาษที่มี
// sub = แสดงชื่อบริษัท+รุ่น, hint = แสดงคำว่า "สแกนเพื่อแจ้งซ่อม"
// 44 มม. วางได้ 4 ดวงต่อแถวบน A4 (กว้างพิมพ์ได้ 186 มม. หลังหักขอบกระดาษ)
const SIZES = {
  // กว้าง 30 มม. เดิมเหลือที่ข้าง QR ไม่พอ รหัสเครื่องโดนตัดเป็น "COM-I…" ทุกดวง
  s: { label: 'เล็ก 38×20 มม. (ป้ายเล็ก/โน้ตบุ๊ก)', w: 38, h: 20, qr: 15, font: 6.5 },
  c: { label: 'กะทัดรัด 44×25 มม. (แนะนำ)', w: 44, h: 25, qr: 20, font: 7.2, sub: true },
  m: { label: 'กลาง 50×30 มม.', w: 50, h: 30, qr: 24, font: 8, sub: true },
  l: { label: 'ใหญ่ 70×40 มม. (PC/เครื่องพิมพ์)', w: 70, h: 40, qr: 32, font: 10, sub: true, hint: true },
}

export default function QrLabelsPage() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [size, setSize] = useState('c')
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(new Set())
  const [qrs, setQrs] = useState({ url: '', map: {} }) // จำว่า QR ชุดนี้สร้างจาก URL ไหน
  const [settings, setSettings] = useDocSettings()
  const appUrl = normalizeAppUrl(settings.appUrl) // ใช้ค่าจาก state โดยตรง ไม่รอบันทึกลงเครื่อง

  useEffect(() => {
    (async () => {
      const client = getSupabase()
      if (!client) return
      const { data, error } = await client.from('assets').select('id, asset_tag, model, location, building, status').neq('status', 'retired').order('asset_tag')
      if (error) alert('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
      setAssets((data || []).sort(byTag('asset_tag')))
      setLoading(false)
    })()
  }, [])

  // ประเภทจากตัวหน้ารหัส (COM / PNT ...) เหมือนหน้าเครื่องและอุปกรณ์ — เครื่องใหม่ที่ไม่มี category ก็กรองได้
  const TYPE_TH = { COM: 'คอมพิวเตอร์', NB: 'โน้ตบุ๊ก', PNT: 'เครื่องพิมพ์', SRV: 'เซิร์ฟเวอร์' }
  const cats = useMemo(() => [...new Set(assets.map(a => tagType(a.asset_tag)).filter(Boolean))].sort(), [assets])
  const filtered = useMemo(() => assets.filter(a =>
    (cat === 'all' || tagType(a.asset_tag) === cat) && textMatch(search, a.asset_tag, a.model, a.location, a.building)
  ), [assets, cat, search])
  const toPrint = picked.size ? filtered.filter(a => picked.has(a.id)) : filtered

  // สร้าง QR ในเครื่อง (ไม่ต้องต่อเน็ต) เมื่อ URL หรือรายการเปลี่ยน
  useEffect(() => {
    let alive = true
    ;(async () => {
      const out = {}
      for (const a of toPrint) {
        // margin 1 = ขอบขาวในตัวรูป กันสแกนไม่ติดตอนติดบนเครื่องสีดำ
        // ระดับ Q กันรอยขีดข่วน/คราบได้มากกว่า M แต่ยังได้ QR ความละเอียดเท่าเดิม (33×33) กับลิงก์ยาวขนาดนี้
        out[a.id] = await QRCode.toDataURL(assetUrl(a.asset_tag, appUrl), { margin: 1, width: 256, errorCorrectionLevel: 'Q' })
      }
      if (alive) setQrs({ url: appUrl, map: out })
    })()
    return () => { alive = false }
  }, [toPrint.map(a => a.id).join(','), appUrl])

  const toggle = (id) => setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const sz = SIZES[size]
  // ชื่อบริษัทให้ขึ้นบรรทัดใหม่ตรงช่องว่างเท่านั้น ("เบสท์เวิลด์ / อินเตอร์พลาส") ไม่ใช่ตัดกลางคำ
  const companyWords = settings.company.replace(/^บริษัท\s*/, '').replace(/\s*จำกัด.*$/, '').split(/\s+/).filter(Boolean)
  const isLocal = /localhost|127\.0\.0\.1/.test(appUrl)
  const ready = toPrint.length > 0 && qrs.url === appUrl && toPrint.every(a => qrs.map[a.id]) // QR ครบและเป็นของ URL ปัจจุบันก่อนถึงจะให้กดพิมพ์

  return (
    <div>
      <div className="card no-print doc-toolbar">
        <input placeholder="ค้นหา รหัส / รุ่น / สถานที่..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ width: 170 }}>
          <option value="all">ทุกประเภท ({assets.length})</option>
          {cats.map(c => <option key={c} value={c}>{TYPE_TH[c] || c}</option>)}
        </select>
        <select value={size} onChange={e => setSize(e.target.value)} style={{ width: 260 }}>
          {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="secondary" onClick={() => setPicked(new Set())}>ล้างที่เลือก</button>
        <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => {
          if (isLocal && !confirm('URL ใน QR ยังเป็น localhost — สแกนจากมือถือจะเปิดไม่ได้ พิมพ์ต่อเลยไหม?')) return
          window.print()
        }} disabled={!ready}>
          {ready ? `🖨️ พิมพ์ ${toPrint.length} ป้าย` : 'กำลังสร้าง QR...'}
        </button>
      </div>

      <div className="card no-print" style={{ marginBottom: 16, background: isLocal ? '#fffbeb' : undefined, borderColor: isLocal ? '#fde68a' : undefined }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label>URL ของระบบที่ฝังใน QR (ต้องเป็นที่อยู่ที่มือถือเปิดได้)</label>
            <input value={settings.appUrl || ''} onChange={e => setSettings({ ...settings, appUrl: e.target.value.trim() })} placeholder={window.location.origin} />
          </div>
          <div className="muted" style={{ flex: 1, minWidth: 220 }}>
            ตัวอย่างลิงก์: <code style={{ fontSize: '0.8em' }}>{assetUrl('COM-IT-01', appUrl)}</code>
            {isLocal && <div style={{ color: '#b45309', marginTop: 4 }}>⚠️ ตอนนี้เป็น localhost — สแกนจากมือถือจะเปิดไม่ได้ ใส่ URL ของเว็บที่ deploy แล้วก่อนพิมพ์</div>}
          </div>
        </div>
      </div>

      <div className="history-layout">
        <div className="card no-print device-list">
          <div className="muted" style={{ padding: '4px 10px 8px' }}>{picked.size ? `เลือก ${picked.size} เครื่อง` : `ไม่ได้เลือก = พิมพ์ทั้งหมดที่กรอง (${filtered.length})`}</div>
          {loading && <div className="muted" style={{ padding: 12 }}>กำลังโหลด...</div>}
          {filtered.map(a => (
            <label key={a.id} className={`device-row ${picked.has(a.id) ? 'on' : ''}`} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 16, marginTop: 3 }} checked={picked.has(a.id)} onChange={() => toggle(a.id)} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{a.asset_tag}</div>
                <div className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[a.model, a.location].filter(Boolean).join(' · ')}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="card label-sheet-wrap">
          <div className="label-sheet" style={{ '--lw': sz.w + 'mm', '--lh': sz.h + 'mm', '--lqr': sz.qr + 'mm', '--lf': sz.font + 'pt' }}>
            {toPrint.map(a => (
              <div key={a.id} className="label">
                <img src={qrs.url === appUrl ? qrs.map[a.id] : undefined} alt={a.asset_tag} className="label-qr" />
                <div className="label-text">
                  <div className="label-co">{machineName(a.asset_tag)}</div>
                  <div className="label-tag">{a.asset_tag}</div>
                  {sz.sub && <div className="label-sub">{companyWords.map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span style={{ whiteSpace: 'nowrap' }}>{w}</span></Fragment>)}</div>}
                  {sz.sub && <div className="label-sub">{a.model || ''}</div>}
                  {sz.hint && <div className="label-sub">สแกนเพื่อแจ้งซ่อม / ยืม</div>}
                </div>
              </div>
            ))}
          </div>
          {!loading && !toPrint.length && <div className="muted" style={{ textAlign: 'center', padding: 40 }}>ไม่มีเครื่องให้พิมพ์</div>}
        </div>
      </div>
    </div>
  )
}
