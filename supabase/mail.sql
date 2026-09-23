-- mail.sql — the "Write to me" feature of the site.
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run again.
--
-- How it works
--   Visitors never touch the tables. They can only call three functions:
--     send_message   → starts a thread, returns a secret token (the visitor's link)
--     get_thread     → read a thread, but only with its token
--     visitor_reply  → answer inside a thread, only with its token
--   You (Steve) sign in on the site's /#inbox page. Admin functions check that
--   your user id is in site_admins; everyone else gets "not allowed".
--
-- After running this file (once):
--   1. Authentication → Users → Add user → your email + a long password.
--   2. Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".
--   3. Run:  insert into public.site_admins (user_id)
--            select id from auth.users where email = 'YOUR_EMAIL';

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.mail_threads (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  name         text not null check (char_length(name) between 1 and 80),
  email        text check (email is null or char_length(email) <= 200),
  subject      text not null check (char_length(subject) between 1 and 140),
  project      text check (project is null or char_length(project) <= 40),
  status       text not null default 'open' check (status in ('open', 'closed')),
  unread       boolean not null default true,          -- unread by Steve
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.mail_messages (
  id           bigint generated always as identity primary key,
  thread_id    uuid not null references public.mail_threads(id) on delete cascade,
  from_admin   boolean not null default false,
  body         text not null check (char_length(body) between 1 and 5000),
  created_at   timestamptz not null default now()
);
create index if not exists mail_messages_thread_idx on public.mail_messages (thread_id, created_at);
create index if not exists mail_threads_created_idx on public.mail_threads (created_at);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Nobody reads or writes the tables directly. Everything goes through the functions below.
alter table public.mail_threads  enable row level security;
alter table public.mail_messages enable row level security;
alter table public.site_admins   enable row level security;
revoke all on public.mail_threads, public.mail_messages, public.site_admins from anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public.mail_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;

create or replace function public.mail_thread_json(p_id uuid, p_with_email boolean)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', t.id, 'subject', t.subject, 'name', t.name, 'project', t.project, 'status', t.status,
    'email', case when p_with_email then t.email end,
    'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((select json_agg(json_build_object('from_admin', m.from_admin, 'body', m.body, 'created_at', m.created_at) order by m.created_at, m.id)
                          from public.mail_messages m where m.thread_id = t.id), '[]'::json))
  from public.mail_threads t where t.id = p_id;
$$;

-- ---------------------------------------------------------------- visitor
create or replace function public.send_message(p_name text, p_email text, p_subject text, p_body text, p_project text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token text;
begin
  p_name := nullif(btrim(p_name), ''); p_subject := nullif(btrim(p_subject), ''); p_body := nullif(btrim(p_body), '');
  p_email := nullif(btrim(p_email), ''); p_project := nullif(btrim(p_project), '');
  if p_name is null or p_subject is null or p_body is null then raise exception 'name, subject and message are required'; end if;
  if p_email is not null and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'that email address does not look right'; end if;
  -- flood guard for the whole site: at most 30 new threads per 10 minutes
  if (select count(*) from public.mail_threads where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'too many messages right now, try again in a few minutes';
  end if;
  insert into public.mail_threads (name, email, subject, project) values (p_name, p_email, p_subject, p_project)
    returning id, token into v_id, v_token;
  insert into public.mail_messages (thread_id, body) values (v_id, p_body);
  return v_token;
end $$;

create or replace function public.get_thread(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.mail_threads where token = p_token;
  if v_id is null then raise exception 'thread not found'; end if;
  return public.mail_thread_json(v_id, false);
end $$;

create or replace function public.visitor_reply(p_token text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text;
begin
  p_body := nullif(btrim(p_body), '');
  if p_body is null then raise exception 'message is empty'; end if;
  select id, status into v_id, v_status from public.mail_threads where token = p_token;
  if v_id is null then raise exception 'thread not found'; end if;
  if v_status <> 'open' then raise exception 'this conversation is closed'; end if;
  if (select count(*) from public.mail_messages where thread_id = v_id and not from_admin and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many messages in this conversation, try again later';
  end if;
  insert into public.mail_messages (thread_id, body) values (v_id, p_body);
  update public.mail_threads set unread = true, updated_at = now() where id = v_id;
  return public.mail_thread_json(v_id, false);
end $$;

-- ---------------------------------------------------------------- Steve
create or replace function public.admin_threads()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select json_agg(x order by x.updated_at desc) from (
    select t.id, t.subject, t.name, t.email, t.project, t.status, t.unread, t.created_at, t.updated_at,
           (select left(m.body, 140) from public.mail_messages m where m.thread_id = t.id order by m.created_at desc, m.id desc limit 1) as last_body,
           (select count(*) from public.mail_messages m where m.thread_id = t.id) as n
    from public.mail_threads t) x), '[]'::json);
end $$;

create or replace function public.admin_thread(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_is_admin() then raise exception 'not allowed'; end if;
  update public.mail_threads set unread = false where id = p_id;
  return public.mail_thread_json(p_id, true);
end $$;

create or replace function public.admin_reply(p_id uuid, p_body text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_is_admin() then raise exception 'not allowed'; end if;
  p_body := nullif(btrim(p_body), '');
  if p_body is null then raise exception 'message is empty'; end if;
  if not exists (select 1 from public.mail_threads where id = p_id) then raise exception 'thread not found'; end if;
  insert into public.mail_messages (thread_id, from_admin, body) values (p_id, true, p_body);
  update public.mail_threads set unread = false, updated_at = now() where id = p_id;
  return public.mail_thread_json(p_id, true);
end $$;

create or replace function public.admin_set_status(p_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_is_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('open', 'closed') then raise exception 'bad status'; end if;
  update public.mail_threads set status = p_status, updated_at = now() where id = p_id;
  return public.mail_thread_json(p_id, true);
end $$;

create or replace function public.admin_delete_thread(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_is_admin() then raise exception 'not allowed'; end if;
  delete from public.mail_threads where id = p_id;
end $$;

-- ---------------------------------------------------------------- permissions
-- Postgres lets PUBLIC execute new functions by default. Take that away, then grant exactly what is needed.
revoke execute on function public.mail_is_admin(), public.mail_thread_json(uuid, boolean),
  public.send_message(text, text, text, text, text), public.get_thread(text), public.visitor_reply(text, text),
  public.admin_threads(), public.admin_thread(uuid), public.admin_reply(uuid, text),
  public.admin_set_status(uuid, text), public.admin_delete_thread(uuid)
  from public, anon, authenticated;

grant execute on function public.send_message(text, text, text, text, text), public.get_thread(text), public.visitor_reply(text, text)
  to anon, authenticated;
grant execute on function public.admin_threads(), public.admin_thread(uuid), public.admin_reply(uuid, text),
  public.admin_set_status(uuid, text), public.admin_delete_thread(uuid)
  to authenticated;
