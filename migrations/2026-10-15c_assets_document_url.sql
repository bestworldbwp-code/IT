-- รันใน Supabase SQL Editor (รอบที่ 3) — ช่อง "Link เอกสารอ้างอิง" ในฟอร์มทะเบียนเครื่อง
-- ฐานข้อมูลจริงไม่มีคอลัมน์นี้ (มีเฉพาะใน supabase_schema.sql) ทำให้บันทึกเครื่องใหม่ที่กรอกลิงก์ไม่ได้
alter table public.assets add column if not exists document_url text;
