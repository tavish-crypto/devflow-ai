begin;
create extension if not exists pgcrypto;
create type public.issue_status as enum ('draft','publishing','published','publish_unknown','failed');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text check(length(name)<=200),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.issues(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,repo_owner text,repo_name text,report jsonb not null check(jsonb_typeof(report)='object'),priority text not null check(priority in ('low','medium','high')),status public.issue_status not null default 'draft',github_issue_number integer check(github_issue_number>0),github_url text,idempotency_key uuid,failure_detail text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,idempotency_key),unique(id,user_id),check((repo_owner is null)=(repo_name is null)),check(status<>'published' or (github_issue_number is not null and github_url is not null)));
create index issues_user_created on public.issues(user_id,created_at desc);
create table public.issue_evidence(id uuid primary key default gen_random_uuid(),issue_id uuid not null,user_id uuid not null,source_title text not null,source_url text not null,selected_text text not null,user_notes text,provenance jsonb not null,foreign key(issue_id,user_id) references public.issues(id,user_id) on delete cascade,created_at timestamptz not null default now());
create index evidence_issue on public.issue_evidence(issue_id);
create table public.github_connections(user_id uuid primary key references auth.users(id) on delete cascade,installation_id bigint not null check(installation_id>0),github_user_id bigint not null,encrypted_user_token text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.extension_pairings(id uuid primary key default gen_random_uuid(),polling_hash text not null unique,code text not null unique,user_id uuid references auth.users(id) on delete cascade,expires_at timestamptz not null default now()+interval '5 minutes',approved_at timestamptz,exchanged_at timestamptz,created_at timestamptz not null default now());
create table public.extension_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,token_hash text not null unique,scopes text[] not null default array['analyze','issues:read','issues:write'],expires_at timestamptz not null default now()+interval '1 hour',revoked_at timestamptz,created_at timestamptz not null default now());
create index sessions_user on public.extension_sessions(user_id);
create table public.issue_events(id uuid primary key default gen_random_uuid(),issue_id uuid not null,user_id uuid not null,event_type text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now(),foreign key(issue_id,user_id) references public.issues(id,user_id) on delete cascade);
create index events_issue on public.issue_events(issue_id,created_at);
create table public.api_rate_limits(key text primary key,window_start timestamptz not null default now(),count integer not null default 1);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end;$$;
create trigger issues_updated before update on public.issues for each row execute function public.touch_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger connections_updated before update on public.github_connections for each row execute function public.touch_updated_at();
create function public.new_profile() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id) values(new.id);return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
alter table public.profiles enable row level security;
alter table public.issues enable row level security;
alter table public.issue_evidence enable row level security;
alter table public.github_connections enable row level security;
alter table public.extension_pairings enable row level security;
alter table public.extension_sessions enable row level security;
alter table public.issue_events enable row level security;
alter table public.api_rate_limits enable row level security;
-- Browser clients may only read their own records. All writes go through validated server RPCs.
revoke all on public.profiles,public.issues,public.issue_evidence,public.github_connections,public.extension_pairings,public.extension_sessions,public.issue_events,public.api_rate_limits from anon,authenticated;
grant select on public.profiles,public.issues,public.issue_evidence,public.issue_events to authenticated;
create policy profiles_owner on public.profiles for select to authenticated using((select auth.uid())=id);
create policy issues_owner on public.issues for select to authenticated using((select auth.uid())=user_id);
create policy evidence_owner on public.issue_evidence for select to authenticated using((select auth.uid())=user_id);
create policy events_owner on public.issue_events for select to authenticated using((select auth.uid())=user_id);
-- No user-facing policies on integration secrets, pairing hashes or scoped tokens.
grant all on public.profiles,public.issues,public.issue_evidence,public.github_connections,public.extension_pairings,public.extension_sessions,public.issue_events,public.api_rate_limits to service_role;
create function public.take_rate_limit(p_key text,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$declare n integer;begin
insert into public.api_rate_limits(key) values(p_key) on conflict(key) do update set count=case when api_rate_limits.window_start<now()-interval '1 minute' then 1 else api_rate_limits.count+1 end,window_start=case when api_rate_limits.window_start<now()-interval '1 minute' then now() else api_rate_limits.window_start end returning count into n;
delete from public.api_rate_limits where window_start<now()-interval '1 day';return n<=p_limit;end;$$;
create function public.create_issue(p_user uuid,p_report jsonb,p_capture jsonb,p_owner text default null,p_repo text default null) returns public.issues language plpgsql security definer set search_path='' as $$declare r public.issues;begin
insert into public.issues(user_id,report,priority,repo_owner,repo_name) values(p_user,p_report,p_report->>'priority',p_owner,p_repo) returning * into r;
insert into public.issue_evidence(issue_id,user_id,source_title,source_url,selected_text,user_notes,provenance) values(r.id,p_user,p_capture->>'pageTitle',p_capture->>'url',p_capture->>'selectedText',p_capture->>'userNotes',jsonb_build_object('capturedAt',p_capture->>'capturedAt','source','browser_selection'));
insert into public.issue_events(issue_id,user_id,event_type) values(r.id,p_user,'draft_created');return r;end;$$;
create function public.edit_issue(p_user uuid,p_id uuid,p_report jsonb default null,p_owner text default null,p_repo text default null) returns public.issues language plpgsql security definer set search_path='' as $$declare r public.issues;begin
select * into r from public.issues where id=p_id and user_id=p_user for update;
if r.id is null then raise exception 'not_found';end if;
if r.status not in ('draft','failed') then raise exception 'not_editable';end if;
update public.issues set report=coalesce(p_report,report),priority=coalesce(p_report->>'priority',priority),repo_owner=coalesce(p_owner,repo_owner),repo_name=coalesce(p_repo,repo_name) where id=p_id returning * into r;
insert into public.issue_events(issue_id,user_id,event_type) values(r.id,p_user,'draft_edited');return r;end;$$;
create function public.claim_publish(p_user uuid,p_id uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r public.issues;begin
select * into r from public.issues where id=p_id and user_id=p_user for update;
if r.id is null then raise exception 'not_found';end if;
if r.idempotency_key is not null and r.idempotency_key<>p_key then raise exception 'idempotency_conflict';end if;
if r.status='publishing' and r.updated_at<now()-interval '30 seconds' then update public.issues set status='publish_unknown',failure_detail='Interrupted publication; reconcile before any further action' where id=r.id returning * into r;end if;
if r.status in ('published','publishing','publish_unknown') then return jsonb_build_object('claimed',false,'issue',to_jsonb(r));end if;
if r.repo_owner is null then raise exception 'repository_required';end if;
update public.issues set status='publishing',idempotency_key=p_key,failure_detail=null where id=r.id returning * into r;
insert into public.issue_events(issue_id,user_id,event_type) values(r.id,p_user,'publish_started');return jsonb_build_object('claimed',true,'issue',to_jsonb(r));end;$$;
create function public.finish_publish(p_user uuid,p_id uuid,p_key uuid,p_status public.issue_status,p_number integer default null,p_url text default null,p_failure text default null) returns public.issues language plpgsql security definer set search_path='' as $$declare r public.issues;begin
if p_status not in ('published','publish_unknown','failed') then raise exception 'invalid_transition';end if;
select * into r from public.issues where id=p_id and user_id=p_user and idempotency_key=p_key for update;
if r.id is null then raise exception 'not_found';end if;
if r.status='published' then return r;end if;
if r.status not in ('publishing','publish_unknown') or (r.status='publish_unknown' and p_status='failed') then raise exception 'invalid_transition';end if;
update public.issues set status=p_status,github_issue_number=p_number,github_url=p_url,failure_detail=p_failure where id=p_id returning * into r;
insert into public.issue_events(issue_id,user_id,event_type) values(r.id,p_user,'publish_'||p_status::text);return r;end;$$;
create function public.confirm_pairing(p_user uuid,p_code text) returns uuid language plpgsql security definer set search_path='' as $$declare r public.extension_pairings;begin
select * into r from public.extension_pairings where code=p_code for update;
if r.id is null or r.expires_at<=now() or r.approved_at is not null or r.exchanged_at is not null then raise exception 'pairing_invalid';end if;
update public.extension_pairings set user_id=p_user,approved_at=now() where id=r.id;return r.id;end;$$;
create function public.exchange_pairing(p_id uuid,p_polling_hash text,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$declare r public.extension_pairings;s public.extension_sessions;begin
select * into r from public.extension_pairings where id=p_id and polling_hash=p_polling_hash for update;
if r.id is null or r.expires_at<=now() or r.exchanged_at is not null then raise exception 'pairing_invalid';end if;
if r.approved_at is null then return jsonb_build_object('status','pending');end if;
insert into public.extension_sessions(user_id,token_hash) values(r.user_id,p_token_hash) returning * into s;
update public.extension_pairings set exchanged_at=now() where id=r.id;
return jsonb_build_object('status','approved','sessionId',s.id,'expiresAt',s.expires_at);end;$$;
-- Explicitly deny execution of definer functions to public/browser roles.
revoke execute on function public.touch_updated_at(),public.new_profile(),public.take_rate_limit(text,integer),public.create_issue(uuid,jsonb,jsonb,text,text),public.edit_issue(uuid,uuid,jsonb,text,text),public.claim_publish(uuid,uuid,uuid),public.finish_publish(uuid,uuid,uuid,public.issue_status,integer,text,text),public.confirm_pairing(uuid,text),public.exchange_pairing(uuid,text,text) from public,anon,authenticated;
grant execute on function public.take_rate_limit(text,integer),public.create_issue(uuid,jsonb,jsonb,text,text),public.edit_issue(uuid,uuid,jsonb,text,text),public.claim_publish(uuid,uuid,uuid),public.finish_publish(uuid,uuid,uuid,public.issue_status,integer,text,text),public.confirm_pairing(uuid,text),public.exchange_pairing(uuid,text,text) to service_role;
commit;
