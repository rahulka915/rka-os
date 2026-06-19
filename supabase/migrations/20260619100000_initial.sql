create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  status text not null default 'active',
  notes text,
  scheduled_date date,
  due_date date,
  rrule text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  scheduled_date date not null,
  completed_at timestamptz,
  status text not null,
  instance_metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#3B82F6',
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.item_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id, tag_id)
);

create table if not exists public.entity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.items(id) on delete cascade,
  target_id uuid not null references public.items(id) on delete cascade,
  link_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_id, target_id, link_type)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null references public.items(id) on delete cascade,
  action_type text not null,
  timestamp timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.items(id) on delete cascade,
  date timestamptz not null,
  duration integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.items(id) on delete cascade,
  "order" integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_session_id uuid not null references public.exercise_sessions(id) on delete cascade,
  set_number integer not null,
  reps integer not null default 0,
  weight numeric not null default 0,
  rir numeric,
  rpe numeric,
  completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.items(id) on delete cascade,
  storage_path text not null,
  url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger set_items_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create or replace trigger set_item_instances_updated_at
before update on public.item_instances
for each row execute function public.set_updated_at();

create or replace trigger set_tags_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

create or replace trigger set_item_tags_updated_at
before update on public.item_tags
for each row execute function public.set_updated_at();

create or replace trigger set_entity_links_updated_at
before update on public.entity_links
for each row execute function public.set_updated_at();

create or replace trigger set_activity_logs_updated_at
before update on public.activity_logs
for each row execute function public.set_updated_at();

create or replace trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

create or replace trigger set_exercise_sessions_updated_at
before update on public.exercise_sessions
for each row execute function public.set_updated_at();

create or replace trigger set_set_entries_updated_at
before update on public.set_entries
for each row execute function public.set_updated_at();

create or replace trigger set_exercise_media_updated_at
before update on public.exercise_media
for each row execute function public.set_updated_at();

alter table public.items enable row level security;
alter table public.item_instances enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.entity_links enable row level security;
alter table public.activity_logs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sessions enable row level security;
alter table public.set_entries enable row level security;
alter table public.exercise_media enable row level security;

create policy "items_select_own" on public.items for select using (user_id = auth.uid());
create policy "items_write_own" on public.items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "item_instances_select_own" on public.item_instances for select using (user_id = auth.uid());
create policy "item_instances_write_own" on public.item_instances for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tags_select_own" on public.tags for select using (user_id = auth.uid());
create policy "tags_write_own" on public.tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "item_tags_select_own" on public.item_tags for select using (user_id = auth.uid());
create policy "item_tags_write_own" on public.item_tags for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entity_links_select_own" on public.entity_links for select using (user_id = auth.uid());
create policy "entity_links_write_own" on public.entity_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "activity_logs_select_own" on public.activity_logs for select using (user_id = auth.uid());
create policy "activity_logs_write_own" on public.activity_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "workout_sessions_select_own" on public.workout_sessions for select using (user_id = auth.uid());
create policy "workout_sessions_write_own" on public.workout_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "exercise_sessions_select_own" on public.exercise_sessions for select using (user_id = auth.uid());
create policy "exercise_sessions_write_own" on public.exercise_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "set_entries_select_own" on public.set_entries for select using (user_id = auth.uid());
create policy "set_entries_write_own" on public.set_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "exercise_media_select_own" on public.exercise_media for select using (user_id = auth.uid());
create policy "exercise_media_write_own" on public.exercise_media for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;

create policy "exercise_media_objects_select_own" on storage.objects
for select using (bucket_id = 'exercise-media' and split_part(name, '/', 1) = auth.uid()::text);

create policy "exercise_media_objects_insert_own" on storage.objects
for insert with check (bucket_id = 'exercise-media' and split_part(name, '/', 1) = auth.uid()::text);

create policy "exercise_media_objects_update_own" on storage.objects
for update using (bucket_id = 'exercise-media' and split_part(name, '/', 1) = auth.uid()::text);

create policy "exercise_media_objects_delete_own" on storage.objects
for delete using (bucket_id = 'exercise-media' and split_part(name, '/', 1) = auth.uid()::text);
