'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { courseAction } from '../../lib/course-api-client';
import { progressPercent, type Enrollment } from '../../lib/learning-types';

export function MyCourses() {
  const [courses, setCourses] = useState<Enrollment[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    courseAction<Enrollment[]>('learning', 'mine').then(items => {
      if (!cancelled) setCourses(items);
    }).catch(error => {
      if (!cancelled) setMessage(error.message);
    });
    return () => { cancelled = true; };
  }, [reload]);

  async function update(course: Enrollment) {
    setBusy(course.id);
    setMessage('');
    try {
      await courseAction('learning', course.active ? 'leave' : 'enroll', course.id);
      setCourses(items => items?.map(item => item.id === course.id ? { ...item, active: !item.active } : item) ?? null);
      setReload(value => value + 1);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy('');
    }
  }

  return <section>
    <h2>Мои курсы</h2>
    {message && <div role="status"><p className="error">{message}</p><button className="secondary" onClick={() => { setMessage(''); setReload(value => value + 1); }}>Обновить список</button></div>}
    {!courses && !message && <p role="status">Загружаем курсы…</p>}
    {courses?.length === 0 && <p>У вас пока нет записей. <Link href="/courses">Выбрать курс</Link></p>}
    {courses && [true, false].map(active => {
      const items = courses.filter(course => course.active === active);
      if (!items.length) return null;
      return <section key={String(active)} className="account-courses">
        <h3>{active ? 'Ваши записи' : 'Неактивные записи'}</h3>
        <ul>
          {items.map(course => {
            const hasAccess = !['blocked', 'deleted'].includes(course.status);
            const percent = progressPercent(course.completed, course.total);
            return <li key={course.id}>
              <strong>{course.title}</strong>
              <span className="muted">{course.completedAt ? 'Курс завершён' : `${course.completed} из ${course.total} уроков`} · {percent}%</span>
              <progress max={100} value={percent} aria-label={`Прогресс курса «${course.title}»`}/>
              <div className="actions">
                {course.active && hasAccess && <Link href={`/learn/${course.id}`} className="button">{course.completedAt ? 'Открыть курс' : 'Продолжить'}</Link>}
                {course.active && !hasAccess && <span>Курс недоступен</span>}
                {course.active && <button className="secondary" disabled={Boolean(busy)} onClick={() => void update(course)}>Отписаться</button>}
                {!course.active && course.status === 'published' && <button className="secondary" disabled={Boolean(busy)} onClick={() => void update(course)}>Возобновить запись</button>}
              </div>
            </li>;
          })}
        </ul>
      </section>;
    })}
  </section>;
}
