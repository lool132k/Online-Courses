import type { Metadata } from 'next';
import './globals.css';
import './courses.css';
export const metadata: Metadata = { title: 'BMBCourses — онлайн-курсы', description: 'Бесплатные курсы и личный кабинет BMBCourses' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body><header className="site-header"><a className="brand" href="/">BMBCourses</a><nav aria-label="Основное меню"><a href="/courses">Каталог</a><a href="/studio">Для авторов</a><a href="/">О платформе</a></nav><a className="button secondary header-account" href="/account">Личный кабинет</a></header><main>{children}</main><footer><a className="brand" href="/">BMBCourses</a><span>Бесплатные онлайн-курсы · учебный проект · 2026</span></footer></body></html>;
}
