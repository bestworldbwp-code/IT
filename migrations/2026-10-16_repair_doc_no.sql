-- รันใน Supabase SQL Editor — เก็บเลขที่ใบแจ้งซ่อม (YYMM-NNN) ไว้ถาวรในฐานข้อมูล
-- เหตุผล: id เป็น GENERATED ALWAYS ถ้ากู้คืนข้อมูลจากไฟล์สำรอง แถวจะได้ id ใหม่ → เลขที่ที่พิมพ์บนเอกสารจะไม่ตรงกับระบบ
-- รันซ้ำได้ ไม่ลบข้อมูลเดิม

alter table public.repair_requests add column if not exists doc_no text;

-- เลขที่ = ปีเดือน (เวลาไทย) ที่แจ้ง + id อย่างน้อย 3 หลัก (lpad ตัดเลขเกินความยาว จึงใช้เฉพาะ id ที่สั้นกว่า 3 หลัก)
create or replace function public.repair_doc_no(ts timestamptz, rid bigint) returns text
language sql immutable as $$
  select to_char(ts at time zone 'Asia/Bangkok', 'YYMM') || '-' ||
         case when length(rid::text) < 3 then lpad(rid::text, 3, '0') else rid::text end
$$;

update public.repair_requests set doc_no = public.repair_doc_no(created_at, id) where doc_no is null;

-- ใบใหม่ได้เลขที่อัตโนมัติ (ถ้ากู้คืนแล้วมีเลขเดิมติดมา จะใช้เลขเดิม)
create or replace function public.set_repair_doc_no() returns trigger language plpgsql as $$
begin
  if new.doc_no is null then
    new.doc_no := public.repair_doc_no(coalesce(new.created_at, now()), new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_repair_doc_no on public.repair_requests;
create trigger trg_repair_doc_no before insert on public.repair_requests
  for each row execute function public.set_repair_doc_no();
