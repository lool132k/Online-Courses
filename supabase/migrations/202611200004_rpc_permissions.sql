begin;
alter function public.session_is_active() security invoker;
create policy no_client_counter_access on private.auth_rate_limits
  for all to anon,authenticated using(false) with check(false);
comment on function public.consume_auth_limit(text,text) is
  'Intentional anonymous security-definer entry point for login throttling. Fixed policies only; consumes a hashed bucket, never reads/resets counters or accepts SQL/limits.';
commit;
