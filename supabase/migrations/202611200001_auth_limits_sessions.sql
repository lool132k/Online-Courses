begin;
create table private.auth_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  attempts integer not null check(attempts > 0),
  primary key(scope,key_hash,window_start)
);
alter table private.auth_rate_limits enable row level security;
revoke all on private.auth_rate_limits from public,anon,authenticated;

-- Fixed policies: callers cannot choose a higher limit, reset a counter or read identifiers.
create function public.consume_auth_limit(p_scope text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare maximum integer; seconds integer; window_time timestamptz; hits integer;
begin
  if p_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid key'; end if;
  select lim,win into maximum,seconds from (values
    ('login_ip',60,900),('login_identity',10,900),
    ('signup_ip',10,3600),('signup_identity',3,3600),
    ('resend_ip',20,3600),('resend_identity',3,3600),
    ('recover_ip',20,3600),('recover_identity',3,3600),
    ('reset_ip',20,900),('reset_identity',5,900)
  ) as policies(scope,lim,win) where scope=p_scope;
  if maximum is null then raise exception 'Invalid scope'; end if;
  window_time=to_timestamp(floor(extract(epoch from now())/seconds)*seconds);
  delete from private.auth_rate_limits where window_start < now()-interval '1 day';
  insert into private.auth_rate_limits(scope,key_hash,window_start,attempts)
    values(p_scope,p_key,window_time,1)
    on conflict(scope,key_hash,window_start) do update
      set attempts=least(private.auth_rate_limits.attempts+1,maximum+1)
    returning attempts into hits;
  return jsonb_build_object('allowed',hits<=maximum,'retry_after',greatest(1,ceil(extract(epoch from window_time+make_interval(secs=>seconds)-now()))::integer));
end;$$;
revoke all on function public.consume_auth_limit(text,text) from public;
grant execute on function public.consume_auth_limit(text,text) to anon,authenticated;

-- A JWT remains cryptographically valid until expiry. Require its live provider session too.
create or replace function private.active_student() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    join auth.sessions s on s.user_id=p.id
    where p.id=(select auth.uid()) and not p.blocked and u.email_confirmed_at is not null
      and s.id::text=(select auth.jwt()->>'session_id')
      and s.created_at>now()-interval '7 days'
      and (s.not_after is null or s.not_after>now())
  );
$$;
create function public.session_is_active() returns boolean
language sql stable security definer set search_path='' as $$select private.active_student();$$;
revoke all on function public.session_is_active() from public,anon;
grant execute on function public.session_is_active() to authenticated;
commit;
