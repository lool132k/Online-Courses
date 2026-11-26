'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CatalogCourse } from '../lib/catalog';

export function HomeCourses() {
  const [courses, setCourses] = useState<CatalogCourse[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch('/api/courses', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error('Каталог временно недоступен');
        const data: { courses: CatalogCourse[] } = await response.json();
        const beginnerFirst = data.courses.sort((left, right) => Number(right.level === 'Начальный') - Number(left.level === 'Начальный'));
        if (!controller.signal.aborted) setCourses(beginnerFirst.slice(0, 4));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  if (failed) return <p role="status">Не удалось загрузить список. Попробуй открыть каталог.</p>;
  if (!courses) return <p role="status">Загружаем курсы…</p>;
  if (!courses.length) return <p>Опубликованные курсы появятся здесь после модерации.</p>;

  return <ul className="home-course-list">
    {courses.map(course => <li key={course.id}>
      <Link href={`/courses/${course.id}`} className="home-course">
        <div className="home-course-cover" style={{ backgroundColor: course.color, color: course.ink }} aria-hidden="true">
          {course.cover}
        </div>
        <div className="home-course-copy">
          <p className="home-course-meta">{course.category} <span aria-hidden="true">·</span> {course.level}</p>
          <h3>{course.title}</h3>
          <p className="home-course-description">{course.description}</p>
        </div>
      </Link>
    </li>)}
  </ul>;
}
