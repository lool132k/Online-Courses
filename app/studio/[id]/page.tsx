import { notFound } from 'next/navigation';
import { courseIdPattern } from '../../../lib/course-routing';
import { StudioEditor } from './studio-editor';

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!courseIdPattern.test(id)) notFound();
  return <StudioEditor key={id} id={id === 'new' ? undefined : id}/>;
}
