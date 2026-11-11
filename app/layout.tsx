import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BMBCourses — онлайн-курсы', description: 'Бесплатные курсы и личный кабинет BMBCourses' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body><header className="site-header"><a className="brand" href="/demo/index.html" aria-label="BMBCourses — перейти в каталог">BMBCourses</a><nav aria-label="Основное меню"><a href="/demo/index.html#catalog">Каталог</a><a href="/demo/index.html#roles">Для авторов</a><a href="/demo/index.html#about">О платформе</a></nav><a className="button secondary header-account" href="/account">Личный кабинет</a></header><main>{children}</main><footer><a className="brand" href="/demo/index.html">BMBCourses</a><span>Бесплатные онлайн-курсы · учебный проект · 2026</span></footer></body></html>;
}
