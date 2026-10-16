import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' = อ้างไฟล์แบบ relative ใช้ได้ทั้งโฮสต์ที่ root (เช่น Vercel) และในโฟลเดอร์ย่อย (เช่น http://server/it/)
// แอปใช้ hash route (#assets) จึงไม่ต้องตั้ง rewrite ที่เซิร์ฟเวอร์
export default defineConfig({
  plugins: [react()],
  base: './',
})
