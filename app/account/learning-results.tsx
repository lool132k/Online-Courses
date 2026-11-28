'use client';

import { useEffect, useState } from 'react';
import { getStudentResults } from '../../lib/course-api-client';
import { quizStatusLabels, type StudentResults } from '../../lib/learning-types';

const dateFormat = new Intl.DateTimeFormat('ru-BY', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Minsk',
});
const scoreFormat = new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 });
const score = (value: number) => `${scoreFormat.format(value)}%`;

export function LearningResults() {
  const [results, setResults] = useState<StudentResults | null>(null);
  const [request, setRequest] = useState({ page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getStudentResults(request.page, controller.signal).then(result => {
      if (!controller.signal.aborted) setResults(result);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [request]);

  function load(page: number) {
    setLoading(true);
    setError('');
    setRequest({ page });
  }

  return <section aria-labelledby="learning-results-title">
    <h2 id="learning-results-title">Результаты обучения</h2>
    {loading && <p role="status">Загружаем результаты…</p>}
    {error && <div>
      <p className="error" role="status">{error}</p>
      <button className="secondary" onClick={() => load(request.page)}>Повторить загрузку</button>
    </div>}
    {results && <>
      <dl className="learning-metrics">
        <div><dt>Завершено курсов</dt><dd>{results.completedCourses}</dd></div>
        <div><dt>Пройдено квизов</dt><dd>{results.passedQuizzes}</dd></div>
        <div><dt>Средний балл</dt><dd>{results.averageScore === null ? 'Нет данных' : score(results.averageScore)}</dd></div>
      </dl>
      <section aria-labelledby="quiz-history-title" aria-busy={loading}>
        <h3 id="quiz-history-title">История квизов</h3>
        {results.attempts.length ? <ul className="learning-attempts">
          {results.attempts.map(attempt => <li key={attempt.id}>
            <div>
              <strong>{attempt.lessonTitle}</strong>
              <span className="muted">{attempt.courseTitle}</span>
              <small>
                <time dateTime={attempt.startedAt}>{dateFormat.format(new Date(attempt.startedAt))}</time>
                {attempt.durationSeconds !== null && ` · ${Math.floor(attempt.durationSeconds / 60)} мин ${attempt.durationSeconds % 60} с`}
              </small>
            </div>
            <div className="learning-attempt-score">
              <span>{quizStatusLabels[attempt.status]}{attempt.score !== null && ` · ${score(attempt.score)}`}</span>
              {attempt.bestScore !== null && attempt.bestScore !== attempt.score && <small>Лучший балл {score(attempt.bestScore)}</small>}
            </div>
          </li>)}
        </ul> : <p>Здесь появятся попытки после начала первого квиза.</p>}
        {results.pages > 1 && <nav className="course-pagination" aria-label="Страницы истории квизов">
          <button type="button" className="secondary" disabled={loading || results.page === 1} onClick={() => load(results.page - 1)}>Назад</button>
          <span>Страница {results.page} из {results.pages}</span>
          <button type="button" className="secondary" disabled={loading || results.page === results.pages} onClick={() => load(results.page + 1)}>Далее</button>
        </nav>}
      </section>
    </>}
  </section>;
}
