import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Names — онлайн-курсы', description: 'Бесплатные курсы и личный кабинет' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body><header><a className="brand" href="/">Names<span>курсы</span></a><nav aria-label="Основное меню"><a href="/demo/index.html">Каталог · демо</a><a href="/account">Личный кабинет</a></nav></header><main>{children}</main><footer>Онлайн-курсы · учебный проект · 2026</footer></body></html>;
}
