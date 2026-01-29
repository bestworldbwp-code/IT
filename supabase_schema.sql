-- Add Classification to Assets (ISO 27001)
alter table public.assets add column if not exists confidentiality_level text default 'internal'; -- public, internal, confidential, restricted
alter table public.assets add column if not exists integrity_level text default 'medium'; -- high, medium, low
alter table public.assets add column if not exists availability_level text default 'medium'; -- high, medium, low
alter table public.assets add column if not exists disposal_date date;
alter table public.assets add column if not exists disposal_method text;

-- Software & Licenses Table
create table if not exists public.software (
  id bigint generated always as identity primary key,
  name text not null,
  version text,
  license_key text,
  license_type text, -- perpetual, subscription, open_source
  expiry_date date,
  total_licenses integer default 1,
  assigned_to text,
  vendor text,
  created_at timestamptz default now()
);
alter table public.software enable row level security;
create policy "software read for all" on public.software for select using (true);
create policy "software insert for all" on public.software for insert with check (true);
create policy "software update for all" on public.software for update using (true);

-- Maintenance Logs Table
create table if not exists public.maintenance_logs (
  id bigint generated always as identity primary key,
  asset_id bigint references public.assets(id) on delete cascade,
  log_type text not null, -- repair, inspection, update, backup_check
  description text,
  performed_by text,
  cost decimal(12,2) default 0,
  next_check_date date,
  created_at timestamptz default now()
);
alter table public.maintenance_logs enable row level security;
create policy "maintenance read for all" on public.maintenance_logs for select using (true);
create policy "maintenance insert for all" on public.maintenance_logs for insert with check (true);
create policy "maintenance update for all" on public.maintenance_logs for update using (true);

-- Audit Trail Table
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action text not null, -- INSERT, UPDATE, DELETE
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  performed_by text,
  created_at timestamptz default now()
);
alter table public.audit_logs enable row level security;
create policy "audit_logs read for all" on public.audit_logs for select using (true);
-- Spare Parts & Consumables Table
create table if not exists public.spare_parts (
  id bigint generated always as identity primary key,
  name text not null,
  category text, -- mouse, keyboard, toner, cable, ram, etc.
  stock_quantity integer default 0,
  min_stock_level integer default 5,
  location text,
  remarks text,
  created_at timestamptz default now()
);
alter table public.spare_parts enable row level security;
create policy "spare_parts read for all" on public.spare_parts for select using (true);
create policy "spare_parts insert for all" on public.spare_parts for insert with check (true);
create policy "spare_parts update for all" on public.spare_parts for update using (true);
create policy "spare_parts delete for all" on public.spare_parts for delete using (true);
