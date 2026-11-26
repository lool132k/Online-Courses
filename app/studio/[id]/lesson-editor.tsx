'use client';

import { useState } from 'react';
import { uploadMaterial } from '../../../lib/course-api-client';
import type { DraftLesson, Material, QuizQuestion } from '../../../lib/learning-types';

export function LessonEditor({ lesson, index, readonly, canUp, canDown, canRemove, course,
  onChange, onMove, onRemove, onUploading }: {
  lesson: DraftLesson; index: number; readonly: boolean; canUp: boolean; canDown: boolean; canRemove: boolean;
  course?: string; onChange: (value: DraftLesson) => void; onMove: (offset: number) => void;
  onRemove: () => void; onUploading: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const update = (field: keyof DraftLesson, value: DraftLesson[keyof DraftLesson]) => onChange({ ...lesson, [field]: value });
  const setQuestion = (position: number, question: QuizQuestion) => update('quiz', lesson.quiz.map((old, i) => i === position ? question : old));

  async function attach(file: File) {
    const size = lesson.materials.reduce((total, item) => total + item.size, 0) + file.size;
    if (size > 100 * 1024 * 1024) {
      setUploadMessage('Лимит материалов одного урока — 100 МБ.');
      return;
    }
    setUploading(true);
    onUploading(true);
    setUploadMessage('Загружаем файл…');
    try {
      const material = await uploadMaterial<Material>(file);
      update('materials', [...lesson.materials, material]);
      setUploadMessage('Файл загружен.');
    } catch (error) {
      setUploadMessage((error as Error).message);
    } finally {
      onUploading(false);
      setUploading(false);
    }
  }

  return <fieldset className="editor-lesson" disabled={readonly || uploading}>
    <legend>Урок {index + 1}</legend>
    {!readonly && <div className="actions">
      <button type="button" className="secondary" disabled={!canUp} onClick={() => onMove(-1)}>Выше</button>
      <button type="button" className="secondary" disabled={!canDown} onClick={() => onMove(1)}>Ниже</button>
      <button type="button" className="secondary" disabled={!canRemove} onClick={onRemove}>Удалить урок</button>
    </div>}
    <label>Раздел<input required maxLength={120} value={lesson.section} onChange={event => update('section', event.target.value)}/></label>
    <label>Заголовок<input required maxLength={160} value={lesson.title} onChange={event => update('title', event.target.value)}/></label>
    <label>Текст урока<textarea required maxLength={50000} rows={6} value={lesson.body} onChange={event => update('body', event.target.value)}/></label>
    <label>Ссылка на видео YouTube или Vimeo<input type="url" maxLength={512} value={lesson.video} onChange={event => update('video', event.target.value)}/></label>
    {readonly && lesson.video && <a href={lesson.video} target="_blank" rel="noreferrer">Открыть видео</a>}
    <section>
      <h3>Материалы</h3>
      {lesson.materials.length > 0 && <ul>{lesson.materials.map(item => <li key={item.path}>
        {course ? <a href={`/api/studio/material?${new URLSearchParams({ course, path: item.path })}`}>{item.name}</a> : item.name}
        {!readonly && <button type="button" className="secondary" onClick={() => update('materials', lesson.materials.filter(other => other.path !== item.path))}>Убрать</button>}
      </li>)}</ul>}
      {!readonly && lesson.materials.length < 10 && <label>Прикрепить материал · до 20 МБ
        <input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.zip" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void attach(file);
        }}/>
      </label>}
      <p role="status">{uploadMessage}</p>
    </section>
    <section>
      <h3>Квиз к уроку</h3>
      {lesson.quiz.map((question, position) => <fieldset key={position} className="editor-question">
        <legend>Вопрос {position + 1}</legend>
        <label>Вопрос<input required maxLength={1000} value={question.prompt}
          onChange={event => setQuestion(position, { ...question, prompt: event.target.value })}/></label>
        <label>Вес вопроса<input type="number" min={1} max={10} required value={question.weight}
          onChange={event => setQuestion(position, { ...question, weight: event.target.valueAsNumber || 0 })}/></label>
        {question.options.map((option, choice) => <div key={choice} className="option-edit">
          <label>Вариант {choice + 1}<input required maxLength={500} value={option} onChange={event => {
            const value = event.target.value;
            setQuestion(position, { ...question, options: question.options.map((text, i) => i === choice ? value : text) });
          }}/></label>
          <label className="choice"><input type="checkbox" checked={question.correct.includes(choice)} onChange={() => setQuestion(position, {
            ...question, correct: question.correct.includes(choice) ? question.correct.filter(i => i !== choice) : [...question.correct, choice],
          })}/> Правильный</label>
          {!readonly && question.options.length > 2 && <button type="button" className="secondary" onClick={() => setQuestion(position, {
            ...question, options: question.options.filter((_, i) => i !== choice),
            correct: question.correct.filter(i => i !== choice).map(i => i > choice ? i - 1 : i),
          })}>Убрать вариант</button>}
        </div>)}
        {!readonly && <div className="actions">
          {question.options.length < 6 && <button type="button" className="secondary" onClick={() => setQuestion(position, { ...question, options: [...question.options, ''] })}>Добавить вариант</button>}
          <button type="button" className="secondary" onClick={() => update('quiz', lesson.quiz.filter((_, i) => i !== position))}>Удалить вопрос</button>
        </div>}
      </fieldset>)}
      {!readonly && lesson.quiz.length < 30 && <button type="button" className="secondary" onClick={() => update('quiz', [
        ...lesson.quiz, { prompt: '', options: ['', ''], correct: [], weight: 1 },
      ])}>Добавить вопрос</button>}
    </section>
  </fieldset>;
}
