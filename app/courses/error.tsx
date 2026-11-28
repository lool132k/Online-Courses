'use client';

export default function CoursesError({ reset }: { reset: () => void }) {
  return <section className="panel">
    <h1>Курсы временно недоступны</h1>
    <button onClick={reset}>Повторить загрузку</button>
  </section>;
}
