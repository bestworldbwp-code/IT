-- Create the assets table
create table public.assets (
  id bigint generated always as identity primary key,
  asset_tag text not null,
  serial text not null,
  model text,
  cpu text,
  ram text,
  storage text,
  owner text,
  location text,
  purchase_date date,
  warranty_expiry date,
  status text default 'in_use' not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.assets enable row level security;

-- Create policies to allow access
-- Note: For a simple start, we allow public read/write. 
-- In production, you should restrict this to authenticated users only.

-- Policy for reading (Select)
create policy "Enable read access for all users"
on public.assets for select
using (true);

-- Policy for inserting (Insert)
create policy "Enable insert for all users"
on public.assets for insert
with check (true);

-- Policy for updating (Update)
create policy "Enable update for all users"
on public.assets for update
using (true);

-- ================================================================
-- Additional tables for existing CSVs: computers, employees, printers
-- ================================================================

-- Computers
create table if not exists public.computers (
  id bigint generated always as identity primary key,
  computer_id text not null,
  spec text,
  repair_history text,
  user_id text,
  asset_type text,
  loan_borrower_name text,
  remarks text,
  created_at timestamptz default now()
);
alter table public.computers enable row level security;
create policy if not exists "computers read for all" on public.computers for select using (true);
create policy if not exists "computers insert for all" on public.computers for insert with check (true);
create policy if not exists "computers update for all" on public.computers for update using (true);

-- Employees
create table if not exists public.employees (
  id bigint generated always as identity primary key,
  employee_id text not null,
  name text,
  position text,
  department text,
  email text,
  username text,
  desk_phone text,
  user_share_drive_path text,
  created_at timestamptz default now()
);
alter table public.employees enable row level security;
create policy if not exists "employees read for all" on public.employees for select using (true);
create policy if not exists "employees insert for all" on public.employees for insert with check (true);
create policy if not exists "employees update for all" on public.employees for update using (true);

-- Printers
create table if not exists public.printers (
  id bigint generated always as identity primary key,
  printer_id text not null,
  model text,
  user_id text,
  created_at timestamptz default now()
);
alter table public.printers enable row level security;
create policy if not exists "printers read for all" on public.printers for select using (true);
create policy if not exists "printers insert for all" on public.printers for insert with check (true);
create policy if not exists "printers update for all" on public.printers for update using (true);
