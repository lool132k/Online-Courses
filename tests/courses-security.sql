-- Disposable fixtures and rate counters, always rolled back.
begin;
do $test$
declare course text:='qa-'||gen_random_uuid()::text; key text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'); result jsonb;
begin
  insert into public.courses(id,title,category,level,author,description,cover,color,ink,status)
    values(course,'Private course','Дизайн','Начальный','QA','Private content','QA','#ffffff','#000000','draft');
  insert into public.lessons(course_id,position,title,body) values(course,1,'Private lesson','Hidden content');
  set local role anon;
  if exists(select 1 from public.courses where id=course) then raise exception 'Draft visible'; end if;
  if exists(select 1 from public.lessons where course_id=course) then raise exception 'Draft lesson visible'; end if;
  if (select count(*) from public.courses where status='published')<4 then raise exception 'Published catalogue missing'; end if;
  if (select count(*) from public.lessons where course_id='python')<>3 then raise exception 'Lessons missing'; end if;
  begin
    update public.courses set status='published' where id=course;
    raise exception 'Anonymous write allowed';
  exception when insufficient_privilege then null; end;
  set local role authenticated;
  begin
    update public.courses set status='published' where id=course;
    raise exception 'Student write allowed';
  exception when insufficient_privilege then null; end;
  set local role anon;
  for i in 1..10 loop
    result=public.consume_auth_limit('login_identity',key);
    if not (result->>'allowed')::boolean then raise exception 'Early limit'; end if;
  end loop;
  result=public.consume_auth_limit('login_identity',key);
  if (result->>'allowed')::boolean or (result->>'retry_after')::int<=0 then raise exception 'Limit bypass'; end if;
  begin
    perform public.consume_auth_limit('unknown',key);
    raise exception 'Custom policy accepted';
  exception when raise_exception then if sqlerrm='Custom policy accepted' then raise; end if; end;
  begin
    perform * from private.auth_rate_limits;
    raise exception 'Counter read allowed';
  exception when insufficient_privilege then null; end;
  reset role;
end;$test$;
rollback;
select 'PASS: published courses/lessons visible, drafts hidden, client writes denied, persistent limits enforced; fixtures rolled back' as result;
