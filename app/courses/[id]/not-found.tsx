import Link from 'next/link';

export default function CourseNotFound() {
  return <section className="panel">
    <h1>Курс не найден</h1>
    <Link href="/courses">Вернуться в каталог</Link>
  </section>;
}
