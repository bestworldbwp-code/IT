-- รันใน Supabase Dashboard > SQL Editor > New query > วาง > Run
-- ปลอดภัย รันซ้ำได้ (if not exists) ไม่ลบหรือแก้ข้อมูลเดิม

-- 1) ใบแจ้งซ่อม FQP-IT-01:03: ช่อง "แจ้งปัญหา" (คอมพิวเตอร์ / เครื่องพิมพ์ / อินเตอร์เน็ต / โปรแกรม / อื่นๆ)
alter table public.repair_requests
  add column if not exists problem_type text
  check (problem_type in ('computer', 'printer', 'internet', 'software', 'other'));

-- ส่วนที่ 2 ของใบแจ้งซ่อม: ผลการซ่อมและการดำเนินการต่อ
alter table public.repair_requests
  add column if not exists repair_result text
  check (repair_result in ('fixed_no_part', 'fixed_replaced', 'unfixed_outsource', 'unfixed_buy_new', 'other'));
alter table public.repair_requests add column if not exists started_at timestamptz;   -- เวลาเริ่มซ่อม
alter table public.repair_requests add column if not exists returned_at date;         -- วันที่รับคืน

-- 2) ทะเบียนเครื่อง FQP-IT-01:01 / ใบสำรวจ: อาคาร และตำแหน่งที่ตั้ง แยกจากแผนก
alter table public.assets add column if not exists building text;        -- อาคาร
alter table public.assets add column if not exists position_detail text; -- ชั้น / ห้อง / จุดวาง
alter table public.assets add column if not exists rank text default 'A'; -- RANK ตามทะเบียนเดิม (A/B/C)

-- 3) ตาราง computers เดิมยังไม่มี purchase_date (schema ในโค้ดมี แต่ฐานข้อมูลจริงไม่มี)
alter table public.computers add column if not exists purchase_date date;

-- 4) ย้ายข้อมูล อาคาร · ตำแหน่ง · แผนก ที่หน้าสำรวจเคยเก็บรวมในช่อง location ออกเป็นคอลัมน์ใหม่
update public.assets
set building        = split_part(location, ' · ', 1),
    position_detail = split_part(location, ' · ', 2),
    location        = split_part(location, ' · ', 3)
where location like '% · % · %' and building is null;
