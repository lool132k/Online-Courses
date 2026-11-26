'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CourseApiError, courseAction } from '../../../lib/course-api-client';
import { courseLogin, lessonPosition, studyHref } from '../../../lib/course-routing';
import { progressPercent, type LearningCourse } from '../../../lib/learning-types';
import { LessonView } from './lesson-view';

export function Study({ id }: { id: string }) {
  const [course, setCourse] = useState<LearningCourse | null>(null);
  const [reload, setReload] = useState(0);
  const [courseError, setCourseError] = useState<Error | null>(null);
  const article = useRef<HTMLElement>(null);
  const focusOnNavigation = useRef(false);
  const params = useSearchParams();
  const positions = params.getAll('lesson');
  const hasLessonParam = positions.length > 0;
  const requested = positions.length === 1 ? lessonPosition(positions[0]) : null;
  const available = course ? Math.min(course.completed + 1, course.program.length) : null;
  const selected = hasLessonParam ? requested : available;

  useEffect(() => {
    let cancelled = false;
    courseAction<LearningCourse>('learning', 'course', id).then(result => {
      if (cancelled) return;
      setCourse(result);
      setCourseError(null);
    }).catch(error => {
      if (!cancelled) { setCourseError(error); setCourse(null); }
    });
    return () => { cancelled = true; };
  }, [id, reload]);

  useEffect(() => {
    if (hasLessonParam || !available) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('lesson')) return;
    url.searchParams.set('lesson', String(available));
    window.history.replaceState(null, '', url);
  }, [available, hasLessonParam]);

  useEffect(() => {
    if (!focusOnNavigation.current) return;
    focusOnNavigation.current = false;
    article.current?.focus();
  }, [selected]);

  function onNavigate() {
    focusOnNavigation.current = true;
  }

  function updateProgress(position: number) {
    setCourse(previous => previous ? { ...previous, completed: Math.max(position, previous.completed) } : previous);
  }

  if (courseError) return <section className="panel">
    <h1>Не удалось открыть обучение</h1>
    <p>{courseError.message}</p>
    <div className="actions">
      {courseError instanceof CourseApiError && courseError.status === 401
        ? <Link className="button" href={courseLogin(studyHref(id, requested))}>Войти</Link>
        : <Link className="button" href={`/courses/${id}`}>К карточке курса</Link>}
      <button className="secondary" onClick={() => { setCourseError(null); setReload(value => value + 1); }}>Повторить</button>
    </div>
  </section>;
  if (!course) return <p role="status">Загружаем курс…</p>;
  const total = course.program.length;
  const progress = progressPercent(course.completed, total);
  const missing = selected === null || selected > total;
  const locked = !missing && selected > course.completed + 1;
  return <section>
    <Link href="/account">← Личный кабинет</Link>
    <header className="study-heading">
      <h1>{course.title}</h1>
      <p>{course.completed} из {total} уроков · {progress}%</p>
      <progress max={100} value={progress} aria-label="Прогресс курса"/>
    </header>
    <div className="study-grid">
      <nav className="study-program" aria-label="Уроки курса">
        <h2>Программа</h2>
        <ol>
          {course.program.map(item => {
            const isLocked = item.position > course.completed + 1;
            const isCurrent = item.position === selected;
            const label = <>
              <small>{item.section}</small>{item.title}
              {item.position <= course.completed && <small>Пройден</small>}
              {isLocked && <small>Откроется после предыдущего</small>}
            </>;
            return <li key={item.position}>
              {isLocked || isCurrent
                ? <span className="study-step secondary" aria-current={isCurrent ? 'step' : undefined}>{label}</span>
                : <Link className="button secondary study-step" href={studyHref(id, item.position)} scroll={false} onNavigate={onNavigate}>{label}</Link>}
            </li>;
          })}
        </ol>
      </nav>
      <article className="study-lesson" ref={article} tabIndex={-1} aria-label="Урок">
        {missing || locked ? <>
          <h2>{missing ? 'Урок не найден' : 'Урок пока закрыт'}</h2>
          <p>{missing ? 'В этой версии курса нет урока по указанному адресу.' : 'Завершите предыдущие уроки, чтобы открыть этот.'}</p>
          <div className="actions">
            {available && <Link className="button" href={studyHref(id, available)} scroll={false} onNavigate={onNavigate}>Открыть доступный урок</Link>}
            {locked && <button type="button" className="secondary" onClick={() => setReload(value => value + 1)}>Обновить прогресс</button>}
          </div>
        </> : <LessonView key={selected} id={id} position={selected} total={total} onComplete={updateProgress} onNavigate={onNavigate}/>}
      </article>
    </div>
  </section>;
}
