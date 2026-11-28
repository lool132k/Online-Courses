'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CourseApiError, courseAction } from '../../../lib/course-api-client';
import { courseLogin } from '../../../lib/course-routing';
import type { Enrollment } from '../../../lib/learning-types';

export function EnrollmentButton({ id }: { id: string }) {
  const [state, setState] = useState<'loading' | 'guest' | 'available' | 'active' | 'unknown'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const login = courseLogin(`/courses/${id}`);
  useEffect(() => {
    let cancelled = false;
    courseAction<Enrollment[]>('learning', 'mine').then(items => {
      if (!cancelled) setState(items.some(item => item.id === id && item.active) ? 'active' : 'available');
    }).catch(error => {
      if (!cancelled) setState(error instanceof CourseApiError && error.status === 401 ? 'guest' : 'unknown');
    });
    return () => { cancelled = true; };
  }, [id]);

  async function enroll() {
    setBusy(true);
    setMessage('');
    try {
      await courseAction('learning', 'enroll', id);
      window.location.assign(`/learn/${id}`);
    } catch (error) {
      if (error instanceof CourseApiError && error.status === 401) window.location.assign(login);
      else setMessage((error as Error).message);
      setBusy(false);
    }
  }

  if (state === 'loading') return <p role="status">Проверяем запись…</p>;
  if (state === 'guest') return <Link className="button" href={login}>Войти и записаться</Link>;
  if (state === 'active') return <Link className="button" href={`/learn/${id}`}>Продолжить курс</Link>;
  return <div>
    <button disabled={busy} onClick={enroll}>{busy ? 'Записываем…' : 'Записаться на курс'}</button>
    <p role="status" className="error">{message}</p>
  </div>;
}
