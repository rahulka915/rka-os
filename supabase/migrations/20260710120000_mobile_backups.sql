create table if not exists public.mobile_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists mobile_backups_user_created_idx
  on public.mobile_backups (user_id, created_at desc);

alter table public.mobile_backups enable row level security;

create policy "mobile_backups_select_own" on public.mobile_backups
  for select using (user_id = auth.uid());

create policy "mobile_backups_write_own" on public.mobile_backups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
