-- Gaming Life V1.7 · MANUAL MIGRATION ONLY (do not execute during PR).
-- Separate gaming-life Supabase project. Existing saved state is not modified.
create table if not exists public.gaming_life_task_proposals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 dedupe_key text not null check (dedupe_key ~ '^[a-zA-Z0-9_-]{3,100}$'),
 kind text not null check(kind in ('create','progress')),
 title text not null check(char_length(title) between 1 and 90),
 source text not null check(char_length(source) between 1 and 160),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=7000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 resolution jsonb, created_at timestamptz not null default now(),
 decided_at timestamptz, updated_at timestamptz not null default now(),
 unique(user_id,dedupe_key)
);
create index if not exists gaming_life_task_proposals_owner_created
 on public.gaming_life_task_proposals(user_id,created_at desc);
alter table public.gaming_life_task_proposals enable row level security;
revoke all on public.gaming_life_task_proposals from public,anon,authenticated;
grant select,insert on public.gaming_life_task_proposals to authenticated;
drop policy if exists gl_proposal_select on public.gaming_life_task_proposals;
create policy gl_proposal_select on public.gaming_life_task_proposals for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists gl_proposal_insert on public.gaming_life_task_proposals;
create policy gl_proposal_insert on public.gaming_life_task_proposals for insert to authenticated
 with check(user_id=(select auth.uid()) and status='pending' and resolution is null and decided_at is null);
-- No client update/delete privilege. The only approval mechanism is this atomic RPC.
create or replace function public.gaming_life_review_proposal(
 p_id uuid,p_action text,p_resolution jsonb,p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 u uuid := (select auth.uid());
 p public.gaming_life_task_proposals%rowtype;
 g public.gaming_life_states%rowtype;
 s jsonb;
 q jsonb:=coalesce(p_resolution,'{}'::jsonb);
 t jsonb;
 target text;
 period text;
 d date:=(now() at time zone 'Asia/Shanghai')::date;
 progress_key text;
 history jsonb;
 task_id text;
 pack_key text;
 new_rev bigint;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_action not in ('approve','reject') or p_action is null then raise exception 'Invalid action'; end if;
 if jsonb_typeof(q)<>'object' or octet_length(q::text)>7000 then raise exception 'Invalid resolution'; end if;
 select * into p from public.gaming_life_task_proposals where id=p_id and user_id=u for update;
 if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
 if p.status<>'pending' then return jsonb_build_object('ok',false,'reason','already_decided'); end if;
 if p_action='reject' then
  update public.gaming_life_task_proposals set status='rejected',resolution=q,decided_at=now(),updated_at=now()
   where id=p_id and user_id=u;
  return jsonb_build_object('ok',true,'status','rejected');
 end if;
 select * into g from public.gaming_life_states where user_id=u for update;
 if not found then return jsonb_build_object('ok',false,'reason','missing_game_state'); end if;
 if p_expected_revision is distinct from g.revision then
  return jsonb_build_object('ok',false,'reason','stale_revision','revision',g.revision);
 end if;
 s:=g.payload;
 if p.kind='create' then
  if char_length(btrim(coalesce(q->>'title',''))) not between 1 and 65
   or char_length(coalesce(q->>'detail',''))>250
   or q->>'kind' not in ('main','side')
   or q->>'area' not in ('career','learning','finance','social','health','explore')
   or q->>'repeat' not in ('once','daily','weekly')
   or coalesce(q->>'xp','') !~ '^[0-9]{1,2}$'
   or coalesce(q->>'coins','') !~ '^[0-9]{1,2}$'
   then raise exception 'Invalid task fields'; end if;
  if (q->>'xp')::integer not between 5 and 80 or (q->>'coins')::integer not between 0 and 80 then
   raise exception 'Invalid rewards'; end if;
  task_id:='ai-'||replace(p.id::text,'-','');
  pack_key:='proposal:'||p.dedupe_key;
  if not exists(select 1 from jsonb_array_elements(s->'tasks') x where x->>'id'=task_id or x->>'packKey'=pack_key) then
   if jsonb_array_length(s->'tasks')>=500 then raise exception 'Task limit exceeded'; end if;
   t:=jsonb_build_object('id',task_id,'packKey',pack_key,'proposalId',p.id,
    'title',btrim(q->>'title'),'detail',coalesce(q->>'detail',''),
    'kind',q->>'kind','area',q->>'area','repeat',q->>'repeat',
    'xp',(q->>'xp')::integer,'coins',(q->>'coins')::integer,'active',true,
    'icon',case q->>'area' when 'career' then '💼' when 'learning' then '📚'
     when 'finance' then '💰' when 'social' then '🤝' when 'health' then '💪' else '🧭' end);
   s:=jsonb_set(s,'{tasks}',(s->'tasks')||jsonb_build_array(t));
  end if;
 elsif p.kind='progress' then
  target:=q->>'targetTaskId';
  if target is null or char_length(target)>100 or q->>'status' not in ('doing','review')
   or char_length(coalesce(q->>'note',''))>240 then raise exception 'Invalid progress fields'; end if;
  select x into t from jsonb_array_elements(s->'tasks') x where x->>'id'=target limit 1;
  if t is null then return jsonb_build_object('ok',false,'reason','target_missing'); end if;
  if coalesce(t->>'active','true')='false' then return jsonb_build_object('ok',false,'reason','target_inactive'); end if;
  period:=case t->>'repeat' when 'once' then 'once'
   when 'weekly' then (d-(extract(isodow from d)::integer-1))::text else d::text end;
  if exists(select 1 from jsonb_array_elements(s->'events') e
   where e->>'taskId'=target and (t->>'repeat'='once'
    or (t->>'repeat'='daily' and e->>'date'=d::text)
    or (t->>'repeat'='weekly' and e->>'date'>=(d-(extract(isodow from d)::integer-1))::text))) then
   return jsonb_build_object('ok',false,'reason','already_completed');
  end if;
  progress_key:=target||'@'||period;
  s:=jsonb_set(s,'{questProgress}',coalesce(s->'questProgress','{}'::jsonb)||
    jsonb_build_object(progress_key,jsonb_build_object('status',q->>'status','note',coalesce(q->>'note',''),'updatedAt',now())),true);
  history:=coalesce(s->'progressHistory','[]'::jsonb)||
    jsonb_build_array(jsonb_build_object('taskId',target,'title',t->>'title','status',q->>'status',
      'note',coalesce(q->>'note',''),'date',d::text,'at',now()));
  if jsonb_array_length(history)>150 then
   select coalesce(jsonb_agg(x.elem order by x.ord),'[]'::jsonb) into history
    from jsonb_array_elements(history) with ordinality as x(elem,ord)
    where x.ord>jsonb_array_length(history)-150;
  end if;
  s:=jsonb_set(s,'{progressHistory}',history,true);
 else raise exception 'Unknown proposal kind';
 end if;
 if octet_length(s::text)>2000000 then raise exception 'Game state exceeds limit'; end if;
 update public.gaming_life_states set payload=s,revision=revision+1,updated_at=now()
  where user_id=u returning revision into new_rev;
 update public.gaming_life_task_proposals set status='approved',resolution=q,decided_at=now(),updated_at=now()
  where id=p_id and user_id=u;
 return jsonb_build_object('ok',true,'status','approved','revision',new_rev);
end;
$$;
revoke all on function public.gaming_life_review_proposal(uuid,text,jsonb,bigint) from public,anon;
grant execute on function public.gaming_life_review_proposal(uuid,text,jsonb,bigint) to authenticated;
