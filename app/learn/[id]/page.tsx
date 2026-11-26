import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { courseIdPattern } from '../../../lib/course-routing';
import { Study } from './study';

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!courseIdPattern.test(id)) notFound();
  return <Suspense fallback={<p role="status">Загружаем курс…</p>}>
    <Study key={id} id={id}/>
  </Suspense>;
}
