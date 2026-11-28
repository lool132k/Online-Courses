-- Compatible with the Supabase SQL editor. All fixtures are rolled back.
begin;
create function pg_temp.learning_identity(user_id uuid, session_id uuid) returns void
language sql as $$
  select set_config('request.jwt.claim.sub',user_id::text,true),
    set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'session_id',session_id,'role','authenticated')::text,true);
$$;

do $test$
declare
  teacher uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  student uuid := gen_random_uuid();
  other_student uuid := gen_random_uuid();
  teacher_session uuid := gen_random_uuid();
  admin_session uuid := gen_random_uuid();
  student_session uuid := gen_random_uuid();
  second_session uuid := gen_random_uuid();
  other_session uuid := gen_random_uuid();
  course_id text;
  material_path text := teacher::text || '/' || gen_random_uuid()::text || '.txt';
  draft jsonb := jsonb_build_object(
    'title','QA Learning Course','category','QA Test','level','Начальный',
    'description','A sufficiently long explanation of the learning scenario and its checks.',
    'lessons',jsonb_build_array(jsonb_build_object(
      'title','First lesson','section','Basics','body','Private first version','video','youtube:abcdefghijk',
      'materials',jsonb_build_array(jsonb_build_object('name','guide.txt','path',material_path,'size',128)),
      'quiz','[{"prompt":"Select both","options":["A","B","C"],"correct":[0,2],"weight":3}]'::jsonb
    ), '{"title":"Second lesson","section":"Basics","body":"Private next lesson","video":"","materials":[],"quiz":[]}'::jsonb));
  result jsonb;
  attempt jsonb;
  expires jsonb;
  revision_version text;
begin
  insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)
  select id,id::text||'@example.invalid',jsonb_build_object('name',name),now()
  from (values (teacher,'QA Teacher'),(admin,'QA Admin'),(student,'QA Student'),(other_student,'Other Student')) u(id,name);
  insert into auth.sessions(id,user_id,created_at,updated_at)
  select id,user_id,now(),now() from (values (teacher_session,teacher),(admin_session,admin),
    (student_session,student),(second_session,student),(other_session,other_student)) s(id,user_id);
  update public.profiles set is_teacher=true where id=teacher;
  update public.profiles set is_admin=true where id=admin;

  perform pg_temp.learning_identity(teacher,teacher_session);
  set local role authenticated;
  insert into storage.objects(bucket_id,name,metadata) values('course-materials',material_path,'{"size":128}');
  result := public.course_studio('create',null,draft);
  assert result ? 'id', format('Create draft: %s',result);
  course_id := result->>'id';
  assert public.course_studio('save',course_id,draft || '{"editedAt":"wrong"}'::jsonb)->>'error'='stale_draft';
  result := public.course_studio('get',course_id);
  revision_version := result->>'editedAt';
  assert public.course_studio('submit',course_id,jsonb_build_object('editedAt',revision_version))->>'ok'='true';
  assert public.course_studio('publish',course_id)->>'error'='forbidden';

  reset role;
  set local role anon;
  assert not exists(select 1 from public.courses where id=course_id);
  assert not has_function_privilege(current_user,'public.learning_action(text,text,integer,jsonb)','execute');
  assert not has_function_privilege(current_user,'public.learning_results(integer)','execute');
  assert not has_table_privilege(current_user,'public.lessons','select');
  reset role;

  perform pg_temp.learning_identity(admin,admin_session);
  set local role authenticated;
  assert jsonb_array_length(public.course_studio('list')->'courses')=1;
  assert exists(select 1 from storage.objects where name=material_path);
  assert public.course_studio('reject',course_id,'{"reason":"Update introduction"}')->>'ok'='true';
  reset role;

  perform pg_temp.learning_identity(teacher,teacher_session);
  set local role authenticated;
  result := public.course_studio('get',course_id);
  assert result->>'reason'='Update introduction';
  assert public.course_studio('submit',course_id,jsonb_build_object('editedAt',result->>'editedAt'))->>'ok'='true';
  reset role;

  perform pg_temp.learning_identity(admin,admin_session);
  set local role authenticated;
  assert public.course_studio('publish',course_id)->>'ok'='true';
  reset role;

  set local role anon;
  result := public.course_catalog('learning','QA Test','Начальный',1);
  assert result->>'count'='1', format('Catalog result: %s',result);
  assert result#>>'{courses,0,program,0,title}'='First lesson';
  assert not (result#>'{courses,0,program,0}' ?| array['body','materials','quiz']);
  assert jsonb_array_length(public.course_catalog('learning','QA Test','Начальный',2)->'courses')=0;
  reset role;

  perform pg_temp.learning_identity(student,student_session);
  set local role authenticated;
  assert public.course_studio('get',course_id)->>'error'='forbidden';
  assert public.course_studio('stats',course_id)->>'error'='forbidden';
  assert public.learning_action('lesson',course_id,1)->>'error'='not_enrolled';
  assert not exists(select 1 from storage.objects where name=material_path);
  assert public.learning_action('enroll',course_id)->>'ok'='true';
  assert public.learning_action('enroll',course_id)->>'ok'='true';
  assert public.learning_action('lesson',course_id,2)->>'error'='locked';
  result := public.learning_action('lesson',course_id,1);
  assert result->>'body'='Private first version';
  assert not (result#>'{questions,0}' ? 'correct');
  assert exists(select 1 from storage.objects where name=material_path);
  assert public.learning_action('complete',course_id,1)->>'error'='quiz_required';
  attempt := public.learning_action('start_quiz',course_id,1);
  assert (public.learning_action('start_quiz',course_id,1)->>'id')=attempt->>'id';
  result := public.learning_action('save_quiz',course_id,1,jsonb_build_object(
    'id',attempt->'id','version',0,'answers','{"0":[2,0]}'::jsonb));
  assert result->>'version'='1';
  assert public.learning_action('save_quiz',course_id,1,jsonb_build_object(
    'id',attempt->'id','version',0,'answers','{"0":[2,0]}'::jsonb))->>'version'='1';
  assert public.learning_action('submit_quiz',course_id,1,jsonb_build_object(
    'id',attempt->'id','version',0,'answers','{"0":[1]}'::jsonb))->>'error'='stale_answer';
  assert public.learning_action('submit_quiz',course_id,1,jsonb_build_object(
    'id',attempt->'id','version',1,'answers','{"0":[2,0]}'::jsonb))->>'status'='pass';
  assert public.learning_action('submit_quiz',course_id,1,jsonb_build_object('id',attempt->'id'))->>'status'='pass';
  assert public.learning_action('complete',course_id,1)->>'ok'='true';
  assert public.learning_action('complete',course_id,1)->>'ok'='true';
  assert public.learning_action('complete',course_id,2)->>'ok'='true';
  expires := public.learning_action('start_quiz',course_id,1);
  assert public.learning_action('save_quiz',course_id,1,jsonb_build_object(
    'id',expires->'id','version',0,'answers','{"0":[0,2]}'::jsonb))->>'status'='active';
  reset role;

  update private.quiz_attempts set deadline=now()-interval '1 second' where id=(expires->>'id')::uuid;
  perform pg_temp.learning_identity(student,second_session);
  set local role authenticated;
  result := public.learning_action('mine');
  assert jsonb_array_length(result)=1 and result#>>'{0,completed}'='2' and result#>>'{0,completedAt}' is not null;
  result := public.learning_results();
  assert result->>'completedCourses'='1' and result->>'passedQuizzes'='1';
  assert exists(select 1 from jsonb_array_elements(result->'attempts') a
    where a->>'id'=expires->>'id' and a->>'status'='expired' and (a->>'score')::numeric=100);
  assert not exists(select 1 from jsonb_array_elements(result->'attempts') a
    where a ?| array['answers','questions','correct','body']);
  result := public.learning_action('submit_quiz',course_id,1,jsonb_build_object('id',expires->'id'));
  assert result->>'status'='expired' and (result->>'score')::numeric=100;
  expires := public.learning_action('start_quiz',course_id,1);
  assert public.learning_action('leave',course_id)->>'ok'='true';
  assert public.learning_action('lesson',course_id,1)->>'error'='unavailable';
  assert not exists(select 1 from storage.objects where name=material_path);
  result := public.learning_results();
  assert result->>'completedCourses'='1' and result->>'passedQuizzes'='1';
  assert (result->>'averageScore')::numeric=100 and jsonb_array_length(result->'attempts')=3;
  assert exists(select 1 from jsonb_array_elements(result->'attempts') a
    where a->>'status'='abandoned' and (a->>'score')::numeric=0 and (a->>'bestScore')::numeric=100);
  assert public.learning_action('enroll',course_id)->>'ok'='true';
  assert public.learning_action('mine')#>>'{0,completed}'='2';
  assert public.learning_action('abandon_quiz',course_id,1,jsonb_build_object('id',expires->'id'))->>'status'='abandoned';
  assert public.learning_action('start_quiz',course_id,1)->>'error'='attempt_limit';
  reset role;

  perform pg_temp.learning_identity(other_student,other_session);
  set local role authenticated;
  assert public.learning_action('mine')='[]'::jsonb;
  result := public.learning_results();
  assert result->'attempts'='[]'::jsonb and result->'averageScore'='null'::jsonb;
  assert public.learning_action('lesson',course_id,1)->>'error'='not_enrolled';
  assert not exists(select 1 from storage.objects where name=material_path);
  assert not has_table_privilege(current_user,'private.course_enrollments','select');
  reset role;

  perform pg_temp.learning_identity(teacher,teacher_session);
  set local role authenticated;
  result := public.course_studio('stats',course_id);
  assert result->>'total'='1' and result->>'completed'='1' and (result->>'score')::numeric=100;
  assert jsonb_array_length(public.course_studio('stats',course_id,'{"page":2}')->'students')=0;
  assert public.learning_action('enroll',course_id)->>'error'='unavailable';
  assert public.course_studio('unpublish',course_id)->>'ok'='true';
  result := public.course_studio('get',course_id);
  draft := jsonb_set(draft,'{lessons,0,body}','"New lesson content"'::jsonb);
  assert public.course_studio('save',course_id,draft || jsonb_build_object('editedAt',result->>'editedAt'))->>'ok'='true';
  result := public.course_studio('get',course_id);
  assert public.course_studio('submit',course_id,jsonb_build_object('editedAt',result->>'editedAt'))->>'ok'='true';
  reset role;

  perform pg_temp.learning_identity(admin,admin_session);
  set local role authenticated;
  assert public.course_studio('publish',course_id)->>'ok'='true';
  reset role;

  perform pg_temp.learning_identity(other_student,other_session);
  set local role authenticated;
  assert public.learning_action('enroll',course_id)->>'ok'='true';
  assert public.learning_action('lesson',course_id,1)->>'body'='New lesson content';
  reset role;

  perform pg_temp.learning_identity(student,student_session);
  set local role authenticated;
  assert public.learning_action('lesson',course_id,1)->>'body'='Private first version';
  reset role;
  perform pg_temp.learning_identity(admin,admin_session);
  set local role authenticated;
  assert public.course_studio('unpublish',course_id)->>'ok'='true';
  reset role;
  perform pg_temp.learning_identity(student,student_session);
  set local role authenticated;
  assert public.learning_action('lesson',course_id,1)->>'body'='Private first version';
  assert public.learning_action('enroll',course_id)->>'error'='unavailable';
  reset role;
  delete from auth.sessions where id=student_session;
  set local role authenticated;
  assert public.learning_action('mine')->>'error'='unauthorized';
  assert public.learning_results()->>'error'='unauthorized';
  reset role;

  insert into private.quiz_attempts(user_id,course_id,lesson,status,started_at,finished_at)
  select student,course_id,1,'cancelled_system',now()-make_interval(mins=>i+10),now()-make_interval(mins=>i)
  from generate_series(1,8) i;
  update public.courses set status='blocked' where id=course_id;
  perform pg_temp.learning_identity(student,second_session);
  set local role authenticated;
  result := public.learning_results();
  assert result->>'page'='1' and result->>'pages'='2' and jsonb_array_length(result->'attempts')=10;
  result := public.learning_results(99);
  assert result->>'page'='2' and jsonb_array_length(result->'attempts')=1;
  assert result#>>'{attempts,0,status}'='cancelled_system' and result#>>'{attempts,0,durationSeconds}'='600';
  assert result#>>'{attempts,0,courseTitle}'='QA Learning Course';
  assert result#>>'{attempts,0,lessonTitle}'='First lesson' and (result->>'averageScore')::numeric=100;
  reset role;

  insert into public.courses(id,title,category,level,author,description,cover,color,ink,status,published_at)
  select 'qa-page-'||i,'QA page '||i,'QA Pagination','Начальный','QA','Fixture','QA','#ffffff','#000000','published',now()
  from generate_series(1,13) i;
  set local role anon;
  result := public.course_catalog('QA PAGE','QA Pagination','Начальный',1);
  assert result->>'count'='13' and jsonb_array_length(result->'courses')=12;
  result := public.course_catalog('QA PAGE','QA Pagination','Начальный',2);
  assert jsonb_array_length(result->'courses')=1 and result#>>'{courses,0,id}'='qa-page-9';
  reset role;
end;
$test$;
rollback;
select 'PASS: catalog, permissions, moderation, quizzes, files, versioned progress and personal learning results' as result;
