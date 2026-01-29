-- [Extended Fields for Legacy Data Migration]
alter table public.computers add column if not exists repair_history text;
alter table public.employees add column if not exists user_share_drive_path text;

-- [Full Schema Definitions for New Supabase Project]
-- Assets
create table if not exists public.assets (
  id bigint generated always as identity primary key,
  asset_tag text not null unique,
  serial text,
  model text,
  category text,
  cpu text,
  ram text,
  storage text,
  status text check (status in ('in_use', 'stock', 'repair', 'retired')),
  owner text,
  location text,
  purchase_date date,
  document_url text,
  confidentiality_level text default 'internal',
  integrity_level text default 'medium',
  availability_level text default 'medium',
  disposal_date date,
  disposal_method text,
  created_at timestamptz default now()
);

-- Computers
create table if not exists public.computers (
  id bigint generated always as identity primary key,
  computer_id text not null unique,
  asset_type text,
  spec text,
  repair_history text,
  purchase_date date,
  user_id text,
  loan_borrower_name text,
  remarks text,
  created_at timestamptz default now()
);

-- Employees
create table if not exists public.employees (
  id bigint generated always as identity primary key,
  employee_id text not null unique,
  name text not null,
  position text,
  department text,
  email text,
  desk_phone text,
  username text,
  user_share_drive_path text,
  created_at timestamptz default now()
);

-- Printers
create table if not exists public.printers (
  id bigint generated always as identity primary key,
  printer_id text not null unique,
  model text,
  user_id text,
  created_at timestamptz default now()
);

-- Software & Licenses
create table if not exists public.software (
  id bigint generated always as identity primary key,
  name text not null,
  vendor text,
  version text,
  license_key text,
  license_type text,
  expiry_date date,
  total_licenses integer default 1,
  assigned_to text,
  created_at timestamptz default now()
);

-- Maintenance
create table if not exists public.maintenance_logs (
  id bigint generated always as identity primary key,
  asset_id bigint references public.assets(id) on delete cascade,
  log_type text not null,
  description text,
  performed_by text,
  cost numeric(12,2) default 0,
  next_check_date date,
  created_at timestamptz default now()
);

-- Audit
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  performed_by text,
  created_at timestamptz default now()
);

-- Spare Parts
create table if not exists public.spare_parts (
  id bigint generated always as identity primary key,
  name text not null,
  category text,
  stock_quantity integer default 0,
  min_stock_level integer default 5,
  location text,
  remarks text,
  created_at timestamptz default now()
);

-- RLS
alter table public.assets enable row level security;
alter table public.computers enable row level security;
alter table public.employees enable row level security;
alter table public.printers enable row level security;
alter table public.software enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.spare_parts enable row level security;

create policy "assets_all" on public.assets for all using (true) with check (true);
create policy "computers_all" on public.computers for all using (true) with check (true);
create policy "employees_all" on public.employees for all using (true) with check (true);
create policy "printers_all" on public.printers for all using (true) with check (true);
create policy "software_all" on public.software for all using (true) with check (true);
create policy "maintenance_all" on public.maintenance_logs for all using (true) with check (true);
create policy "audit_all" on public.audit_logs for all using (true) with check (true);
create policy "spare_parts_all" on public.spare_parts for all using (true) with check (true);
