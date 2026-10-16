# ตั้งสำรองข้อมูลอัตโนมัติ

สคริปต์ `backup-to-file.js` ดึงทุกตารางจาก Supabase เป็นไฟล์ JSON 1 ไฟล์/ครั้ง
เก็บในโฟลเดอร์ `backup` ของโปรแกรม (หรือโฟลเดอร์ที่ระบุ) และบันทึกประวัติให้หน้า "สำรองข้อมูล" เอง

## 1. ลองรันมือ
```bash
npm run backup
```
ไฟล์จะอยู่ที่ `IT\backup\it-asset-backup_วันที่.json`

## 2. ตั้ง Windows Task Scheduler ให้รันเองทุกวัน 09:00 (รันครั้งเดียวใน CMD/PowerShell)
```bash
schtasks /Create /TN "IT Asset Backup" /SC DAILY /ST 09:00 /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\Users\Meeting\Desktop\จัดการ IT\IT\scripts\backup-to-file.js\"" /F
```
- รายสัปดาห์แทน: เปลี่ยน `/SC DAILY` เป็น `/SC WEEKLY /D FRI`
- เช็คว่าตั้งแล้ว: `schtasks /Query /TN "IT Asset Backup"` · ลองรันทันที: `schtasks /Run /TN "IT Asset Backup"`
- ถ้าเครื่องปิดเวลานั้น วันนั้นจะไม่สำรอง หน้า "สำรองข้อมูล" จะเตือนเมื่อเกิน 7 วัน

## 3. กู้คืน
ไฟล์ JSON มีทุกตารางครบ นำเข้า Supabase ด้วย `npm run import:all` หรือส่งให้ผู้ดูแลระบบ

ไฟล์เก่ากว่า 1 ปีลบเอง (แก้ `KEEP_DAYS` ในสคริปต์)
