import { NextRequest, NextResponse } from 'next/server';
import { getCatalog, pageSize, parseCatalogFilters } from '../../../lib/catalog';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  try {
    const filters = parseCatalogFilters(Object.fromEntries(request.nextUrl.searchParams));
    const { courses, count } = await getCatalog(filters);
    return NextResponse.json({
      courses: courses.map(course => ({ ...course, lessons: course.program })),
      count, page: filters.page, pageSize, source: 'supabase',
    }, { headers });
  } catch {
    return NextResponse.json({ message: 'Не удалось загрузить курсы. Попробуйте позже.' }, { status: 503, headers });
  }
}
