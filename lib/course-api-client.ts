import type { StudentResults } from './learning-types';

export class CourseApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const result = await response.json();
    if (!response.ok) throw new CourseApiError(result.message ?? 'Не удалось выполнить запрос.', response.status);
    return result as T;
  } catch (error) {
    if (error instanceof CourseApiError) throw error;
    throw new CourseApiError('Не удалось связаться с сервером. Попробуйте ещё раз.', 0);
  }
}

export function courseAction<T>(
  area: 'learning' | 'studio', action: string, course?: string, lesson?: number, data?: object, signal?: AbortSignal,
) {
  if (['mine', 'list', 'get', 'course', 'lesson'].includes(action)) {
    const query = new URLSearchParams({ action });
    if (course) query.set('course', course);
    if (lesson) query.set('lesson', String(lesson));
    return request<T>(`/api/${area}?${query}`, { signal });
  }
  return request<T>(`/api/${area}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, course, lesson, data }),
    signal,
  });
}

export function uploadMaterial<T>(file: File) {
  const body = new FormData();
  body.set('file', file);
  return request<T>('/api/studio/material', { method: 'POST', body });
}
export function getStudentResults(page: number, signal: AbortSignal) {
  return request<StudentResults>(`/api/learning/results?page=${page}`, { signal });
}
