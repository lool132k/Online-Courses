import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './courses.css';
import './marketing.css';
import { SiteNav } from './site-nav';

export const metadata: Metadata = { title: 'BMBCourses — онлайн-курсы', description: 'Бесплатные курсы и личный кабинет BMBCourses' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru">
    <body>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="BMBCourses, главная">BMBCourses</Link>
        <SiteNav/>
        <Link className="button secondary header-account" href="/account">Личный кабинет</Link>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div>
          <Link className="brand" href="/">BMBCourses</Link>
          <p>Учебная платформа бесплатных онлайн-курсов</p>
        </div>
        <nav aria-label="Ссылки в подвале">
          <Link href="/courses">Каталог</Link>
          <Link href="/about">О платформе</Link>
          <Link href="/studio">Для авторов</Link>
        </nav>
      </footer>
    </body>
  </html>;
}
