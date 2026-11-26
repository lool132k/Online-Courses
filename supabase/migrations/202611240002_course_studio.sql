begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('course-materials','course-materials',false,20971520,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain',
  'image/png','image/jpeg','image/webp','application/zip'
]);

create function private.can_upload_material(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.active_student() and exists (select 1 from public.profiles p
    where p.id=auth.uid() and p.is_teacher)
    and object_name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(pdf|docx|pptx|xlsx|txt|png|jpeg|jpg|webp|zip)$');
$$;

create function private.can_read_material(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.active_student() and (
    split_part(object_name,'/',1)=auth.uid()::text
    or exists (
      select 1 from public.profiles p
      join public.courses c on c.status in ('review','published')
      join private.course_workspaces w on w.course_id=c.id
      cross join lateral jsonb_array_elements(w.draft->'lessons') l(lesson)
      cross join lateral jsonb_array_elements(l.lesson->'materials') m(material)
      where p.id=auth.uid() and p.is_admin and m.material->>'path'=object_name
    )
    or exists (
      select 1 from private.course_enrollments e
      join private.course_revisions r on r.id=e.revision_id
      join public.courses c on c.id=e.course_id
      cross join lateral jsonb_array_elements(r.lessons) with ordinality l(lesson,position)
      cross join lateral jsonb_array_elements(l.lesson->'materials') m(material)
      where e.user_id=auth.uid() and e.active and c.status not in ('blocked','deleted')
        and l.position<=e.completed+1 and m.material->>'path'=object_name
    )
  );
$$;
revoke all on function private.can_upload_material(text),private.can_read_material(text) from public,anon;
grant execute on function private.can_upload_material(text),private.can_read_material(text) to authenticated;
create policy course_materials_insert on storage.objects for insert to authenticated
  with check (bucket_id='course-materials' and private.can_upload_material(name));
create policy course_materials_read on storage.objects for select to authenticated
  using (bucket_id='course-materials' and private.can_read_material(name));

create function private.valid_course_draft(d jsonb, owner_id uuid) returns boolean
language plpgsql stable set search_path='' as $$
declare
  l jsonb;
  m jsonb;
  q jsonb;
  o jsonb;
  n bigint;
  bytes bigint;
begin
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>6500000
    or not coalesce(char_length(trim(d->>'title')) between 5 and 120,false)
    or not coalesce(char_length(trim(d->>'description')) between 50 and 5000,false)
    or not coalesce(char_length(trim(d->>'category')) between 2 and 80,false)
    or not coalesce(d->>'level' in ('Начальный','Средний','Продвинутый'),false)
    or jsonb_typeof(d->'lessons') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'lessons') not between 1 and 100 then return false; end if;
  for l in select value from jsonb_array_elements(d->'lessons') loop
    if not coalesce(char_length(trim(l->>'title')) between 1 and 160,false)
      or not coalesce(char_length(trim(l->>'section')) between 1 and 120,false)
      or not coalesce(char_length(trim(l->>'body')) between 1 and 50000,false)
      or coalesce(l->>'video','') !~ '^(|youtube:[A-Za-z0-9_-]{11}|vimeo:[0-9]{1,18})$'
      or jsonb_typeof(l->'materials') is distinct from 'array'
      or jsonb_typeof(l->'quiz') is distinct from 'array' then return false; end if;
    if jsonb_array_length(l->'materials')>10 or jsonb_array_length(l->'quiz')>30 then return false; end if;
    bytes := 0;
    for m in select value from jsonb_array_elements(l->'materials') loop
      if not coalesce(char_length(m->>'name') between 1 and 180,false)
        or m->>'name' ~ '[[:cntrl:]/\\]'
        or not coalesce(m->>'path' ~ ('^'||owner_id::text||'/[0-9a-f-]{36}\.(pdf|docx|pptx|xlsx|txt|png|jpeg|jpg|webp|zip)$'),false)
        or coalesce(m->>'size','') !~ '^[0-9]{1,8}$' then return false; end if;
      select (s.metadata->>'size')::bigint into n from storage.objects s where s.bucket_id='course-materials' and s.name=m->>'path';
      if not found or n is null or n<> (m->>'size')::bigint or n not between 1 and 20971520 then return false; end if;
      bytes := bytes+n;
    end loop;
    if bytes>104857600 then return false; end if;
    for q in select value from jsonb_array_elements(l->'quiz') loop
      if not coalesce(char_length(trim(q->>'prompt')) between 1 and 1000,false)
        or coalesce(q->>'weight','') !~ '^([1-9]|10)$'
        or jsonb_typeof(q->'options') is distinct from 'array'
        or jsonb_typeof(q->'correct') is distinct from 'array' then return false; end if;
      if jsonb_array_length(q->'options') not between 2 and 6
        or jsonb_array_length(q->'correct') not between 1 and jsonb_array_length(q->'options') then return false; end if;
      for o in select value from jsonb_array_elements(q->'options') loop
        if jsonb_typeof(o)<>'string' or char_length(trim(o#>>'{}')) not between 1 and 500 then return false; end if;
      end loop;
      for o in select value from jsonb_array_elements(q->'correct') loop
        if o::text !~ '^[0-5]$' or (o::text)::integer>=jsonb_array_length(q->'options') then return false; end if;
      end loop;
    end loop;
  end loop;
  return true;
end;
$$;

-- Whitelist fields to keep the public program and lesson response independent of caller-supplied keys.
create function private.clean_course_draft(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('title',trim(d->>'title'),'description',trim(d->>'description'),
    'category',trim(d->>'category'),'level',d->>'level','lessons',
    (select jsonb_agg(jsonb_build_object('section',trim(l->>'section'),'title',trim(l->>'title'),
      'body',l->>'body','video',coalesce(l->>'video',''),
      'materials',coalesce((select jsonb_agg(jsonb_build_object('name',m->>'name','path',m->>'path','size',(m->>'size')::integer) order by mi)
        from jsonb_array_elements(l->'materials') with ordinality as a(m,mi)),'[]'::jsonb),
      'quiz',coalesce((select jsonb_agg(jsonb_build_object('prompt',trim(q->>'prompt'),'options',q->'options',
        'correct',q->'correct','weight',(q->>'weight')::integer) order by qi)
        from jsonb_array_elements(l->'quiz') with ordinality as b(q,qi)),'[]'::jsonb))
      order by li) from jsonb_array_elements(d->'lessons') with ordinality as x(l,li)));
$$;

create function public.course_studio(p_action text,p_course text default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  actor public.profiles%rowtype;
  c public.courses%rowtype;
  w private.course_workspaces%rowtype;
  req public.teacher_requests%rowtype;
  draft jsonb;
  new_status text;
  course_key text;
  revision_id uuid;
  reason text := nullif(trim(p_data->>'reason'),'');
  is_owner boolean;
  student_page integer;
begin
  if not private.active_student() then return jsonb_build_object('error','unauthorized'); end if;
  select * into actor from public.profiles where id=uid;
  if not (actor.is_teacher or actor.is_admin) then return jsonb_build_object('error','forbidden'); end if;
  if p_action='list' then
    return jsonb_build_object(
      'teacher',actor.is_teacher,'admin',actor.is_admin,
      'courses',coalesce((select jsonb_agg(jsonb_build_object('id',co.id,'title',coalesce(ws.draft->>'title',co.title),
        'status',co.status,'owned',ws.owner_id=uid) order by ws.edited_at desc)
        from private.course_workspaces ws join public.courses co on co.id=ws.course_id
        where (actor.is_teacher and ws.owner_id=uid) or (actor.is_admin and co.status in ('review','published') and ws.draft is not null)),'[]'::jsonb),
      'requests',case when actor.is_admin then coalesce((select jsonb_agg(jsonb_build_object('id',tr.id,'name',p.name) order by tr.created_at)
        from public.teacher_requests tr join public.profiles p on p.id=tr.user_id where tr.status='pending'),'[]'::jsonb) else '[]'::jsonb end);
  end if;
  if p_action in ('approve_teacher','reject_teacher') then
    if not actor.is_admin then return jsonb_build_object('error','forbidden'); end if;
    if coalesce(p_data->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or (p_action='reject_teacher' and reason is null) or char_length(reason)>1000 then return jsonb_build_object('error','invalid'); end if;
    select * into req from public.teacher_requests where id=(p_data->>'id')::uuid for update;
    if not found or req.status<>'pending' then return jsonb_build_object('error','missing'); end if;
    if p_action='approve_teacher' then update public.profiles set is_teacher=true where id=req.user_id; end if;
    update public.teacher_requests set status=case when p_action='approve_teacher' then 'approved' else 'rejected' end,
      reason=case when p_action='reject_teacher' then nullif(trim(p_data->>'reason'),'') end where id=req.id;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='create' then
    if not actor.is_teacher then return jsonb_build_object('error','forbidden'); end if;
    if not private.valid_course_draft(p_data,uid) then return jsonb_build_object('error','invalid_draft'); end if;
    draft := private.clean_course_draft(p_data);
    course_key := gen_random_uuid()::text;
    insert into public.courses(id,title,category,level,author,description,cover,color,ink)
      values(course_key,draft->>'title',draft->>'category',draft->>'level',actor.name,draft->>'description','✦','#eee9ff','#4628ba');
    insert into private.course_workspaces(course_id,owner_id,draft) values(course_key,uid,draft);
    return jsonb_build_object('id',course_key);
  end if;

  if p_action='stats' then
    if not actor.is_teacher or not exists (select 1 from private.course_workspaces ws
      where ws.course_id=p_course and ws.owner_id=uid) then return jsonb_build_object('error','missing'); end if;
    if coalesce(p_data->>'page','1') !~ '^[1-9][0-9]{0,6}$' then return jsonb_build_object('error','invalid'); end if;
    student_page := coalesce((p_data->>'page')::integer,1);
    return (
      with best as (
        select qa.user_id,qa.lesson,max(qa.score) score
        from private.quiz_attempts qa where qa.course_id=p_course and qa.status in ('pass','fail','expired','abandoned')
        group by qa.user_id,qa.lesson
      ), students as (
        select e.user_id,p.name,e.active,e.completed,e.completed_at,jsonb_array_length(r.lessons) total,
          (select round(avg(best.score),2) from best where best.user_id=e.user_id) score
        from private.course_enrollments e
        join public.profiles p on p.id=e.user_id join private.course_revisions r on r.id=e.revision_id
        where e.course_id=p_course
      ), paged as (
        select * from students order by name,user_id offset (student_page-1)*20 limit 20
      )
      select jsonb_build_object('total',(select count(*) from students),
        'active',(select count(*) from students where active),
        'completed',(select count(*) from students where completed_at is not null),
        'score',(select round(avg(best.score),2) from best),
        'students',coalesce((select jsonb_agg(to_jsonb(paged) order by name,user_id) from paged),'[]'::jsonb))
    );
  end if;

  -- Always lock the catalog row before the workspace, in the same order as enrollment.
  select * into c from public.courses where id=p_course for update;
  if not found then return jsonb_build_object('error','missing'); end if;
  select * into w from private.course_workspaces where course_id=p_course for update;
  if not found then return jsonb_build_object('error','missing'); end if;
  is_owner := actor.is_teacher and coalesce(w.owner_id=uid,false);
  if not is_owner and not (actor.is_admin and c.status in ('review','published') and w.draft is not null) then return jsonb_build_object('error','missing'); end if;
  if p_action='get' then
    return jsonb_build_object('id',c.id,'status',c.status,'draft',w.draft,'editedAt',w.edited_at,'reason',w.review_reason,
      'owned',is_owner,'admin',actor.is_admin);
  end if;
  if p_action='save' and is_owner and c.status in ('draft','unpublished') then
    if p_data->>'editedAt' is distinct from to_jsonb(w.edited_at)#>>'{}' then return jsonb_build_object('error','stale_draft'); end if;
    if not private.valid_course_draft(p_data,uid) then return jsonb_build_object('error','invalid_draft'); end if;
    update private.course_workspaces set draft=private.clean_course_draft(p_data),edited_at=clock_timestamp() where course_id=c.id;
    return jsonb_build_object('ok',true);
  end if;
  if p_action='submit' and is_owner and c.status in ('draft','unpublished') then
    if p_data->>'editedAt' is distinct from to_jsonb(w.edited_at)#>>'{}' then return jsonb_build_object('error','stale_draft'); end if;
    if not private.valid_course_draft(w.draft,w.owner_id) then return jsonb_build_object('error','invalid_draft'); end if;
    new_status := 'review';
  elsif p_action='withdraw' and is_owner and c.status='review' then
    new_status := 'draft';
  elsif p_action='publish' and actor.is_admin and c.status='review' then
    if not private.valid_course_draft(w.draft,w.owner_id) then return jsonb_build_object('error','invalid_draft'); end if;
    insert into private.course_revisions(course_id,title,lessons)
      values(c.id,w.draft->>'title',w.draft->'lessons') returning id into revision_id;
    update private.course_workspaces set published_revision_id=revision_id where course_id=c.id;
    update public.courses set title=w.draft->>'title',category=w.draft->>'category',level=w.draft->>'level',
      description=w.draft->>'description',program=private.lesson_program(w.draft->'lessons'),
      published_at=now() where id=c.id;
    new_status := 'published';
  elsif p_action='reject' and actor.is_admin and c.status='review' then
    if reason is null or char_length(reason)>1000 then return jsonb_build_object('error','invalid'); end if;
    new_status := 'draft';
  elsif p_action='unpublish' and (is_owner or actor.is_admin) and c.status='published' then
    new_status := 'unpublished';
  elsif p_action='archive' and is_owner and c.status in ('draft','unpublished') then
    new_status := 'archived';
    update private.quiz_attempts set status='cancelled_system',finished_at=now()
      where course_id=c.id and status='active';
  elsif p_action='restore' and is_owner and c.status='archived' then
    new_status := 'unpublished';
  else
    return jsonb_build_object('error','forbidden');
  end if;
  update public.courses set status=new_status where id=c.id;
  update private.course_workspaces set review_reason=case when p_action='reject' then reason end,
    edited_at=clock_timestamp() where course_id=c.id;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function private.valid_course_draft(jsonb,uuid),private.clean_course_draft(jsonb),private.quiz_score(jsonb,jsonb),
  private.attempt_result(private.quiz_attempts),private.lesson_program(jsonb) from public,anon,authenticated;
revoke all on function public.course_studio(text,text,jsonb) from public,anon;
grant execute on function public.course_studio(text,text,jsonb) to authenticated;
commit;
