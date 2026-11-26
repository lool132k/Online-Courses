begin;

alter table public.courses
  add column program jsonb not null default '[]',
  add column published_at timestamptz,
  drop constraint courses_status_check,
  add constraint courses_status_check check (status in ('draft','review','published','unpublished','archived','blocked','deleted')),
  drop constraint courses_level_check,
  add constraint courses_level_check check (level in ('Начальный','Средний','Продвинутый')),
  drop constraint courses_description_check,
  add constraint courses_description_check check (char_length(description) between 1 and 5000);

create table private.course_revisions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id),
  title text not null,
  lessons jsonb not null check (jsonb_typeof(lessons) = 'array' and jsonb_array_length(lessons) between 1 and 100),
  unique (course_id,id)
);

create table private.course_workspaces (
  course_id text primary key references public.courses(id),
  owner_id uuid references public.profiles(id) on delete set null,
  published_revision_id uuid,
  draft jsonb,
  review_reason text,
  edited_at timestamptz not null default now(),
  foreign key (course_id,published_revision_id) references private.course_revisions(course_id,id)
);

insert into private.course_workspaces(course_id) select id from public.courses;
insert into private.course_revisions(course_id,title,lessons)
select c.id,c.title,jsonb_agg(jsonb_build_object(
  'title',l.title,'body',l.body,'section','Уроки','video','','materials','[]'::jsonb,'quiz','[]'::jsonb
) order by l.position)
from public.courses c join public.lessons l on l.course_id=c.id
where c.status in ('published','archived') group by c.id;
update private.course_workspaces w set published_revision_id=r.id
from private.course_revisions r where r.course_id=w.course_id;

create function private.lesson_program(lessons jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('position',ordinality,'title',item->>'title',
    'section',item->>'section','hasQuiz',jsonb_array_length(item->'quiz')>0) order by ordinality),'[]'::jsonb)
  from jsonb_array_elements(lessons) with ordinality as l(item,ordinality);
$$;

update public.courses c set program=private.lesson_program(r.lessons),
  published_at=case when c.status='published' then c.created_at end
from private.course_revisions r where r.course_id=c.id;
create index courses_catalog_order on public.courses(published_at desc,id) where status='published';

create function public.course_categories() returns text[]
language sql stable set search_path='' as $$
  select coalesce(array_agg(distinct category order by category),'{}'::text[])
  from public.courses where status='published';
$$;

create function public.course_catalog(p_query text,p_category text,p_level text,p_page integer) returns jsonb
language sql stable set search_path='' as $$
  with visible as (
    select id,title,category,level,author,description,cover,color,ink,program,published_at
    from public.courses where status='published'
      and strpos(lower(title),lower(left(coalesce(p_query,''),120)))>0
      and (coalesce(p_category,'')='' or category=p_category)
      and (coalesce(p_level,'')='' or level=p_level)
  ), paged as (
    select * from visible order by published_at desc nulls last,id
    offset (greatest(p_page,1)::bigint-1)*12 limit 12
  )
  select jsonb_build_object('count',(select count(*) from visible),'courses',
    coalesce((select jsonb_agg(to_jsonb(paged)-'published_at' order by published_at desc nulls last,id) from paged),'[]'::jsonb));
$$;
revoke all on function public.course_categories(),public.course_catalog(text,text,text,integer) from public;
grant execute on function public.course_categories(),public.course_catalog(text,text,text,integer) to anon,authenticated;

-- The previous Render build still reads lessons directly during rollout.
-- Apply 202611260003 only when the new catalog is live.

create table private.course_enrollments (
  user_id uuid references public.profiles(id) on delete cascade,
  course_id text references public.courses(id),
  revision_id uuid not null,
  active boolean not null default true,
  completed integer not null default 0 check (completed between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,course_id),
  foreign key (course_id,revision_id) references private.course_revisions(course_id,id)
);

create table private.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id text not null,
  lesson integer not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null default (now()+interval '20 minutes'),
  finished_at timestamptz,
  status text not null default 'active' check (status in ('active','pass','fail','expired','abandoned','cancelled_system')),
  answers jsonb not null default '{}',
  answer_version integer not null default 0,
  score numeric,
  foreign key (user_id,course_id) references private.course_enrollments(user_id,course_id) on delete cascade
);
create index course_enrollments_by_course on private.course_enrollments(course_id,user_id);
create index quiz_attempts_by_course on private.quiz_attempts(course_id,user_id,lesson);
create index quiz_attempts_history on private.quiz_attempts(user_id,course_id,lesson,started_at desc);
create unique index quiz_attempts_active on private.quiz_attempts(user_id,course_id,lesson) where status='active';

alter table private.course_revisions enable row level security;
alter table private.course_workspaces enable row level security;
alter table private.course_enrollments enable row level security;
alter table private.quiz_attempts enable row level security;
revoke all on private.course_revisions,private.course_workspaces,private.course_enrollments,private.quiz_attempts from public,anon,authenticated;

create function private.quiz_score(questions jsonb, answers jsonb) returns numeric
language sql immutable set search_path='' as $$
  select 100 * coalesce(sum(case when
    coalesce(answers->((ordinality-1)::text),'[]'::jsonb) @> (q->'correct')
    and coalesce(answers->((ordinality-1)::text),'[]'::jsonb) <@ (q->'correct')
    then (q->>'weight')::numeric else 0 end),0) / nullif(sum((q->>'weight')::numeric),0)
  from jsonb_array_elements(questions) with ordinality as x(q,ordinality);
$$;

create function private.attempt_result(a private.quiz_attempts) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',a.id,'status',a.status,'answers',a.answers,'version',a.answer_version,
    'startedAt',a.started_at,'finishedAt',a.finished_at,'deadline',a.deadline,'score',a.score);
$$;

-- All student writes take the enrollment lock, including retries and quiz actions.
create function public.learning_action(p_action text,p_course text default null,p_lesson integer default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  c public.courses%rowtype;
  w private.course_workspaces%rowtype;
  e private.course_enrollments%rowtype;
  r private.course_revisions%rowtype;
  a private.quiz_attempts%rowtype;
  questions jsonb;
  lesson_data jsonb;
  user_answers jsonb;
  v_score numeric;
  used integer;
  i integer;
  chosen jsonb;
  entry jsonb;
  finished boolean;
  attempt_id uuid;
begin
  if not private.active_student() then
    return jsonb_build_object('error','unauthorized');
  end if;
  if p_action='mine' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',en.course_id,'title',rev.title,'active',en.active,
      'status',co.status,'completed',en.completed,'completedAt',en.completed_at,
      'total',jsonb_array_length(rev.lessons)) order by en.updated_at desc)
      from private.course_enrollments en join private.course_revisions rev on rev.id=en.revision_id
      join public.courses co on co.id=en.course_id where en.user_id=uid),'[]'::jsonb);
  end if;

  select * into c from public.courses where id=p_course for share;
  if not found then return jsonb_build_object('error','missing'); end if;
  select * into w from private.course_workspaces where course_id=p_course;
  if p_action='enroll' then
    if c.status<>'published' or w.published_revision_id is null or w.owner_id=uid then
      return jsonb_build_object('error','unavailable');
    end if;
    insert into private.course_enrollments(user_id,course_id,revision_id) values(uid,p_course,w.published_revision_id)
    on conflict(user_id,course_id) do update set active=true,updated_at=now()
      where not private.course_enrollments.active;
    return jsonb_build_object('ok',true);
  end if;

  select * into e from private.course_enrollments where user_id=uid and course_id=p_course for update;
  if not found then return jsonb_build_object('error','not_enrolled'); end if;
  select * into r from private.course_revisions where id=e.revision_id;
  update private.quiz_attempts qa
  set status='expired',finished_at=qa.deadline,
    score=private.quiz_score(r.lessons->(qa.lesson-1)->'quiz',qa.answers)
  where qa.user_id=uid and qa.course_id=p_course and qa.status='active' and qa.deadline<=now();
  if p_action='leave' then
    update private.course_enrollments set active=false,updated_at=now() where user_id=uid and course_id=p_course and active;
    update private.quiz_attempts set status='abandoned',finished_at=now(),score=0
    where user_id=uid and course_id=p_course and status='active';
    return jsonb_build_object('ok',true);
  end if;
  if not e.active or c.status in ('blocked','deleted') then
    return jsonb_build_object('error','unavailable');
  end if;
  if p_action='course' then
    return jsonb_build_object('title',r.title,'program',private.lesson_program(r.lessons),
      'completed',e.completed,'readOnly',c.status='archived');
  end if;

  if p_lesson is null or p_lesson < 1 or p_lesson > jsonb_array_length(r.lessons) then return jsonb_build_object('error','missing'); end if;
  if p_lesson > e.completed+1 then return jsonb_build_object('error','locked'); end if;
  lesson_data := r.lessons->(p_lesson-1);
  questions := lesson_data->'quiz';
  finished := exists(select 1 from private.quiz_attempts where user_id=uid and course_id=p_course and lesson=p_lesson and status='pass');
  if p_action='lesson' then
    return (lesson_data-'quiz') || jsonb_build_object(
      'questions',coalesce((select jsonb_agg(q-'correct' order by ordinality) from jsonb_array_elements(questions) with ordinality x(q,ordinality)),'[]'::jsonb),
      'passed',finished,'completed',p_lesson<=e.completed,'readOnly',c.status='archived',
      'attempts',coalesce((select jsonb_agg(private.attempt_result(qa) order by started_at desc)
        from private.quiz_attempts qa where user_id=uid and course_id=p_course and lesson=p_lesson),'[]'::jsonb));
  end if;
  if c.status='archived' then return jsonb_build_object('error','read_only'); end if;
  if p_action='complete' then
    if p_lesson<=e.completed then return jsonb_build_object('ok',true); end if;
    if jsonb_array_length(questions)>0 and not finished then return jsonb_build_object('error','quiz_required'); end if;
    update private.course_enrollments set completed=p_lesson,updated_at=now(),
      completed_at=case when p_lesson=jsonb_array_length(r.lessons) then now() end
      where user_id=uid and course_id=p_course;
    return jsonb_build_object('ok',true);
  end if;
  if jsonb_array_length(questions)=0 then return jsonb_build_object('error','missing'); end if;
  if p_action='start_quiz' then
    select * into a from private.quiz_attempts where user_id=uid and course_id=p_course and lesson=p_lesson and status='active';
    if found then return private.attempt_result(a); end if;
    select count(*) into used from private.quiz_attempts
      where user_id=uid and course_id=p_course and lesson=p_lesson and status<>'cancelled_system';
    if used>=3 then return jsonb_build_object('error','attempt_limit'); end if;
    insert into private.quiz_attempts(user_id,course_id,lesson) values(uid,p_course,p_lesson) returning * into a;
    return private.attempt_result(a);
  end if;
  if coalesce(p_data->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return jsonb_build_object('error','invalid'); end if;
  attempt_id := (p_data->>'id')::uuid;
  select * into a from private.quiz_attempts where id=attempt_id and user_id=uid and course_id=p_course and lesson=p_lesson;
  if not found then return jsonb_build_object('error','missing'); end if;
  if a.status<>'active' then return private.attempt_result(a); end if;
  if p_action in ('save_quiz','submit_quiz') then
    user_answers := p_data->'answers';
    if jsonb_typeof(user_answers) is distinct from 'object' or octet_length(user_answers::text)>4000
      or coalesce(p_data->>'version','') !~ '^[0-9]{1,9}$' then return jsonb_build_object('error','invalid'); end if;
    if (p_data->>'version')::integer<>a.answer_version then
      if p_action='save_quiz' and user_answers=a.answers then return private.attempt_result(a); end if;
      return jsonb_build_object('error','stale_answer');
    end if;
    for entry in select jsonb_build_object('key',key,'value',value) from jsonb_each(user_answers) loop
      if (entry->>'key') !~ '^(0|[1-9][0-9]?)$' then return jsonb_build_object('error','invalid'); end if;
      i := (entry->>'key')::integer;
      if i>=jsonb_array_length(questions) or jsonb_typeof(entry->'value')<>'array' then return jsonb_build_object('error','invalid'); end if;
      if jsonb_array_length(entry->'value')>6 then return jsonb_build_object('error','invalid'); end if;
      for chosen in select value from jsonb_array_elements(entry->'value') loop
        if chosen::text !~ '^[0-5]$' or (chosen::text)::integer>=jsonb_array_length(questions->i->'options') then
          return jsonb_build_object('error','invalid');
        end if;
      end loop;
    end loop;
    if p_action='save_quiz' then
      update private.quiz_attempts set answers=user_answers,answer_version=answer_version+1 where id=a.id returning * into a;
    else
      v_score := private.quiz_score(questions,user_answers);
      update private.quiz_attempts set answers=user_answers,answer_version=answer_version+1,finished_at=now(),
        status=case when v_score>=70 then 'pass' else 'fail' end,score=v_score
      where id=a.id returning * into a;
    end if;
  elsif p_action='abandon_quiz' then
    update private.quiz_attempts set status='abandoned',finished_at=now(),score=0 where id=a.id returning * into a;
  else
    return jsonb_build_object('error','invalid');
  end if;
  return private.attempt_result(a);
end;
$$;
revoke all on function public.learning_action(text,text,integer,jsonb) from public,anon;
grant execute on function public.learning_action(text,text,integer,jsonb) to authenticated;
commit;
