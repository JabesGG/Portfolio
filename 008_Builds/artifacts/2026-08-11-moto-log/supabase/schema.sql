-- =====================================================================
-- Moto Log — database schema for Supabase
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste
-- this whole file → Run. Safe to run again: everything is "if not
-- exists" or replaced in place.
--
-- What it creates
--   bikes, entries, rides, settings   one row per record, per rider
--   receipts (storage bucket)         receipt photos, private
--
-- How the app uses it
--   Each device keeps its own copy and syncs record by record. A record
--   is never hard-deleted by the app: deleting sets `deleted` so other
--   devices learn about it. `updated_at` is when the rider made the
--   change (set by the app); `synced_at` is when the server received it
--   (set here), and is what devices ask for changes "since".
--
-- Security
--   Row-level security on every table: a signed-in rider can read and
--   write only rows whose user_id is their own. Nothing is readable
--   without signing in. Photos live under a folder named after the
--   rider's user id, with the same rule.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Shared trigger: stamp the server time, and never let an older edit
-- overwrite a newer one (two devices editing the same record offline).
-- ---------------------------------------------------------------------
create or replace function public.moto_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- An edit made earlier than the one already stored loses. Returning the
    -- old row leaves it untouched, and synced_at unchanged, so no device is
    -- told about a change that did not happen.
    if new.updated_at < old.updated_at then
      return old;
    end if;
    -- A row cannot be moved to another rider.
    new.user_id := old.user_id;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Tables. Every table has the same sync columns:
--   user_id, id, data, updated_at, deleted, synced_at
-- `data` holds the record exactly as the app stores it; the extra
-- columns on entries and rides are copies for reading in the dashboard.
-- ---------------------------------------------------------------------

create table if not exists public.bikes (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (length(id) between 1 and 64),
  data       jsonb       not null default '{}'::jsonb check (octet_length(data::text) < 200000),
  updated_at timestamptz not null,
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table if not exists public.entries (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (length(id) between 1 and 64),
  bike_id    text        not null check (length(bike_id) between 1 and 64),
  type       text        check (type in ('fuel', 'service', 'expense')),
  date       date,
  odo        numeric,
  amount     numeric,
  data       jsonb       not null default '{}'::jsonb check (octet_length(data::text) < 50000),
  updated_at timestamptz not null,
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table if not exists public.rides (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (length(id) between 1 and 64),
  bike_id    text        not null check (length(bike_id) between 1 and 64),
  started_at timestamptz,
  km         numeric,
  data       jsonb       not null default '{}'::jsonb check (octet_length(data::text) < 500000),
  updated_at timestamptz not null,
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- One row per rider (id is always 'me'): fuel-card discounts, pump prices,
-- saved workshops, which bike is selected.
create table if not exists public.settings (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null default 'me' check (id = 'me'),
  data       jsonb       not null default '{}'::jsonb check (octet_length(data::text) < 100000),
  updated_at timestamptz not null,
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);


-- ---------------------------------------------------------------------
-- Per-table setup: index for "changes since", trigger, row-level security.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['bikes', 'entries', 'rides', 'settings'] loop
    execute format('create index if not exists %I on public.%I (user_id, synced_at)', t || '_user_synced', t);

    execute format('drop trigger if exists moto_stamp on public.%I', t);
    execute format('create trigger moto_stamp before insert or update on public.%I
                    for each row execute function public.moto_stamp()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id)
                    with check ((select auth.uid()) = user_id)', t);

    -- Signed-out visitors get nothing; signed-in riders get their own rows
    -- (the policy above does the filtering).
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- Receipt photos: a private bucket. Each rider's photos sit under a
-- folder named after their user id: <user id>/<photo id>.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists "receipts: read own"   on storage.objects;
drop policy if exists "receipts: add own"    on storage.objects;
drop policy if exists "receipts: change own" on storage.objects;
drop policy if exists "receipts: remove own" on storage.objects;

create policy "receipts: read own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipts: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipts: change own" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipts: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Closing an account from the app. Deletes the signed-in rider's login; every
-- row above goes with it (on delete cascade). The app removes the receipt
-- photos through the Storage API first, since storage files can't be deleted
-- from SQL.
-- ---------------------------------------------------------------------------
create or replace function public.delete_me()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
