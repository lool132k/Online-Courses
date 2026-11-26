import Image from 'next/image';
import Link from 'next/link';
import { HomeCourses } from './home-courses';

const steps = [
  { title: 'Выбери курс', description: 'Найди интересную тему в каталоге и посмотри программу.' },
  { title: 'Запишись и начни учиться', description: 'После записи откроются уроки и материалы курса.' },
  { title: 'Продолжай с нужного урока', description: 'Прогресс и результаты квизов сохраняются в личном кабинете.' },
];

export default function Home() {
  return <div className="marketing-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-copy">
        <h1 id="home-title">Бесплатные курсы <span>в своём темпе</span></h1>
        <p>Выбирай интересную тему, изучай уроки и проверяй себя в квизах. Продолжай с того же места на любом устройстве.</p>
        <div className="actions">
          <Link className="button" href="/courses">Выбрать курс</Link>
          <Link className="button home-secondary" href="/auth?mode=signup">Создать аккаунт</Link>
        </div>
      </div>
      <Image className="home-hero-image" src="/images/learning-hero.webp" alt=""
        width={1080} height={720} unoptimized preload/>
    </section>

    <section className="marketing-section" aria-labelledby="featured-title">
      <div className="marketing-section-heading">
        <h2 id="featured-title">Курсы для старта</h2>
        <Link className="marketing-link" href="/courses">Весь каталог <span aria-hidden="true">→</span></Link>
      </div>
      <HomeCourses/>
    </section>

    <section className="marketing-section home-steps" aria-labelledby="learning-steps-title">
      <div className="marketing-section-heading">
        <h2 id="learning-steps-title">Как проходит обучение</h2>
        <Link className="marketing-link" href="/about">Подробнее о платформе <span aria-hidden="true">→</span></Link>
      </div>
      <ol>
        {steps.map(({ title, description }) => <li key={title}>
          <h3>{title}</h3>
          <p>{description}</p>
        </li>)}
      </ol>
    </section>
  </div>;
}
