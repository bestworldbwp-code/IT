import { useEffect, useState } from 'react'

const listeners = new Set()
let nextId = 1

export function toast(message, type) {
  const text = String(message ?? '')
  const kind = type || (/ไม่สำเร็จ|error|failed|violates|duplicate/i.test(text)
    ? 'error'
    : /เรียบร้อย|สำเร็จ/.test(text) ? 'success' : 'info')
  const item = { id: nextId++, text, kind }
  listeners.forEach(fn => fn(item))
}

// แทนที่ alert() เดิมของเบราว์เซอร์ด้วย toast ที่ไม่ขวางการทำงาน
export function installAlertToast() {
  window.alert = (msg) => toast(msg)
}

const ICONS = { error: '⚠️', success: '✅', info: 'ℹ️' }

export function Toaster() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const add = (item) => {
      setItems(list => [...list, item])
      setTimeout(() => setItems(list => list.filter(i => i.id !== item.id)), item.kind === 'error' ? 6000 : 3500)
    }
    listeners.add(add)
    return () => listeners.delete(add)
  }, [])

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => setItems(l => l.filter(i => i.id !== t.id))}>
          <span>{ICONS[t.kind]}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
