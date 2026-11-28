'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CourseApiError, courseAction } from '../../lib/course-api-client';
import type { StudioList } from '../../lib/learning-types';

export const statusLabels: Record<string, string> = {
  draft: 'Черновик', review: 'На проверке', published: 'Опубликован',
  unpublished: 'Снят с публикации', archived: 'В архиве', blocked: 'Заблокирован', deleted: 'Удалён',
};

export function StudioHome() {
  const [studio, setStudio] = useState<StudioList | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setStudio(await courseAction<StudioList>('studio', 'list'));
      setMessage('');
    } catch (error) {
      setSignedOut(error instanceof CourseApiError && error.status === 401);
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function decide(id: string, reject: boolean, reason: string) {
    setBusy(true);
    try {
      await courseAction('studio', reject ? 'reject_teacher' : 'approve_teacher', undefined, undefined, { id, reason });
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="studio">
    <Link href="/account">← Личный кабинет</Link>
    <h1>Курсы и модерация</h1>
    {loading && <p role="status">Загружаем…</p>}
    <p role="status" className="error">{message}</p>
    {signedOut && <Link className="button" href="/auth">Войти</Link>}
    {studio && <>
      {studio.teacher && <Link className="button" href="/studio/new">Создать курс</Link>}
      <section className="studio-section">
        <h2>{studio.admin ? 'Курсы и очередь проверки' : 'Мои курсы'}</h2>
        {studio.courses.length ? <ul className="studio-list">
          {studio.courses.map(course => <li key={course.id}>
            <Link href={`/studio/${course.id}`}>{course.title}</Link>
            <span>{statusLabels[course.status]}</span>
          </li>)}
        </ul> : <p>Здесь пока нет курсов.</p>}
      </section>
      {studio.admin && <section className="studio-section">
        <h2>Заявки преподавателей</h2>
        {studio.requests.length ? studio.requests.map(item => <form className="studio-row" key={item.id} onSubmit={event => {
          event.preventDefault();
          const submitted = (event.nativeEvent as SubmitEvent).submitter;
          const reject = submitted instanceof HTMLButtonElement && submitted.value === 'reject';
          void decide(item.id, reject, String(new FormData(event.currentTarget).get('reason') ?? ''));
        }}>
          <strong>{item.name}</strong>
          <label>Причина при отклонении<input name="reason" maxLength={1000}/></label>
          <div className="actions"><button disabled={busy} value="approve">Одобрить</button>
            <button className="secondary" value="reject" disabled={busy}>Отклонить</button></div>
        </form>) : <p>Нет заявок на рассмотрении.</p>}
      </section>}
    </>}
  </section>;
}
