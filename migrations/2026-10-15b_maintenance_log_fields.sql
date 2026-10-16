-- รันใน Supabase SQL Editor (รอบที่ 2) — เพิ่มช่องตามแบบฟอร์ม FQP-IT-01:02 ประวัติเครื่อง
-- รันซ้ำได้ ไม่ลบข้อมูลเดิม
alter table public.maintenance_logs add column if not exists log_date date default current_date; -- วัน/เดือน/ปี
alter table public.maintenance_logs add column if not exists reference_doc text;                 -- เอกสารอ้างอิง
alter table public.maintenance_logs add column if not exists remarks text;                       -- หมายเหตุ
update public.maintenance_logs set log_date = created_at::date where log_date is null;
