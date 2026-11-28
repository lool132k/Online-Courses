'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { courseAction } from '../../../lib/course-api-client';
import { parseVideo, videoLink, type CourseDraft, type DraftLesson, type StudioCourse, type StudioList } from '../../../lib/learning-types';
import { statusLabels } from '../studio-home';
import { LessonEditor } from './lesson-editor';
import { CourseStats } from './course-stats';

const levels = ['Начальный', 'Средний', 'Продвинутый'];
const blankLesson = (): DraftLesson => ({ section: 'Введение', title: '', body: '', video: '', materials: [], quiz: [] });
const blankDraft = (): CourseDraft => ({ title: '', description: '', category: '', level: levels[0], lessons: [blankLesson()] });

export function StudioEditor({ id }: { id?: string }) {
  const [record, setRecord] = useState<StudioCourse | null>(null);
  const [draft, setDraft] = useState(blankDraft);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');

  async function load() {
    if (!id) {
      const list = await courseAction<StudioList>('studio', 'list');
      if (!list.teacher) throw new Error('Для создания курса нужны права преподавателя.');
    } else {
      const data = await courseAction<StudioCourse>('studio', 'get', id);
      setRecord(data);
      setDraft({ ...data.draft, lessons: data.draft.lessons.map(lesson => ({ ...lesson, video: videoLink(lesson.video) })) });
    }
    setDirty(false);
    setReady(true);
  }
  useEffect(() => {
    void load().catch(error => setMessage(error.message));
  }, [id]);

  function edit<K extends keyof CourseDraft>(field: K, value: CourseDraft[K]) {
    setDirty(true);
    setDraft(previous => ({ ...previous, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    for (const [index, lesson] of draft.lessons.entries()) {
      if (parseVideo(lesson.video) === null) {
        setMessage(`Урок ${index + 1}: укажите корректную HTTPS-ссылку YouTube или Vimeo.`);
        return;
      }
      if (lesson.quiz.some(question => !question.correct.length)) {
        setMessage(`Урок ${index + 1}: выберите правильный вариант для каждого вопроса.`);
        return;
      }
    }
    const payload = { ...draft, lessons: draft.lessons.map(lesson => ({ ...lesson, video: parseVideo(lesson.video) ?? '' })), editedAt: record?.editedAt };
    setBusy(true);
    setMessage('');
    try {
      const result = await courseAction<{ id?: string }>('studio', id ? 'save' : 'create', id, undefined, payload);
      if (result.id) window.location.assign(`/studio/${result.id}`);
      else { await load(); setMessage('Черновик сохранён.'); }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: string, success: string) {
    setBusy(true);
    setMessage('');
    try {
      await courseAction('studio', action, id, undefined, { editedAt: record?.editedAt, reason });
      if (record?.owned) {
        await load();
        setReason('');
        setMessage(success);
      } else window.location.assign('/studio');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <section className="studio"><Link href="/studio">← Курсы и модерация</Link>
    <h1>Редактор курса</h1><p role="status">{message || 'Загружаем редактор…'}</p></section>;
  const editable = !record || (record.owned && ['draft', 'unpublished'].includes(record.status));
  const disabled = busy || uploads > 0;
  return <section className="studio">
    <Link href="/studio">← Курсы и модерация</Link>
    <h1>{record ? draft.title : 'Новый курс'}</h1>
    {record && <p className="muted">{statusLabels[record.status]}</p>}
    {record?.reason && <p className="notice">Комментарий модератора: {record.reason}</p>}
    <p role="status">{message}</p>
    <form onSubmit={save}>
      <fieldset disabled={!editable || disabled} className="studio-fields">
        <label>Название<input required minLength={5} maxLength={120} value={draft.title} onChange={event => edit('title', event.target.value)}/></label>
        <label>Описание<textarea required minLength={50} maxLength={5000} rows={4} value={draft.description} onChange={event => edit('description', event.target.value)}/></label>
        <div className="studio-fields-row">
          <label>Категория<input required minLength={2} maxLength={80} value={draft.category} onChange={event => edit('category', event.target.value)}/></label>
          <label>Уровень<select value={draft.level} onChange={event => edit('level', event.target.value)}>
            {levels.map(level => <option key={level}>{level}</option>)}
          </select></label>
        </div>
      </fieldset>
      <h2>Уроки</h2>
      {draft.lessons.map((lesson, index) => <LessonEditor key={index} lesson={lesson} index={index} readonly={!editable || disabled}
        canUp={index > 0 && !disabled} canDown={index < draft.lessons.length - 1 && !disabled} canRemove={draft.lessons.length > 1 && !disabled} course={id}
        onChange={value => {
          setDirty(true);
          setDraft(previous => ({ ...previous, lessons: previous.lessons.map((item, position) => position === index ? value : item) }));
        }}
        onMove={offset => {
          const lessons = [...draft.lessons];
          [lessons[index], lessons[index + offset]] = [lessons[index + offset], lessons[index]];
          edit('lessons', lessons);
        }}
        onRemove={() => edit('lessons', draft.lessons.filter((_, position) => position !== index))}
        onUploading={status => setUploads(value => value + (status ? 1 : -1))}/>)}
      {editable && <div className="actions">
        {draft.lessons.length < 100 && <button type="button" className="secondary" disabled={disabled}
          onClick={() => edit('lessons', [...draft.lessons, blankLesson()])}>Добавить урок</button>}
        <button disabled={disabled || Boolean(record && !dirty)}>Сохранить черновик</button>
      </div>}
    </form>
    {record?.owned && <section className="studio-section">
      <h2>Публикация</h2>
      <div className="actions">
        {editable && <button disabled={disabled || dirty} onClick={() => void transition('submit', 'Курс отправлен на проверку.')}>Отправить на проверку</button>}
        {record.status === 'review' && <button className="secondary" disabled={busy} onClick={() => void transition('withdraw', 'Курс возвращён в черновики.')}>Отозвать с проверки</button>}
        {record.status === 'published' && <button className="secondary" disabled={busy} onClick={() => void transition('unpublish', 'Курс снят с публикации.')}>Снять с публикации</button>}
        {['draft', 'unpublished'].includes(record.status) && <button className="secondary" disabled={disabled || dirty} onClick={() => void transition('archive', 'Курс перенесён в архив.')}>Архивировать</button>}
        {record.status === 'archived' && <button className="secondary" disabled={busy} onClick={() => void transition('restore', 'Курс восстановлен.')}>Восстановить</button>}
        {record.status === 'published' && <Link className="button secondary" href={`/courses/${record.id}`}>Карточка в каталоге</Link>}
      </div>
    </section>}
    {record?.admin && record.status === 'review' && <section className="studio-section">
      <h2>Решение модератора</h2>
      <label>Причина возврата<textarea maxLength={1000} value={reason} onChange={event => setReason(event.target.value)}/></label>
      <div className="actions">
        <button disabled={busy} onClick={() => void transition('publish', 'Курс опубликован.')}>Опубликовать</button>
        <button className="secondary" disabled={busy || !reason.trim()} onClick={() => void transition('reject', 'Курс возвращён автору.')}>Вернуть на доработку</button>
      </div>
    </section>}
    {record?.admin && !record.owned && record.status === 'published' && <section className="studio-section">
      <h2>Публикация</h2>
      <button className="secondary" disabled={busy} onClick={() => void transition('unpublish', 'Курс снят с публикации.')}>Снять с публикации</button>
    </section>}
    {record?.owned && <CourseStats id={record.id}/>}
  </section>;
}
