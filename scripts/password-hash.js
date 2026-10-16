// สร้างค่า hash ของรหัสผ่านแอดมิน:  npm run password -- รหัสใหม่
// แล้วนำผลลัพธ์ไปใส่ใน .env.local บรรทัด VITE_ADMIN_PASSWORD_HASH=...
import { createHash } from 'node:crypto'

const pw = process.argv.slice(2).join(' ')
if (!pw) {
  console.error('ใช้: npm run password -- รหัสผ่านใหม่')
  process.exit(1)
}
console.log('VITE_ADMIN_PASSWORD_HASH=' + createHash('sha256').update(pw).digest('hex'))
