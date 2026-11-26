begin;

create function public.learning_results(p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  student_id uuid := auth.uid();
  page_size constant integer := 10;
  as_of timestamptz := statement_timestamp();
begin
  if not private.active_student() then
    return jsonb_build_object('error','unauthorized');
  end if;

  return (
    with enrollments as (
      select e.course_id,e.revision_id,e.completed_at
      from private.course_enrollments e
      where e.user_id=student_id
    ), attempts as (
      select qa.id,qa.course_id,qa.lesson,qa.started_at,
        r.title as course_title,r.lessons->(qa.lesson-1)->>'title' as lesson_title,
        case when qa.status='active' and qa.deadline<=as_of then 'expired' else qa.status end as status,
        case when qa.status='active' and qa.deadline<=as_of then qa.deadline else qa.finished_at end as finished_at,
        case when qa.status='active' and qa.deadline<=as_of
          then private.quiz_score(r.lessons->(qa.lesson-1)->'quiz',qa.answers) else qa.score end as score
      from enrollments e
      join private.course_revisions r on r.id=e.revision_id
      join private.quiz_attempts qa on qa.course_id=e.course_id and qa.user_id=student_id
    ), quizzes as (
      select course_id,lesson,bool_or(status='pass') as passed,max(score) as best_score
      from attempts
      where status in ('pass','fail','expired','abandoned')
      group by course_id,lesson
    ), pagination as (
      select greatest(1,(count(*)+page_size-1)/page_size) as pages from attempts
    ), current_page as (
      select least(greatest(1,p_page),pages) as page,pages from pagination
    ), recent as (
      select * from attempts order by started_at desc,id desc
      offset (select (page-1)*page_size from current_page) limit page_size
    )
    select jsonb_build_object(
      'completedCourses',(select count(*) from enrollments where completed_at is not null),
      'passedQuizzes',(select count(*) from quizzes where passed),
      'averageScore',(select round(avg(best_score),2) from quizzes),
      'page',pg.page,'pages',pg.pages,
      'attempts',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',a.id,'courseTitle',a.course_title,'lessonTitle',a.lesson_title,
          'status',a.status,'score',round(a.score,2),'bestScore',round(q.best_score,2),
          'startedAt',a.started_at,'durationSeconds',
            case when a.finished_at is not null then greatest(0,floor(extract(epoch from a.finished_at-a.started_at))) end
        ) order by a.started_at desc,a.id desc)
        from recent a left join quizzes q using(course_id,lesson)
      ),'[]'::jsonb)
    )
    from current_page pg
  );
end;
$$;

revoke all on function public.learning_results(integer) from public,anon;
grant execute on function public.learning_results(integer) to authenticated;

commit;
