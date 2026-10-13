-- Gaming Life V1.5: Supabase Auth + per-user JSONB save with revision CAS.
-- Run this in a NEW, SEPARATE Supabase project in SQL Editor.
-- Safe to execute again; does not drop rows or reset revisions.
create table if not exists public.gaming_life_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint gaming_life_payload_valid check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'version' = '1'
    and jsonb_typeof(payload -> 'tasks') = 'array'
    and jsonb_typeof(payload -> 'events') = 'array'
    and octet_length(payload::text) <= 2000000
  )
);

alter table public.gaming_life_states enable row level security;

-- Do not expose any other user's data. Anonymous requests see nothing.
revoke all on table public.gaming_life_states from anon;
grant select, insert, update on public.gaming_life_states to authenticated;

drop policy if exists "gaming_life_read_self" on public.gaming_life_states;
create policy "gaming_life_read_self" on public.gaming_life_states
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "gaming_life_write_self" on public.gaming_life_states;
create policy "gaming_life_write_self" on public.gaming_life_states
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "gaming_life_update_self" on public.gaming_life_states;
create policy "gaming_life_update_self" on public.gaming_life_states
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- PostgreSQL is authoritative for revision checks, so a stale client cannot
-- silently overwrite a newer cloud save even if two devices push together.
create or replace function public.gaming_life_put_state(
  expected_revision bigint,
  new_state jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  new_rev bigint;
  latest_rev bigint;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid revision';
  end if;
  if jsonb_typeof(new_state) <> 'object'
     or new_state ->> 'version' <> '1'
     or jsonb_typeof(new_state -> 'tasks') <> 'array'
     or jsonb_typeof(new_state -> 'events') <> 'array'
     or octet_length(new_state::text) > 2000000 then
    raise exception 'Invalid Gaming Life state';
  end if;

  if expected_revision = 0 then
    insert into public.gaming_life_states(user_id, payload, revision, updated_at)
      values (owner_id, new_state, 1, now())
      on conflict (user_id) do nothing
      returning revision into new_rev;
  else
    update public.gaming_life_states as s
      set payload = new_state,
          revision = s.revision + 1,
          updated_at = now()
      where s.user_id = owner_id and s.revision = expected_revision
      returning revision into new_rev;
  end if;

  if new_rev is not null then
    return jsonb_build_object('ok', true, 'revision', new_rev);
  end if;
  select revision into latest_rev
    from public.gaming_life_states where user_id = owner_id;
  return jsonb_build_object('ok', false, 'revision', latest_rev, 'reason', 'revision_conflict');
end;
$$;

revoke all on function public.gaming_life_put_state(bigint,jsonb) from public,anon;
grant execute on function public.gaming_life_put_state(bigint,jsonb) to authenticated;