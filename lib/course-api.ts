import { NextRequest, NextResponse } from 'next/server';
import { trustedOrigin } from './auth-validation';
import { configured, supabase } from './supabase';
import { courseIdPattern, lessonPosition } from './course-routing';

const errors: Record<string, [number, string]> = {
  unauthorized: [401, 'Войдите с подтверждённым email.'],
  forbidden: [403, 'Для этого действия недостаточно прав.'],
  missing: [404, 'Курс, урок или попытка не найдены.'],
  not_enrolled: [403, 'Для доступа сначала запишитесь на курс.'],
  unavailable: [403, 'Курс сейчас недоступен для этого действия.'],
  locked: [403, 'Сначала завершите предыдущий урок.'],
  read_only: [403, 'Архивный курс доступен для чтения.'],
  quiz_required: [409, 'Сначала пройдите квиз.'],
  attempt_limit: [409, 'Все три попытки уже использованы.'],
  stale_answer: [409, 'Ответы изменились в другом окне. Обновите урок.'],
  stale_draft: [409, 'Черновик изменился. Откройте актуальную версию перед сохранением.'],
  invalid: [400, 'Проверьте данные запроса.'],
  invalid_draft: [400, 'Проверьте поля курса, уроки, материалы и правильные ответы в квизе.'],
};

export const privateHeaders = { 'Cache-Control': 'private, no-store' };
export const courseReply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders });

export function courseError(code: string) {
  const [status, message] = errors[code] ?? [503, 'Сервис курсов временно недоступен.'];
  return courseReply({ message }, status);
}

export function validCourseOrigin(request: NextRequest) {
  return Boolean(process.env.APP_URL && trustedOrigin(request.headers.get('origin'), process.env.APP_URL));
}

export async function courseSession() {
  if (!configured()) throw new Error('COURSES_UNAVAILABLE');
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 400)) throw error;
  return data.user?.email_confirmed_at ? { client, user: data.user } : null;
}

export function validCourseId(value: unknown): value is string {
  return typeof value === 'string' && courseIdPattern.test(value);
}

export async function runCourseRequest(
  request: NextRequest, area: 'learning_action' | 'course_studio', allowed: readonly string[],
) {
  try {
    if (!configured()) return courseError('service');
    let input: { action?: unknown; course?: unknown; lesson?: unknown; data?: unknown };
    if (request.method === 'GET') {
      input = Object.fromEntries(request.nextUrl.searchParams);
      if (area === 'course_studio' && input.action === 'stats') input.data = { page: request.nextUrl.searchParams.get('page') };
    } else {
      if (!validCourseOrigin(request)) return courseError('forbidden');
      const limit = area === 'course_studio' ? 6500000 : 10000;
      if (Number(request.headers.get('content-length')) > limit) return courseReply({ message: 'Слишком большой запрос.' }, 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > limit) return courseReply({ message: 'Слишком большой запрос.' }, 413);
      try { input = JSON.parse(raw); } catch { return courseError('invalid'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return courseError('invalid');
    }
    const { action, course, lesson, data } = input;
    if (typeof action !== 'string' || !allowed.includes(action)) return courseError('invalid');
    if (course !== undefined && !validCourseId(course)) return courseError('invalid');
    if (lesson !== undefined && lessonPosition(lesson) === null) return courseError('invalid');
    const session = await courseSession();
    if (!session) return courseError('unauthorized');
    const { data: result, error } = await session.client.rpc(area, {
      p_action: action, p_course: course ?? null, p_data: data ?? {},
      ...(area === 'learning_action' ? { p_lesson: lessonPosition(lesson) } : {}),
    });
    if (error) throw error;
    return result?.error ? courseError(result.error) : courseReply(result);
  } catch {
    return courseError('service');
  }
}
