-- Apply once with Supabase migrations / SQL Editor, before enabling signup.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  is_teacher boolean not null default false,
  is_admin boolean not null default false,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.teacher_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  check (status <> 'rejected' or length(trim(reason)) > 0 and reason is not null)
);
create unique index one_pending_teacher_request on public.teacher_requests(user_id) where status = 'pending';

create function public.create_student_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Roles never come from user-controlled raw_user_meta_data.
  insert into public.profiles(id,name) values (new.id,trim(new.raw_user_meta_data->>'name'));
  return new;
end;
$$;
revoke all on function public.create_student_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_student_profile();

create function public.active_student() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = (select auth.uid()) and not p.blocked and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.active_student() from public, anon;
grant execute on function public.active_student() to authenticated;
alter table public.profiles enable row level security;
alter table public.teacher_requests enable row level security;
revoke all on public.profiles, public.teacher_requests from anon, authenticated;
grant select on public.profiles, public.teacher_requests to authenticated;
grant insert(user_id) on public.teacher_requests to authenticated;
create policy own_active_profile on public.profiles for select to authenticated
using (id = (select auth.uid()) and (select public.active_student()));
create policy own_requests on public.teacher_requests for select to authenticated
using (user_id = (select auth.uid()) and (select public.active_student()));
create policy request_teacher on public.teacher_requests for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.active_student())
  and not exists (select 1 from public.profiles where id = (select auth.uid()) and is_teacher));
-- No client UPDATE/DELETE policies or grants: users cannot promote/unblock themselves
-- or approve requests. An administrator UI and audited role changes are a later slice.
commit;
