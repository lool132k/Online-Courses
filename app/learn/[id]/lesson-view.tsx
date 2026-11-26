'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CourseApiError, courseAction } from '../../../lib/course-api-client';
import { courseLogin, studyHref } from '../../../lib/course-routing';
import { videoLink, type LearningLesson } from '../../../lib/learning-types';
import { Quiz } from './quiz';

export function LessonView({ id, position, total, onComplete, onNavigate }: {
  id: string; position: number; total: number;
  onComplete: (position: number) => void; onNavigate: () => void;
}) {
  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    courseAction<LearningLesson>('learning', 'lesson', id, position).then(result => {
      if (!cancelled) setLesson(result);
    }).catch(error => {
      if (!cancelled) setError(error);
    });
    return () => { cancelled = true; };
  }, [id, position, reload]);

  function refresh() {
    setError(null);
    setLesson(null);
    setMessage('');
    setReload(value => value + 1);
  }

  async function complete() {
    setBusy(true);
    setMessage('');
    try {
      await courseAction('learning', 'complete', id, position);
      onComplete(position);
      setLesson(previous => previous ? { ...previous, completed: true } : previous);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <>
    <p className="error" role="status">{error.message}</p>
    {error instanceof CourseApiError && error.status === 401
      ? <Link className="button" href={courseLogin(studyHref(id, position))}>Войти</Link>
      : <button type="button" className="secondary" onClick={refresh}>Повторить загрузку</button>}
  </>;
  if (!lesson) return <p role="status">Загружаем урок…</p>;

  const video = videoLink(lesson.video);
  return <>
    <p className="muted study-position">Урок {position} из {total} · {lesson.section}</p>
    <h2>{lesson.title}</h2>
    <div className="lesson-text">{lesson.body}</div>
    {video && <div className="lesson-video">
      <iframe title={`Видео урока «${lesson.title}»`} src={videoLink(lesson.video, true)}
        referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowFullScreen loading="lazy"/>
      <p><a href={video} target="_blank" rel="noreferrer">Открыть видео у провайдера</a></p>
    </div>}
    {lesson.materials.length > 0 && <section><h3>Материалы</h3><ul>
      {lesson.materials.map(material => {
        const query = new URLSearchParams({ course: id, lesson: String(position), path: material.path });
        return <li key={material.path}><a href={`/api/learning/material?${query}`}>{material.name}</a> <small>{Math.ceil(material.size / 1024)} КБ</small></li>;
      })}
    </ul></section>}
    {lesson.questions.length > 0 && <Quiz id={id} position={position} lesson={lesson}
      onPass={() => setLesson(previous => previous ? { ...previous, passed: true } : previous)}
      onReload={refresh}/>}
    <p className="error" role="status">{message}</p>
    <div className="actions study-actions">
      {lesson.completed && <span className="verified-badge">Урок пройден</span>}
      {!lesson.completed && !lesson.readOnly && <button type="button" disabled={busy || (lesson.questions.length > 0 && !lesson.passed)}
        onClick={() => void complete()}>{busy ? 'Сохраняем…' : 'Урок пройден'}</button>}
      {lesson.readOnly && <span className="muted">Архивный курс · только чтение</span>}
    </div>
    {(position > 1 || (lesson.completed && position < total)) && <nav className="actions study-actions" aria-label="Переход между уроками">
      {position > 1 && <Link className="button secondary" href={studyHref(id, position - 1)} scroll={false} onNavigate={onNavigate}>← Предыдущий урок</Link>}
      {lesson.completed && position < total && <Link className="button" href={studyHref(id, position + 1)} scroll={false} onNavigate={onNavigate}>Следующий урок →</Link>}
    </nav>}
  </>;
}
