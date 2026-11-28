import Link from 'next/link';
import { redirect } from 'next/navigation';
import { catalogHref, getCatalog, getCategories, levels, pageSize, parseCatalogFilters } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCatalogFilters(await searchParams);
  const [{ courses, count }, categories] = await Promise.all([getCatalog(filters), getCategories()]);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (filters.page > pages) redirect(catalogHref({ ...filters, page: pages }));
  const categoryOptions = filters.category && !categories.includes(filters.category) ? [...categories, filters.category] : categories;

  return <section className="catalog-page">
    <header className="catalog-intro">
      <h1>Каталог курсов</h1>
      <p>Бесплатные курсы BMBCourses</p>
    </header>
    <form action="/courses" className="catalog-filters">
      <label>Поиск<input name="q" type="search" maxLength={120} defaultValue={filters.q} placeholder="Название курса"/></label>
      <label>Категория<select name="category" defaultValue={filters.category}>
        <option value="">Все категории</option>
        {categoryOptions.map(category => <option key={category}>{category}</option>)}
      </select></label>
      <label>Уровень<select name="level" defaultValue={filters.level}>
        <option value="">Все уровни</option>
        {levels.map(level => <option key={level}>{level}</option>)}
      </select></label>
      <button type="submit">Найти</button>
    </form>
    {courses.length ? <ul className="course-grid">
      {courses.map(course => <li key={course.id} className="course-card">
        <div className="course-cover" style={{ backgroundColor: course.color, color: course.ink }} aria-hidden="true">{course.cover}</div>
        <div className="course-card-content">
          <p className="muted">{course.category} · {course.level}</p>
          <h2><Link href={`/courses/${course.id}`}>{course.title}</Link></h2>
          <p>{course.description}</p>
          <p className="muted">{course.author}</p>
        </div>
      </li>)}
    </ul> : <div className="notice"><p>Курсы по этим условиям не найдены.</p><Link href="/courses">Сбросить фильтры</Link></div>}
    {pages > 1 && <nav className="course-pagination" aria-label="Страницы каталога">
      {filters.page > 1 && <Link className="button secondary" href={catalogHref({ ...filters, page: filters.page - 1 })}>Назад</Link>}
      <span>Страница {filters.page} из {pages}</span>
      {filters.page < pages && <Link className="button secondary" href={catalogHref({ ...filters, page: filters.page + 1 })}>Далее</Link>}
    </nav>}
  </section>;
}
