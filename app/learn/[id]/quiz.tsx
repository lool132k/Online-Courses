'use client';

import { useEffect, useRef, useState } from 'react';
import { CourseApiError, courseAction } from '../../../lib/course-api-client';
import { quizStatusLabels, type Answers, type Attempt, type LearningLesson } from '../../../lib/learning-types';
import { retryQuizSave } from '../../../lib/quiz-autosave';

export function Quiz({ id, position, lesson, onPass, onReload }: {
  id: string; position: number; lesson: LearningLesson; onPass: () => void; onReload: () => void;
}) {
  const active = lesson.attempts.find(item => item.status === 'active') ?? null;
  const [attempt, setAttempt] = useState(active);
  const [history, setHistory] = useState(lesson.attempts.filter(item => item.status !== 'active'));
  const [answers, setAnswers] = useState<Answers>(active?.answers ?? {});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [time, setTime] = useState(() => Date.now());
  const [dirty, setDirty] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const seconds = attempt ? Math.max(0, Math.ceil((Date.parse(attempt.deadline) - time) / 1000)) : 0;

  useEffect(() => {
    if (!attempt) return;
    const interval = window.setInterval(() => setTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [attempt]);

  useEffect(() => () => request.current?.abort(), []);

  async function send(action: string, newAnswers = answers) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage('');
    setConflict(false);
    setRetrying(false);
    const payload = attempt ? { id: attempt.id, version: attempt.version, answers: newAnswers } : undefined;
    const submit = (signal: AbortSignal) => courseAction<Attempt>('learning', action, id, position, payload, signal);
    try {
      // Retries reuse the same answer version even when the first response was lost.
      const result = action === 'save_quiz' && attempt
        ? await retryQuizSave(submit, Date.parse(attempt.deadline), controller.signal, () => setRetrying(true))
        : await submit(controller.signal);
      if (controller.signal.aborted) return;
      setTime(Date.now());
      setAnswers(result.answers);
      setDirty(false);
      if (result.status === 'active') setAttempt(result);
      else {
        setAttempt(null);
        setHistory(items => [result, ...items.filter(item => item.id !== result.id)]);
        setMessage(quizStatusLabels[result.status]);
        if (result.status === 'pass') onPass();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessage((error as Error).message);
      setConflict(error instanceof CourseApiError && error.status === 409);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        setRetrying(false);
      }
    }
  }

  function toggle(question: number, option: number) {
    const current = answers[question] ?? [];
    const updated = { ...answers, [question]: current.includes(option) ? current.filter(value => value !== option) : [...current, option] };
    setAnswers(updated);
    setDirty(true);
    void send('save_quiz', updated);
  }

  const used = history.filter(item => item.status !== 'cancelled_system').length;
  return <section className="lesson-quiz">
    <h3>Квиз</h3>
    <p className="muted">Проходной балл 70% · 20 минут · использовано попыток {used} из 3</p>
    {lesson.passed && <p className="verified-badge">Квиз пройден</p>}
    {message && <p role="status">{message}</p>}
    {conflict && <button className="secondary" onClick={onReload}>Обновить урок</button>}
    {!attempt && used < 3 && !lesson.readOnly && <button disabled={busy} onClick={() => void send('start_quiz')}>Начать попытку</button>}
    {attempt && <>
      <p>Осталось {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
      <p role="status" className="muted">{retrying ? 'Связь прервалась. Повторяем сохранение…' : busy ? 'Сохраняем…' : dirty ? 'Есть несохранённые ответы' : 'Ответы сохранены'}</p>
      {lesson.questions.map((question, index) => <fieldset key={index} disabled={busy || conflict || seconds === 0 || lesson.readOnly}>
        <legend>{question.prompt}</legend>
        {question.options.map((option, choice) => <label key={choice} className="choice">
          <input type="checkbox" checked={Boolean(answers[index]?.includes(choice))} onChange={() => toggle(index, choice)}/>
          {option}
        </label>)}
      </fieldset>)}
      <div className="actions">
        {dirty && !conflict && seconds > 0 && !lesson.readOnly && <button className="secondary" disabled={busy} onClick={() => void send('save_quiz')}>Сохранить ответы</button>}
        {!lesson.readOnly && <button disabled={busy || conflict} onClick={() => void send('submit_quiz')}>{seconds > 0 ? 'Отправить ответы' : 'Получить результат'}</button>}
        {seconds > 0 && !lesson.readOnly && <button className="secondary" disabled={busy || conflict} onClick={() => void send('abandon_quiz')}>Прервать попытку</button>}
      </div>
    </>}
    {history.length > 0 && <div className="quiz-history"><h4>История попыток</h4>
      {history.map(item => <details key={item.id}>
        <summary>{quizStatusLabels[item.status]}{item.score !== null && ` · ${Math.round(item.score * 100) / 100}%`}
          {item.finishedAt && ` · ${new Date(item.finishedAt).toLocaleString('ru-BY', { timeZone: 'Europe/Minsk' })}`}</summary>
        <ol>{lesson.questions.map((question, index) => <li key={index}>{question.prompt} · {item.answers[index]?.map(option => question.options[option]).join(', ') || 'Без ответа'}</li>)}</ol>
      </details>)}
    </div>}
  </section>;
}
