import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCourse } from '../../../lib/catalog';
import { EnrollmentButton } from './enrollment-button';

export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();
  return <article className="course-detail">
    <Link href="/courses">← Все курсы</Link>
    <header className="course-banner" style={{ backgroundColor: course.color, color: course.ink }}>
      <div>
        <p>{course.category} · {course.level}</p>
        <h1>{course.title}</h1>
        <p>Автор курса · {course.author}</p>
      </div>
      <span aria-hidden="true">{course.cover}</span>
    </header>
    <p className="lesson-text">{course.description}</p>
    <EnrollmentButton id={id}/>
    <section className="course-program">
      <h2>Программа курса</h2>
      <ol>
        {course.program.map(lesson => <li key={lesson.position}>
          <span className="muted">{lesson.section}</span>
          <strong>{lesson.title}</strong>
          {lesson.hasQuiz && <small>Урок с квизом</small>}
        </li>)}
      </ol>
    </section>
  </article>;
}
