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

-- Ensure unique constraints for foreign keys (Safe check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_employee_id_unique') THEN
        ALTER TABLE public.employees ADD CONSTRAINT employees_employee_id_unique UNIQUE (employee_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'computers_computer_id_unique') THEN
        ALTER TABLE public.computers ADD CONSTRAINT computers_computer_id_unique UNIQUE (computer_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'printers_printer_id_unique') THEN
        ALTER TABLE public.printers ADD CONSTRAINT printers_printer_id_unique UNIQUE (printer_id);
    END IF;
END $$;

-- Loans System
create table if not exists public.loans (
  id bigint generated always as identity primary key,
  asset_id bigint references public.assets(id) on delete cascade,
  employee_id text references public.employees(employee_id),
  loan_date date default current_date,
  due_date date,
  return_date date,
  status text check (status in ('active', 'returned', 'overdue')) default 'active',
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
alter table public.loans enable row level security;

-- Idempotent Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assets_all') THEN
        CREATE POLICY "assets_all" ON public.assets FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'computers_all') THEN
        CREATE POLICY "computers_all" ON public.computers FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'employees_all') THEN
        CREATE POLICY "employees_all" ON public.employees FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'printers_all') THEN
        CREATE POLICY "printers_all" ON public.printers FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'software_all') THEN
        CREATE POLICY "software_all" ON public.software FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'maintenance_all') THEN
        CREATE POLICY "maintenance_all" ON public.maintenance_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_all') THEN
        CREATE POLICY "audit_all" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'spare_parts_all') THEN
        CREATE POLICY "spare_parts_all" ON public.spare_parts FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'loans_all') THEN
        CREATE POLICY "loans_all" ON public.loans FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
