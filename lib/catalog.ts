import { publicSupabase } from './public-supabase';
import { courseIdPattern } from './course-routing';

export const levels = ['Начальный', 'Средний', 'Продвинутый'] as const;
export const pageSize = 12;

export type ProgramLesson = { position: number; title: string; section: string; hasQuiz: boolean };
export type CatalogCourse = {
  id: string; title: string; category: string; level: string; author: string;
  description: string; cover: string; color: string; ink: string; program: ProgramLesson[];
};
export type CatalogFilters = { q: string; category: string; level: string; page: number };

const fields = 'id,title,category,level,author,description,cover,color,ink,program';

export function parseCatalogFilters(params: Record<string, string | string[] | undefined>): CatalogFilters {
  const read = (key: string, max: number) => {
    const value = params[key];
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  };
  const level = read('level', 20);
  const page = read('page', 8);
  return {
    q: read('q', 120), category: read('category', 80),
    level: levels.find(item => item === level) ?? '',
    page: /^[1-9]\d*$/.test(page) ? Number(page) : 1,
  };
}

export function catalogHref(filters: CatalogFilters) {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.category) query.set('category', filters.category);
  if (filters.level) query.set('level', filters.level);
  if (filters.page > 1) query.set('page', String(filters.page));
  return query.size ? `/courses?${query}` : '/courses';
}

export async function getCatalog(filters: CatalogFilters) {
  const { data, error } = await publicSupabase().rpc('course_catalog', {
    p_query: filters.q, p_category: filters.category, p_level: filters.level, p_page: filters.page,
  });
  if (error) throw error;
  return data as { courses: CatalogCourse[]; count: number };
}

export async function getCourse(id: string) {
  if (!courseIdPattern.test(id)) return null;
  const { data, error } = await publicSupabase().from('courses').select(fields).eq('status', 'published').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as CatalogCourse | null;
}

export async function getCategories() {
  const { data, error } = await publicSupabase().rpc('course_categories');
  if (error) throw error;
  return (data ?? []) as string[];
}
