// สร้างค่า hash ของ PIN แอดมิน:  npm run password -- 482915
// แล้วนำผลลัพธ์ไปใส่ใน .env.local หรือ Environment Variables ของเว็บโฮสต์ (VITE_ADMIN_PASSWORD_HASH=...)
import { createHash } from 'node:crypto'

const pin = process.argv.slice(2).join('').trim()
// หน้า login รับเฉพาะตัวเลข 4–8 หลัก — ถ้าสร้าง hash จากค่าอื่น จะพิมพ์เข้าระบบไม่ได้เลย
if (!/^\d{4,8}$/.test(pin)) {
  console.error('PIN ต้องเป็นตัวเลข 4–8 หลัก เช่น: npm run password -- 482915')
  process.exit(1)
}
console.log('VITE_ADMIN_PASSWORD_HASH=' + createHash('sha256').update(pin).digest('hex'))
