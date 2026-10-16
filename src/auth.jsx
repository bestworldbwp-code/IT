import { useEffect, useState } from 'react'

// ล็อกหน้าแอดมินด้วยรหัสผ่านชุดเดียว (ใช้คนเดียว)
// เก็บเป็น SHA-256 ใน .env.local (VITE_ADMIN_PASSWORD_HASH) ไม่เก็บรหัสตรง ๆ ในโค้ด
// เปลี่ยน PIN: npm run password -- PINใหม่  แล้วเอาค่าที่ได้ไปใส่ .env.local หรือ Vercel
// ค่าเริ่มต้น = PIN 1234 (ใช้เมื่อไม่ได้ตั้ง VITE_ADMIN_PASSWORD_HASH) — เปลี่ยน PIN: npm run password -- PINใหม่
const DEFAULT_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
// trim/lowercase กันวางค่าใน Vercel แล้วมีช่องว่างหรือเป็นตัวพิมพ์ใหญ่ติดมา (จะ login ไม่ได้เลย)
const HASH = String(import.meta.env.VITE_ADMIN_PASSWORD_HASH || DEFAULT_PIN_HASH).trim().toLowerCase()
const KEY = 'it_admin_ok'

// crypto.subtle มีเฉพาะหน้าเว็บที่เป็น HTTPS หรือ localhost — ถ้าเปิดผ่าน http://IP-ในบริษัท จะไม่มี
// จึงมี SHA-256 แบบ JavaScript ล้วนสำรองไว้ ไม่งั้นจะ login ไม่ได้เลย
function sha256Fallback(text) {
  const bytes = new TextEncoder().encode(text)
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const len = bytes.length
  const total = Math.ceil((len + 9) / 64) * 64
  const msg = new Uint8Array(total)
  msg.set(bytes)
  msg[len] = 0x80
  const view = new DataView(msg.buffer)
  view.setUint32(total - 8, Math.floor(len / 0x20000000))
  view.setUint32(total - 4, (len * 8) >>> 0)
  const W = new Uint32Array(64)
  const rotr = (x, n) => (x >>> n) | (x << (32 - n))
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('')
}

export async function sha256(text) {
  if (globalThis.crypto?.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
    } catch { /* ตกไปใช้ตัวสำรอง */ }
  }
  return sha256Fallback(text)
}

export function useAdminAuth() {
  const [ok, setOk] = useState(() => { try { return localStorage.getItem(KEY) === HASH && !!HASH } catch { return false } })
  const login = async (password) => {
    const h = await sha256(password)
    if (h !== HASH) return false
    try { localStorage.setItem(KEY, h) } catch { /* ignore */ }
    setOk(true)
    return true
  }
  const logout = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } setOk(false) }
  return { ok, login, logout }
}

export function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { document.getElementById('admin-pw')?.focus() }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    let good = false
    try { good = await onLogin(pw) } catch (ex) { setErr('ตรวจสอบรหัสผ่านไม่ได้: ' + ex.message) }
    setBusy(false)
    if (!good) { setErr(m => m || 'PIN ไม่ถูกต้อง'); setPw('') }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a', padding: 20 }}>
      <form className="card" onSubmit={submit} style={{ width: '100%', maxWidth: 380, padding: 32, textAlign: 'center' }}>
        <div className="brand-logo" style={{ margin: '0 auto 12px', width: 52, height: 52, fontSize: '1.5rem' }}>🖥️</div>
        <h2 style={{ marginBottom: 4 }}>IT Asset</h2>
        <div className="muted" style={{ marginBottom: 24 }}>เบสท์เวิลด์ อินเตอร์พลาส · สำหรับเจ้าหน้าที่ IT</div>
        <input id="admin-pw" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={pw}
          onChange={e => setPw(e.target.value.replace(/\D/g, ''))} placeholder="ใส่ PIN" autoComplete="current-password"
          style={{ marginBottom: 12, textAlign: 'center', fontSize: '1.8rem', letterSpacing: '0.5em' }} />
        {err && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: '0.9rem' }}>{err}</div>}
        <button className="primary" type="submit" disabled={busy || !pw} style={{ width: '100%' }}>{busy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</button>
        <div className="muted" style={{ marginTop: 16, fontSize: '0.8rem' }}>พนักงานทั่วไปสแกน QR บนเครื่องเพื่อแจ้งซ่อมได้โดยไม่ต้องเข้าสู่ระบบ</div>
      </form>
    </div>
  )
}
