# ตั้งสำรองข้อมูลอัตโนมัติ

สคริปต์ `backup-to-file.js` ดึงทุกตารางจาก Supabase เป็นไฟล์ JSON 1 ไฟล์/ครั้ง
เก็บในโฟลเดอร์ `backup` ของโปรแกรม (หรือโฟลเดอร์ที่ระบุ) และบันทึกประวัติให้หน้า "สำรองข้อมูล" เอง

## 1. ลองรันมือ
```bash
npm run backup
```
ไฟล์จะอยู่ที่ `IT\backup\it-asset-backup_วันที่.json`

## 2. ตั้ง Windows Task Scheduler ให้รันเองทุกวัน 09:00 (รันครั้งเดียวใน **Command Prompt (CMD)** — วางใน PowerShell เครื่องหมายคำพูดจะเพี้ยน)
```bash
schtasks /Create /TN "IT Asset Backup" /SC DAILY /ST 09:00 /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\Users\Meeting\Desktop\จัดการ IT\IT\scripts\backup-to-file.js\"" /F
```
- รายสัปดาห์แทน: เปลี่ยน `/SC DAILY` เป็น `/SC WEEKLY /D FRI`
- เช็คว่าตั้งแล้ว: `schtasks /Query /TN "IT Asset Backup"` · ลองรันทันที: `schtasks /Run /TN "IT Asset Backup"`
- ถ้าเครื่องปิดเวลานั้น วันนั้นจะไม่สำรอง หน้า "สำรองข้อมูล" จะเตือนเมื่อเกิน 7 วัน

## 3. กู้คืน
```bash
npm run restore -- backup\it-asset-backup_วันที่.json
```
- รันแบบนี้ก่อน = ตรวจอย่างเดียว บอกว่ามีแถวไหนหายไปหรือถูกแก้ ไม่แก้ข้อมูล
- เพิ่ม `--apply` = ใส่แถวที่หายไปกลับเข้าระบบ (ประวัติซ่อม/ยืม-คืนจะชี้เครื่องที่ถูกต้องให้เอง)
- เพิ่ม `--apply --overwrite` = คืนค่าแถวที่ถูกแก้ให้เหมือนในไฟล์สำรองด้วย
- ⚠️ อย่าใช้ `import:legacy-csv` เพื่อกู้คืน — สคริปต์นั้นเขียนทับด้วยข้อมูล CSV เก่าเดือน ม.ค.

ไฟล์เก่ากว่า 1 ปีลบเอง (แก้ `KEEP_DAYS` ในสคริปต์)
