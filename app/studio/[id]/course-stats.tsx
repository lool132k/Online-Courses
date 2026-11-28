'use client';

import { useEffect, useState } from 'react';
import { progressPercent } from '../../../lib/learning-types';

type Student = { user_id: string; name: string; active: boolean; completed: number; total: number; score: number | null };
type Stats = { total: number; active: number; completed: number; score: number | null; students: Student[] };

export function CourseStats({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ action: 'stats', course: id, page: String(page) });
    async function load() {
      try {
        const response = await fetch(`/api/studio?${query}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        if (!controller.signal.aborted) setStats(result);
      } catch (error) {
        if (!controller.signal.aborted) setMessage((error as Error).message);
      }
    }
    void load();
    return () => controller.abort();
  }, [id, page]);

  function changePage(next: number) {
    setMessage('');
    setStats(null);
    setPage(next);
  }

  return <section className="studio-section">
    <h2>Результаты студентов</h2>
    {message && <p role="status" className="error">{message}</p>}
    {!message && !stats && <p role="status">Загружаем результаты…</p>}
    {stats && (stats.total > 0 ? <>
      <p>Записались {stats.total} · учатся {stats.active} · завершили {stats.completed} ({Math.round(stats.completed * 100 / stats.total)}%)</p>
      <p>Средний балл за квизы {stats.score === null ? '· нет данных' : `${stats.score}%`}</p>
      <ul className="studio-list">
        {stats.students.map(student => <li key={student.user_id}>
          <strong>{student.name}</strong>
          <span>{progressPercent(student.completed, student.total)}% курса · {student.active ? 'Активная запись' : 'Отписался'}{student.score !== null && ` · квизы ${student.score}%`}</span>
        </li>)}
      </ul>
      {stats.total > 20 && <nav className="course-pagination" aria-label="Страницы результатов">
        <button className="secondary" disabled={page === 1} onClick={() => changePage(page - 1)}>Назад</button>
        <span>Страница {page}</span>
        <button className="secondary" disabled={page * 20 >= stats.total} onClick={() => changePage(page + 1)}>Далее</button>
      </nav>}
    </> : <p>На курс пока никто не записался.</p>)}
  </section>;
}
