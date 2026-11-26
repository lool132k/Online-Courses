'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Главная' },
  { href: '/courses', label: 'Каталог' },
  { href: '/studio', label: 'Для авторов' },
  { href: '/about', label: 'О платформе' },
];

export function SiteNav() {
  const pathname = usePathname();
  return <nav aria-label="Основное меню">
    {links.map(({ href, label }) => {
      const current = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
      return <Link key={href} href={href} aria-current={current ? 'page' : undefined}>{label}</Link>;
    })}
  </nav>;
}
