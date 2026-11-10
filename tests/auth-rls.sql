-- Run as postgres in SQL Editor. Fixtures are always rolled back.
begin;
do $test$
declare
  student uuid := gen_random_uuid();
  other_student uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)
  values (student,student::text || '@example.invalid','{"name":"Integration student","is_admin":true,"is_teacher":true}',now()),
         (other_student,other_student::text || '@example.invalid','{"name":"Other student"}',null);
  if not exists(select 1 from public.profiles where id=student and not is_admin and not is_teacher and not blocked)
    then raise exception 'Role metadata bypass'; end if;
  perform set_config('request.jwt.claim.sub',student::text,true);
  set local role authenticated;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  update public.profiles set name='Updated student' where id=student;
  if not exists(select 1 from public.profiles where id=student and name='Updated student')
    then raise exception 'Own name update failed'; end if;
  update public.profiles set name='Foreign update' where id=other_student;
  if found then raise exception 'Foreign name update allowed'; end if;
  begin
    update public.profiles set name='x' where id=student;
    raise exception 'Invalid name accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set is_admin=true where id=student;
    raise exception 'Role write allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.teacher_requests(user_id) values(other_student);
    raise exception 'Foreign request allowed';
  exception when insufficient_privilege then null; end;
  insert into public.teacher_requests(user_id) values(student);
  begin
    insert into public.teacher_requests(user_id) values(student);
    raise exception 'Duplicate pending allowed';
  exception when unique_violation then null; end;
  reset role;
  perform set_config('request.jwt.claim.sub',other_student::text,true);
  set local role authenticated;
  if exists(select 1 from public.profiles) or exists(select 1 from public.teacher_requests)
    then raise exception 'Unconfirmed access allowed'; end if;
  update public.profiles set name='Unconfirmed update' where id=other_student;
  if found then raise exception 'Unconfirmed name update allowed'; end if;
  begin
    insert into public.teacher_requests(user_id) values(other_student);
    raise exception 'Unconfirmed request allowed';
  exception when insufficient_privilege then null; end;
  reset role;
  update public.profiles set blocked=true where id=student;
  perform set_config('request.jwt.claim.sub',student::text,true);
  set local role authenticated;
  if exists(select 1 from public.profiles) or exists(select 1 from public.teacher_requests)
    then raise exception 'Blocked access allowed'; end if;
  update public.profiles set name='Blocked update' where id=student;
  if found then raise exception 'Blocked name update allowed'; end if;
  begin
    insert into public.teacher_requests(user_id) values(student);
    raise exception 'Blocked request allowed';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role anon;
  begin
    perform * from public.profiles;
    raise exception 'Anonymous profile access allowed';
  exception when insufficient_privilege then null; end;
  reset role;
end
$test$;
rollback;
select 'PASS: profile trigger, metadata roles, own name update, invalid/foreign/blocked/unconfirmed name rejection, RLS isolation, role writes, pending uniqueness, anonymous access; fixtures rolled back' as result;
