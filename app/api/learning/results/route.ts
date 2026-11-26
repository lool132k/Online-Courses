import type { NextRequest } from 'next/server';
import { courseError, courseReply, courseSession } from '../../../../lib/course-api';

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get('page') ?? '1';
  if (!/^[1-9]\d{0,8}$/.test(page)) return courseError('invalid');

  try {
    const session = await courseSession();
    if (!session) return courseError('unauthorized');
    const { data, error } = await session.client.rpc('learning_results', { p_page: Number(page) });
    if (error) throw error;
    return data?.error ? courseError(data.error) : courseReply(data);
  } catch {
    return courseError('service');
  }
}
