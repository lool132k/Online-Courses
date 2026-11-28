begin;

-- Give new students a quiz in the existing public sample course.
-- An enrollment keeps its revision even when the published revision changes.
with revised as (
  select w.course_id,r.title,
    jsonb_set(r.lessons,'{0,quiz}',jsonb_build_array(
      jsonb_build_object('prompt','Какая команда выводит текст в Python?',
        'options',jsonb_build_array('print','input','import'),'correct',jsonb_build_array(0),'weight',1),
      jsonb_build_object('prompt','Что выведет команда print("Привет!")?',
        'options',jsonb_build_array('Привет!','print','Ничего'),'correct',jsonb_build_array(0),'weight',1),
      jsonb_build_object('prompt','Из чего состоит программа Python?',
        'options',jsonb_build_array('Из инструкций','Из картинок','Из строк таблицы'),'correct',jsonb_build_array(0),'weight',1)
    )) as lessons
  from private.course_workspaces w
  join private.course_revisions r on r.id=w.published_revision_id
  join public.courses c on c.id=w.course_id
  where w.course_id='python' and w.owner_id is null and c.status='published'
    and r.lessons->0->'quiz'='[]'::jsonb
), created as (
  insert into private.course_revisions(course_id,title,lessons)
  select course_id,title,
    case when jsonb_array_length(lessons)>=3 then jsonb_set(lessons,'{2,body}',
      to_jsonb(replace(lessons->2->>'body',' На следующем этапе проекта здесь появится серверный тест.','')))
    else lessons end
  from revised
  returning id,course_id,lessons
), published as (
  update private.course_workspaces w set published_revision_id=r.id
  from created r where w.course_id=r.course_id
  returning w.course_id,r.lessons
)
update public.courses c set program=private.lesson_program(p.lessons)
from published p where c.id=p.course_id;

commit;
