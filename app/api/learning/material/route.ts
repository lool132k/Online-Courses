import { NextRequest, NextResponse } from 'next/server';
import { courseError, courseSession, privateHeaders, validCourseId } from '../../../../lib/course-api';
import { lessonPosition } from '../../../../lib/course-routing';
import type { Material } from '../../../../lib/learning-types';

export async function GET(request: NextRequest) {
  const course = request.nextUrl.searchParams.get('course');
  const lesson = lessonPosition(request.nextUrl.searchParams.get('lesson'));
  const path = request.nextUrl.searchParams.get('path');
  if (!validCourseId(course) || !lesson || !path || path.length > 100) return courseError('invalid');
  try {
    const session = await courseSession();
    if (!session) return courseError('unauthorized');
    const { data, error } = await session.client.rpc('learning_action', { p_action: 'lesson', p_course: course, p_lesson: lesson });
    if (error) throw error;
    if (data?.error) return courseError(data.error);
    const material = (data.materials as Material[]).find(item => item.path === path);
    if (!material) return courseError('missing');
    const signed = await session.client.storage.from('course-materials').createSignedUrl(material.path, 300, { download: material.name });
    if (signed.error) throw signed.error;
    return NextResponse.redirect(signed.data.signedUrl, { headers: privateHeaders });
  } catch {
    return courseError('service');
  }
}
